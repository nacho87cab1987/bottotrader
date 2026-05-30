import type { PaperTrade } from './engine';
import type { AnalysisMode } from '../scoring';

export type PaperStats = {
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  totalFees: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  largestWin: number;
  largestLoss: number;
  avgHoldHours: number;
  bySide: {
    long: { count: number; pnl: number; winRate: number };
    short: { count: number; pnl: number; winRate: number };
  };
  byMode: {
    swing: { count: number; pnl: number; winRate: number };
    intraday: { count: number; pnl: number; winRate: number };
    antivitalik: { count: number; pnl: number; winRate: number };
  };
};

export function calculateStats(trades: PaperTrade[]): PaperStats {
  const closed = trades.filter(t => t.status === 'closed' && t.pnl !== undefined);
  const total = closed.length;

  const emptyResult: PaperStats = {
    total: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalPnl: 0,
    totalFees: 0,
    avgWin: 0,
    avgLoss: 0,
    profitFactor: 0,
    largestWin: 0,
    largestLoss: 0,
    avgHoldHours: 0,
    bySide: {
      long: { count: 0, pnl: 0, winRate: 0 },
      short: { count: 0, pnl: 0, winRate: 0 },
    },
    byMode: {
      swing: { count: 0, pnl: 0, winRate: 0 },
      intraday: { count: 0, pnl: 0, winRate: 0 },
      antivitalik: { count: 0, pnl: 0, winRate: 0 },
    },
  };

  if (total === 0) return emptyResult;

  const wins = closed.filter(t => (t.pnl || 0) > 0);
  const losses = closed.filter(t => (t.pnl || 0) <= 0);
  const winRate = (wins.length / total) * 100;
  const totalPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);
  const totalFees = closed.reduce((s, t) => s + (t.feesPaid || 0), 0);
  const totalWinsAmount = wins.reduce((s, t) => s + (t.pnl || 0), 0);
  const totalLossesAmount = Math.abs(losses.reduce((s, t) => s + (t.pnl || 0), 0));
  const avgWin = wins.length > 0 ? totalWinsAmount / wins.length : 0;
  const avgLoss = losses.length > 0 ? totalLossesAmount / losses.length : 0;
  const profitFactor = totalLossesAmount > 0
    ? totalWinsAmount / totalLossesAmount
    : (totalWinsAmount > 0 ? 999 : 0);
  const largestWin = wins.length > 0 ? Math.max(...wins.map(t => t.pnl || 0)) : 0;
  const largestLoss = losses.length > 0 ? Math.min(...losses.map(t => t.pnl || 0)) : 0;
  const avgHoldHours = closed.reduce((s, t) => s + ((t.exitTime! - t.entryTime) / 3600000), 0) / total;

  const longs = closed.filter(t => t.side === 'long');
  const shorts = closed.filter(t => t.side === 'short');
  const swings = closed.filter(t => t.mode === 'swing');
  const intradays = closed.filter(t => t.mode === 'intraday');
  const antivitaliks = closed.filter(t => t.mode === 'antivitalik');

  const calcGroup = (group: PaperTrade[]) => ({
    count: group.length,
    pnl: group.reduce((s, t) => s + (t.pnl || 0), 0),
    winRate: group.length > 0
      ? (group.filter(t => (t.pnl || 0) > 0).length / group.length) * 100
      : 0,
  });

  return {
    total,
    wins: wins.length,
    losses: losses.length,
    winRate,
    totalPnl,
    totalFees,
    avgWin,
    avgLoss,
    profitFactor,
    largestWin,
    largestLoss,
    avgHoldHours,
    bySide: {
      long: calcGroup(longs),
      short: calcGroup(shorts),
    },
    byMode: {
      swing: calcGroup(swings),
      intraday: calcGroup(intradays),
      antivitalik: calcGroup(antivitaliks),
    },
  };
}

export function filterByMode(trades: PaperTrade[], mode: AnalysisMode): PaperTrade[] {
  return trades.filter(t => t.mode === mode);
}
