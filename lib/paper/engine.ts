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
  maxHoldHours: { swing: number; intraday: number; antivitalik: number };
};

export const DEFAULT_PAPER_CONFIG: PaperConfig = {
  initialBalance: 1000,
  riskPerTrade: 0.02,
  feeRate: 0.0006,
  slippage: 0.0005,
  maxOpenPositionsPerMode: 5,
  maxHoldHours: { swing: 168, intraday: 24, antivitalik: 720 },
};

export function shouldOpenPosition(
  result: AnalysisResult,
  openTrades: PaperTrade[],
  config: PaperConfig
): { open: boolean; reason: string } {
  if (result.verdict !== 'long' && result.verdict !== 'short') {
    return { open: false, reason: 'no setup' };
  }
  if (result.consensus.level !== 'A+' && result.consensus.level !== 'A') {
    return { open: false, reason: 'consenso insuficiente' };
  }
  const duplicate = openTrades.find(t =>
    t.symbol === result.symbol && t.mode === result.mode &&
    t.side === result.verdict && t.status === 'open'
  );
  if (duplicate) return { open: false, reason: 'duplicada' };
  const sameModeOpen = openTrades.filter(t => t.mode === result.mode && t.status === 'open').length;
  if (sameModeOpen >= config.maxOpenPositionsPerMode) {
    return { open: false, reason: 'limite alcanzado' };
  }
  if (result.verdict === 'long' && !result.levels?.nearestSupport) {
    return { open: false, reason: 'sin soporte' };
  }
  if (result.verdict === 'short' && !result.levels?.nearestResistance) {
    return { open: false, reason: 'sin resistencia' };
  }
  return { open: true, reason: 'ok' };
}

export function createPaperTrade(
  result: AnalysisResult,
  account: PaperAccount,
  config: PaperConfig
): PaperTrade | null {
  if (result.verdict !== 'long' && result.verdict !== 'short') return null;
  const side = result.verdict;
  const entryPriceRaw = result.price;
  const entryPrice = side === 'long'
    ? entryPriceRaw * (1 + config.slippage)
    : entryPriceRaw * (1 - config.slippage);

  let stopLoss: number;
  let takeProfit: number;

  if (result.mode === 'intraday') {
    const stopDistancePct = 0.01;
    if (side === 'long') {
      stopLoss = entryPrice * (1 - stopDistancePct);
      const risk = entryPrice - stopLoss;
      takeProfit = entryPrice + (risk * 1.5);
    } else {
      stopLoss = entryPrice * (1 + stopDistancePct);
      const risk = stopLoss - entryPrice;
      takeProfit = entryPrice - (risk * 1.5);
    }
  } else {
    if (side === 'long') {
      stopLoss = result.levels.nearestSupport!.price;
      if (result.levels.resistances.length > 0) {
        takeProfit = result.levels.resistances[0].price;
      } else {
        const risk = entryPrice - stopLoss;
        takeProfit = entryPrice + (risk * 2);
      }
    } else {
      stopLoss = result.levels.nearestResistance!.price;
      if (result.levels.supports.length > 0) {
        takeProfit = result.levels.supports[0].price;
      } else {
        const risk = stopLoss - entryPrice;
        takeProfit = entryPrice - (risk * 2);
      }
    }
  }

  if (side === 'long' && (stopLoss >= entryPrice || takeProfit <= entryPrice)) return null;
  if (side === 'short' && (stopLoss <= entryPrice || takeProfit >= entryPrice)) return null;

  const riskAmount = account.balance * config.riskPerTrade;
  const stopDistance = Math.abs(entryPrice - stopLoss);
  const stopDistancePct = stopDistance / entryPrice;
  const positionSize = riskAmount / stopDistancePct;

  if (positionSize > account.balance * 5) return null;

  return {
    id: `${result.symbol}-${result.mode}-${side}-${Date.now()}`,
    symbol: result.symbol,
    mode: result.mode,
    side,
    status: 'open',
    entryPrice,
    entryTime: Date.now(),
    entryScore: side === 'long' ? result.longScore : result.shortScore,
    entryConsensus: result.consensus.level,
    stopLoss,
    takeProfit,
    positionSize,
    marginUsed: positionSize,
    leverage: 1,
    riskAmount,
    snapshot: {
      rsi: result.indicators.rsi,
      fearGreed: result.context.fearGreed,
      priceChange24h: result.priceChange24h,
    },
  };
}

export function evaluateOpenTrade(
  trade: PaperTrade,
  currentPrice: number,
  config: PaperConfig
): { close: boolean; reason: PaperTrade['exitReason']; exitPrice: number } | null {
  if (trade.status !== 'open') return null;
  const maxHoldMs = config.maxHoldHours[trade.mode] * 60 * 60 * 1000;
  if (Date.now() - trade.entryTime > maxHoldMs) {
    return { close: true, reason: 'timeout', exitPrice: currentPrice };
  }
  if (trade.side === 'long') {
    if (currentPrice <= trade.stopLoss) {
      return { close: true, reason: 'sl_hit', exitPrice: trade.stopLoss * (1 - config.slippage) };
    }
    if (currentPrice >= trade.takeProfit) {
      return { close: true, reason: 'tp_hit', exitPrice: trade.takeProfit * (1 - config.slippage) };
    }
  } else {
    if (currentPrice >= trade.stopLoss) {
      return { close: true, reason: 'sl_hit', exitPrice: trade.stopLoss * (1 + config.slippage) };
    }
    if (currentPrice <= trade.takeProfit) {
      return { close: true, reason: 'tp_hit', exitPrice: trade.takeProfit * (1 + config.slippage) };
    }
  }
  return { close: false, reason: undefined as any, exitPrice: 0 };
}

export function closePaperTrade(
  trade: PaperTrade,
  exitPrice: number,
  exitReason: PaperTrade['exitReason'],
  config: PaperConfig
): PaperTrade {
  const units = trade.positionSize / trade.entryPrice;
  const grossPnl = trade.side === 'long'
    ? (exitPrice - trade.entryPrice) * units
    : (trade.entryPrice - exitPrice) * units;
  const entryFee = trade.positionSize * config.feeRate;
  const exitNotional = exitPrice * units;
  const exitFee = exitNotional * config.feeRate;
  const totalFees = entryFee + exitFee;
  const netPnl = grossPnl - totalFees;
  const pnlPercent = (netPnl / trade.positionSize) * 100;
  return {
    ...trade,
    status: 'closed',
    exitPrice,
    exitTime: Date.now(),
    exitReason,
    pnl: netPnl,
    pnlPercent,
    feesPaid: totalFees,
  };
}

export function createInitialAccount(initialBalance: number): PaperAccount {
  return {
    balance: initialBalance,
    initialBalance,
    totalTrades: 0,
    openTrades: 0,
    totalPnl: 0,
    totalFees: 0,
    peakBalance: initialBalance,
    maxDrawdown: 0,
    createdAt: Date.now(),
    lastUpdated: Date.now(),
  };
}

export function updateAccountAfterClose(account: PaperAccount, closedTrade: PaperTrade): PaperAccount {
  if (closedTrade.pnl === undefined) return account;
  const newBalance = account.balance + closedTrade.pnl;
  const peakBalance = Math.max(account.peakBalance, newBalance);
  const drawdown = peakBalance > 0 ? ((peakBalance - newBalance) / peakBalance) * 100 : 0;
  const maxDrawdown = Math.max(account.maxDrawdown, drawdown);
  return {
    ...account,
    balance: newBalance,
    totalPnl: account.totalPnl + closedTrade.pnl,
    totalFees: account.totalFees + (closedTrade.feesPaid || 0),
    peakBalance,
    maxDrawdown,
    lastUpdated: Date.now(),
  };
}
