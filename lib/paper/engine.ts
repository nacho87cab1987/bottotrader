import type { AnalysisResult, AnalysisMode } from '../scoring';

export type PaperTrade = {
  id: string;
  symbol: string;
  mode: AnalysisMode;
  side: 'long' | 'short';
  status: 'open' | 'closed';
  entryPrice: number;
  entryTime: number;
  entryScore: number;
  entryConsensus: string;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  marginUsed: number;
  leverage: number;
  riskAmount: number;
  exitPrice?: number;
  exitTime?: number;
  exitReason?: 'tp_hit' | 'sl_hit' | 'manual' | 'timeout';
  pnl?: number;
  pnlPercent?: number;
  feesPaid?: number;
  snapshot: {
    rsi: number;
    fearGreed: number | null;
    priceChange24h: number;
  };
};

export type PaperAccount = {
  balance: number;
  initialBalance: number;
  totalTrades: number;
  openTrades: number;
  totalPnl: number;
  totalFees: number;
  peakBalance: number;
  maxDrawdown: number;
  createdAt: number;
  lastUpdated: number;
};

export type PaperConfig = {
  initialBalance: number;
  riskPerTrade: number;
  feeRate: number;
  slippage: number;
  maxOpenPositionsPerMode: number;
  maxHoldHours: { swing: number; intraday: number };
};

export const DEFAULT_PAPER_CONFIG: PaperConfig = {
  initialBalance: 1000,
  riskPerTrade: 0.02,
  feeRate: 0.0006,
  slippage: 0.0005,
  maxOpenPositionsPerMode: 5,
  maxHoldHours: { swing: 168, intraday: 24 },
};

export function shouldOpenPosition(
  result: AnalysisResult,
  openTrades: PaperTrade[],
  config: PaperConfig
): { open: boolean; reason: string } {
  if (result.verdict !== 'long' && re
