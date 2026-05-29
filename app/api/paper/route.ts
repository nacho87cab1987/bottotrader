import { NextRequest, NextResponse } from 'next/server';
import {
  getPaperAccount, savePaperAccount,
  getPaperTrades, savePaperTrades,
  getPaperConfig, savePaperConfig,
  resetPaperAccount,
} from '../../../lib/paper/store';
import {
  closePaperTrade, updateAccountAfterClose,
} from '../../../lib/paper/engine';
import { calculateStats } from '../../../lib/paper/stats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const [account, trades, config] = await Promise.all([
    getPaperAccount(),
    getPaperTrades(),
    getPaperConfig(),
  ]);

  const openTrades = trades.filter(t => t.status === 'open');
  const closedTrades = trades.filter(t => t.status === 'closed');
  const stats = calculateStats(trades);

  const accountWithOpenCount = { ...account, openTrades: openTrades.length };

  return NextResponse.json({
    account: accountWithOpenCount,
    config,
    stats,
    openTrades: openTrades.sort((a, b) => b.entryTime - a.entryTime),
    closedTrades: closedTrades.sort((a, b) => (b.exitTime || 0) - (a.exitTime || 0)).slice(0, 50),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.action === 'reset') {
    const initial = typeof body.initialBalance === 'number' ? body.initialBalance : undefined;
    await resetPaperAccount(initial);
    return NextResponse.json({ ok: true, message: 'Cuenta reiniciada' });
  }

  if (body.action === 'closeManual') {
    const tradeId = body.tradeId;
    const currentPrice = body.currentPrice;
    if (!tradeId || typeof currentPrice !== 'number') {
      return NextResponse.json({ error: 'tradeId y currentPrice requeridos' }, { status: 400 });
    }

    const trades = await getPaperTrades();
    const idx = trades.findIndex(t => t.id === tradeId);
    if (idx === -1) return NextResponse.json({ error: 'trade no encontrado' }, { status: 404 });
    if (trades[idx].status !== 'open') return NextResponse.json({ error: 'trade no esta abierto' }, { status: 400 });

    const config = await getPaperConfig();
    const closed = closePaperTrade(trades[idx], currentPrice, 'manual', config);
    trades[idx] = closed;

    const account = await getPaperAccount();
    const updatedAccount = updateAccountAfterClose(account, closed);

    await Promise.all([savePaperTrades(trades), savePaperAccount(updatedAccount)]);

    return NextResponse.json({ ok: true, trade: closed, account: updatedAccount });
  }

  if (body.action === 'updateConfig') {
    const config = await getPaperConfig();
    const updated = {
      ...config,
      ...(typeof body.riskPerTrade === 'number' ? { riskPerTrade: body.riskPerTrade } : {}),
      ...(typeof body.initialBalance === 'number' ? { initialBalance: body.initialBalance } : {}),
    };
    await savePaperConfig(updated);
    return NextResponse.json({ ok: true, config: updated });
  }

  return NextResponse.json({ error: 'action invalida' }, { status: 400 });
}
