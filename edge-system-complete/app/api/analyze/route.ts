import { NextRequest, NextResponse } from 'next/server';
import { fetchKlines, fetchFundingRate, fetchLongShortRatio } from '@/lib/binance';
import { fetchFearGreed, fetchGlobalData } from '@/lib/sentiment';
import { analyzeMarket, AnalysisMode } from '@/lib/scoring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TF_CONFIG: Record<AnalysisMode, { trigger: string; setup: string; macro: string }> = {
  swing: { trigger: '4h', setup: '1d', macro: '1w' },
  intraday: { trigger: '15m', setup: '1h', macro: '4h' },
};

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')?.toUpperCase() || 'BTCUSDT';
  const modeParam = req.nextUrl.searchParams.get('mode');
  const mode: AnalysisMode = modeParam === 'intraday' ? 'intraday' : 'swing';

  const tfs = TF_CONFIG[mode];

  try {
    const [klinesTrigger, klinesSetup, klinesMacro, funding, longShort, fg, global] = await Promise.all([
      fetchKlines(symbol, tfs.trigger, 300),
      fetchKlines(symbol, tfs.setup, 300),
      fetchKlines(symbol, tfs.macro, 200),
      fetchFundingRate(symbol),
      fetchLongShortRatio(symbol),
      fetchFearGreed(),
      fetchGlobalData(),
    ]);

    const minKlines = mode === 'intraday' ? 50 : 100;
    if (klinesSetup.length < minKlines || klinesTrigger.length < minKlines) {
      return NextResponse.json({
        error: `Datos insuficientes para ${symbol} en modo ${mode}. Setup: ${klinesSetup.length}, Trigger: ${klinesTrigger.length}.`,
      }, { status: 400 });
    }

    const result = analyzeMarket(symbol, klinesTrigger, klinesSetup, klinesMacro, {
      fearGreed: fg?.value ?? null,
      fearGreedLabel: fg?.classification ?? null,
      funding,
      longShortRatio: longShort,
      btcDominance: global?.btcDominance ?? null,
    }, mode);

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error al analizar' }, { status: 500 });
  }
}
