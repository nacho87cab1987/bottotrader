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
  positionSize: number;  // notional total (margin * leverage)
  marginUsed: number;     // margen real bloqueado
  leverage: number;       // 1 (sin apalancamiento), 5 (antivitalik), etc
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
  maxHoldHours: {
    swing: 168,
    intraday: 24,
    antivitalik: 48,
  },
};

// Configuracion por modo: leverage y reglas de SL/TP
function getModeConfig(mode: AnalysisMode) {
  if (mode === 'antivitalik') {
    return {
      leverage: 5,
      slPricePct: 0.06,  // 6% del precio
      tpPricePct: 0.04,  // 4% del precio
      maxOpenInMode: 3,
    };
  }
  if (mode === 'intraday') {
    return {
      leverage: 1,
      slPricePct: 0.01,
      tpPricePct: 0.015,  // R:R 1:1.5
      maxOpenInMode: 5,
    };
  }
  // swing: usa niveles S/R (no fijos)
  return {
    leverage: 1,
    slPricePct: null,
    tpPricePct: null,
    maxOpenInMode: 5,
  };
}

export function shouldOpenPosition(
  result: AnalysisResult,
  openTrades: PaperTrade[],
  config: PaperConfig
): { open: boolean; reason: string } {
  if (result.verdict !== 'long' && result.verdict !== 'short') {
    return { open: false, reason: `verdict ${result.verdict}` };
  }

  const modeConf = getModeConfig(result.mode);

  // ─── REGLAS ESPECIFICAS DE ANTIVITALIK ───
  if (result.mode === 'antivitalik') {
    // Solo consenso A+ (no A normal)
    if (result.consensus.level !== 'A+') {
      return { open: false, reason: `antivitalik requiere A+, tiene ${result.consensus.level}` };
    }

    // Fear & Greed en extremos
    const fg = result.context.fearGreed;
    if (fg === null) {
      return { open: false, reason: 'antivitalik requiere F&G y no esta disponible' };
    }
    if (result.verdict === 'long' && fg >= 25) {
      return { open: false, reason: `long antivitalik requiere F&G<25, tiene ${fg}` };
    }
    if (result.verdict === 'short' && fg <= 75) {
      return { open: false, reason: `short antivitalik requiere F&G>75, tiene ${fg}` };
    }

    // Cooldown 12h entre trades del mismo par en antivitalik
    const recentSamePair = openTrades.filter(t =>
      t.symbol === result.symbol && t.mode === 'antivitalik'
    );
    // Tambien deberiamos chequear trades cerrados recientes pero eso lo
    // hacemos en el cron usando alert history o creamos otro mecanismo
    if (recentSamePair.length > 0) {
      return { open: false, reason: 'ya hay posicion antivitalik en este par' };
    }
  } else {
    // Modos no-antivitalik: A+ o A
    if (result.consensus.level !== 'A+' && result.consensus.level !== 'A') {
      return { open: false, reason: `consenso ${result.consensus.level} insuficiente` };
    }
  }

  // ─── REGLAS COMUNES A TODOS LOS MODOS ───
  const duplicate = openTrades.find(t =>
    t.symbol === result.symbol &&
    t.mode === result.mode &&
    t.side === result.verdict &&
    t.status === 'open'
  );
  if (duplicate) {
    return { open: false, reason: 'posicion duplicada' };
  }

  const sameModeOpen = openTrades.filter(t => t.mode === result.mode && t.status === 'open').length;
  if (sameModeOpen >= modeConf.maxOpenInMode) {
    return { open: false, reason: `limite de ${modeConf.maxOpenInMode} posiciones en modo ${result.mode}` };
  }

  // Para swing necesitamos niveles S/R. Para otros modos usamos % fijo
  if (result.mode === 'swing') {
    if (result.verdict === 'long' && !result.levels?.nearestSupport) {
      return { open: false, reason: 'sin soporte detectado para stop' };
    }
    if (result.verdict === 'short' && !result.levels?.nearestResistance) {
      return { open: false, reason: 'sin resistencia detectada para stop' };
    }
  }

  return { open: true, reason: 'setup valido' };
}

export function createPaperTrade(
  result: AnalysisResult,
  account: PaperAccount,
  config: PaperConfig
): PaperTrade | null {
  if (result.verdict !== 'long' && result.verdict !== 'short') return null;

  const side = result.verdict;
  const modeConf = getModeConfig(result.mode);
  const leverage = modeConf.leverage;

  const entryPriceRaw = result.price;
  const entryPrice = side === 'long'
    ? entryPriceRaw * (1 + config.slippage)
    : entryPriceRaw * (1 - config.slippage);

  let stopLoss: number;
  let takeProfit: number;

  // Calcular SL y TP segun modo
  if (modeConf.slPricePct !== null && modeConf.tpPricePct !== null) {
    // Modo con stops/targets en % fijos (antivitalik, intraday)
    if (side === 'long') {
      stopLoss = entryPrice * (1 - modeConf.slPricePct);
      takeProfit = entryPrice * (1 + modeConf.tpPricePct);
    } else {
      stopLoss = entryPrice * (1 + modeConf.slPricePct);
      takeProfit = entryPrice * (1 - modeConf.tpPricePct);
    }
  } else {
    // Swing: usa niveles S/R detectados
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

  // Risk amount fijo segun config
  const riskAmount = account.balance * config.riskPerTrade;
  const stopDistance = Math.abs(entryPrice - stopLoss);
  const stopDistancePct = stopDistance / entryPrice;

  // Notional calculado para que SI el stop salta perdamos riskAmount
  const positionSize = riskAmount / stopDistancePct;
  const marginUsed = positionSize / leverage;

  // El margen usado no puede superar el balance disponible
  if (marginUsed > account.balance * 0.8) {
    return null; // protegemos contra usar mas del 80% del balance en un trade
  }

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
    marginUsed,
    leverage,
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

  // Fees calculadas sobre el notional (no sobre el margen). Asi opera BingX real
  const entryFee = trade.positionSize * config.feeRate;
  const exitNotional = exitPrice * units;
  const exitFee = exitNotional * config.feeRate;
  const totalFees = entryFee + exitFee;

  const netPnl = grossPnl - totalFees;
  // pnlPercent sobre el margen usado, no sobre notional
  const pnlPercent = (netPnl / trade.marginUsed) * 100;

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
