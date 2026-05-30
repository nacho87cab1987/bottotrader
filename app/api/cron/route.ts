import { NextRequest, NextResponse } from 'next/server';
import { fetchKlines, fetchFundingRate, fetchLongShortRatio } from '@/lib/binance';
import { fetchFearGreed, fetchGlobalData } from '@/lib/sentiment';
import { analyzeMarket, AnalysisMode } from '@/lib/scoring';
import { sendAlert, getNotifyConfig } from '@/lib/notify';
import {
  readJson, writeJson, STORAGE_KEYS, DEFAULT_SETTINGS,
  type WatchlistEntry, type AlertHistoryEntry, type Settings,
} from '@/lib/storage/store';
import {
  getPaperAccount, savePaperAccount,
  getPaperTrades, savePaperTrades,
  getPaperConfig,
} from '@/lib/paper/store';
import {
  shouldOpenPosition, createPaperTrade,
  evaluateOpenTrade, closePaperTrade, updateAccountAfterClose,
} from '@/lib/paper/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TF_CONFIG: Record<AnalysisMode, { trigger: string; setup: string; macro: string }> = {
  swing: { trigger: '4h', setup: '1d', macro: '1w' },
  intraday: { trigger: '15m', setup: '1h', macro: '4h' },
};

const COOLDOWN_BY_MODE: Record<AnalysisMode, number> = {
  swing: 240,
  intraday: 30,
};

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  const referer = req.headers.get('referer') || '';
  const host = req.headers.get('host') || '';
  const isSameOrigin = referer.includes(host);

  const hasValidSecret = expectedSecret && authHeader === `Bearer ${expectedSecret}`;

  if (!hasValidSecret && !isSameOrigin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();

  const watchlist = await readJson<WatchlistEntry[]>(STORAGE_KEYS.watchlist, []);
  const enabled = watchlist.filter(w => w.enabled);
  if (enabled.length === 0) {
    return NextResponse.json({ message: 'Watchlist vacía', scanned: 0 });
  }

  const settings = await readJson<Settings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
  const history = await readJson<AlertHistoryEntry[]>(STORAGE_KEYS.alertHistory, []);
  const notifyConfig = getNotifyConfig();

  // Paper trader state
  let paperAccount = await getPaperAccount();
  let paperTrades = await getPaperTrades();
  const paperConfig = await getPaperConfig();
  const paperEvents: any[] = [];

  const [fg, global] = await Promise.all([fetchFearGreed(), fetchGlobalData()]);

  const scanReport: any[] = [];

  for (const entry of enabled) {
    const modes: AnalysisMode[] = (entry as any).modes || ['swing', 'intraday'];
    for (const mode of modes) {
      const tfs = TF_CONFIG[mode];

      try {
        const [klinesTrigger, klinesSetup, klinesMacro, funding, longShort] = await Promise.all([
          fetchKlines(entry.symbol, tfs.trigger, 300),
          fetchKlines(entry.symbol, tfs.setup, 300),
          fetchKlines(entry.symbol, tfs.macro, 200),
          fetchFundingRate(entry.symbol),
          fetchLongShortRatio(entry.symbol),
        ]);

        const minKlines = mode === 'intraday' ? 50 : 100;
        if (klinesSetup.length < minKlines || klinesTrigger.length < minKlines) {
          scanReport.push({ symbol: entry.symbol, mode, status: 'insufficient-data' });
          continue;
        }

        const result = analyzeMarket(entry.symbol, klinesTrigger, klinesSetup, klinesMacro, {
          fearGreed: fg?.value ?? null,
          fearGreedLabel: fg?.classification ?? null,
          funding,
          longShortRatio: longShort,
          btcDominance: global?.btcDominance ?? null,
        }, mode);

        // ─── PAPER TRADER: cerrar posiciones abiertas si tocan SL/TP ───
        const tradesForSymbol = paperTrades.filter(t =>
          t.status === 'open' && t.symbol === entry.symbol && t.mode === mode
        );
        for (const trade of tradesForSymbol) {
          const evalResult = evaluateOpenTrade(trade, result.price, paperConfig);
          if (evalResult?.close) {
            const closed = closePaperTrade(trade, evalResult.exitPrice, evalResult.reason, paperConfig);
            const idx = paperTrades.findIndex(t => t.id === trade.id);
            if (idx !== -1) paperTrades[idx] = closed;
            paperAccount = updateAccountAfterClose(paperAccount, closed);
            paperEvents.push({
              action: 'closed',
              symbol: trade.symbol,
              mode: trade.mode,
              side: trade.side,
              reason: evalResult.reason,
              pnl: closed.pnl,
            });
          }
        }

        // ─── PAPER TRADER: abrir nueva posicion si hay setup ───
        const openCheck = shouldOpenPosition(result, paperTrades, paperConfig);
        if (openCheck.open) {
          const newTrade = createPaperTrade(result, paperAccount, paperConfig);
          if (newTrade) {
            paperTrades.push(newTrade);
            paperEvents.push({
              action: 'opened',
              symbol: newTrade.symbol,
              mode: newTrade.mode,
              side: newTrade.side,
              entry: newTrade.entryPrice,
              stop: newTrade.stopLoss,
              target: newTrade.takeProfit,
              size: newTrade.positionSize,
            });
          }
        }

        // ─── ALERTAS WhatsApp/Telegram ───
        const verdict = result.verdict;
        if (verdict !== 'long' && verdict !== 'short') {
          scanReport.push({
            symbol: entry.symbol,
            mode,
            status: 'no-setup',
            consensus: result.consensus.level,
            longScore: result.longScore,
            shortScore: result.shortScore,
          });
          continue;
        }

        const score = verdict === 'long' ? result.longScore : result.shortScore;
        if (score < settings.minScore) {
          scanReport.push({ symbol: entry.symbol, mode, status: 'below-threshold', score });
          continue;
        }

        // Solo alertar consensos A+ (filtro de calidad alta)
        if (result.consensus.level !== 'A+') {
          scanReport.push({
            symbol: entry.symbol,
            mode,
            status: 'below-consensus',
            consensus: result.consensus.level,
          });
          continue;
        }

        if (!notifyConfig.whatsapp && !notifyConfig.telegram) {
          scanReport.push({ symbol: entry.symbol, mode, status: 'no-channels' });
          continue;
        }

        const cooldownMin = COOLDOWN_BY_MODE[mode];
        const cooldownMs = cooldownMin * 60 * 1000;
        const recent = history.find(h =>
          h.symbol === entry.symbol &&
          (h as any).mode === mode &&
          h.side === verdict &&
          (Date.now() - h.sentAt) < cooldownMs
        );
        if (recent) {
          scanReport.push({
            symbol: entry.symbol,
            mode,
            status: 'cooldown',
          });
          continue;
        }

        const sendResults = await sendAlert(result, notifyConfig);
        const successChannels = sendResults.filter(r => r.success).map(r => r.channel);

        if (successChannels.length > 0) {
          history.push({
            symbol: entry.symbol,
            side: verdict,
            score,
            sentAt: Date.now(),
            channels: successChannels,
            mode,
          } as AlertHistoryEntry);
        }

        scanReport.push({
          symbol: entry.symbol,
          mode,
          status: 'alerted',
          verdict,
          score,
          consensus: result.consensus.level,
          channels: successChannels,
        });
      } catch (e: any) {
        scanReport.push({ symbol: entry.symbol, mode, status: 'error', error: e.message });
      }
    }
  }

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const cleanHistory = history.filter(h => h.sentAt > sevenDaysAgo);
  await writeJson(STORAGE_KEYS.alertHistory, cleanHistory);

  // Guardar estado del paper trader
  await Promise.all([
    savePaperAccount(paperAccount),
    savePaperTrades(paperTrades),
  ]);

  return NextResponse.json({
    ranAt: new Date(startedAt).toISOString(),
    durationMs: Date.now() - startedAt,
    scanned: enabled.length,
    report: scanReport,
    paper: {
      balance: paperAccount.balance,
      openPositions: paperTrades.filter(t => t.status === 'open').length,
      events: paperEvents,
    },
  });
}
