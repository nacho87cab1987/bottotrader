// Logica del modo Antivitalik
// Strategy: SHORT en BTC/ETH/ADA durante tendencia bajista,
// con escalado de balas en perdida y TP fijo en ganancia.

import type { Kline } from '../binance';
import { rsi } from '../indicators';
import type { PaperTrade } from './engine';

// ─── Configuracion del Antivitalik ───
export const ANTIVITALIK_CONFIG = {
  totalBalas: 30,           // divide capital en 30 balas
  leverage: 5,              // apalancamiento 5x
  initialBalas: 2,          // entrada con 2 balas
  rsiThreshold: 60,         // RSI 4H > 60 para entrar (rebote)
  greenCandlesNeeded: 3,    // 3 velas verdes 4H consecutivas
  evaluationHours: 24,      // evalua 1 vez por dia

  // Adds escalonados acumulativos sobre P&L apalancado del trade compuesto
  // Estado positivo o cada escalón negativo agrega N balas mas
  addsByLevel: {
    positive: 1,    // si P&L apalancado > 0% -> +1 bala
    minus5: 2,      // si P&L apalancado <= -5% -> +2 balas
    minus10: 3,     // si P&L apalancado <= -10% -> +3 balas
    minus15: 4,     // si P&L apalancado <= -15% -> +4 balas
    minus20: 6,     // si P&L apalancado <= -20% -> +6 balas (4 posicion + 2 margen)
  },

  takeProfitPct: 20,        // cierre con +20% apalancado promedio
  catastrophicStopPct: -50, // SL catastrofico oculto a -50% apalancado
  allowedSymbols: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'],
};

// ─── Detectar setup de entrada ───
export function detectAntivitalikSetup(
  symbol: string,
  klines4h: Kline[]
): { valid: boolean; reason: string } {
  // Solo BTC, ETH, ADA
  if (!ANTIVITALIK_CONFIG.allowedSymbols.includes(symbol)) {
    return { valid: false, reason: `${symbol} no esta en lista antivitalik` };
  }

  if (klines4h.length < 50) {
    return { valid: false, reason: 'klines 4h insuficientes' };
  }

  // 3 velas verdes consecutivas en 4H
  const lastCandles = klines4h.slice(-ANTIVITALIK_CONFIG.greenCandlesNeeded);
  const allGreen = lastCandles.every(k => k.close > k.open);
  if (!allGreen) {
    return { valid: false, reason: 'no hay 3 velas verdes 4h consecutivas' };
  }

  // RSI 4H > 60 (rebote claro / sobrecompra incipiente)
  const closes = klines4h.map(k => k.close);
  const rsiArr = rsi(closes, 14);
  const lastRsi = rsiArr[rsiArr.length - 1];
  if (isNaN(lastRsi) || lastRsi <= ANTIVITALIK_CONFIG.rsiThreshold) {
    return { valid: false, reason: `RSI 4H = ${lastRsi.toFixed(1)}, necesita > ${ANTIVITALIK_CONFIG.rsiThreshold}` };
  }

  return { valid: true, reason: `setup ok: 3 velas verdes + RSI 4H ${lastRsi.toFixed(1)}` };
}

// ─── Calcular tamano de bala ───
export function calculateBalaSize(balance: number): number {
  return balance / ANTIVITALIK_CONFIG.totalBalas;
}

// ─── Calcular P&L apalancado del trade compuesto ───
// Trades compuestos son todos los trades antivitalik del mismo par y misma serie
export function calculateCompoundPnl(
  trades: PaperTrade[],
  currentPrice: number
): { totalMargin: number; totalNotional: number; unrealizedPnl: number; pnlPctLeveraged: number; avgEntry: number } {
  const openAntivitalik = trades.filter(t =>
    t.mode === 'antivitalik' && t.status === 'open'
  );

  if (openAntivitalik.length === 0) {
    return { totalMargin: 0, totalNotional: 0, unrealizedPnl: 0, pnlPctLeveraged: 0, avgEntry: 0 };
  }

  let totalMargin = 0;
  let totalNotional = 0;
  let unrealizedPnl = 0;
  let weightedEntrySum = 0;

  for (const t of openAntivitalik) {
    totalMargin += t.marginUsed;
    totalNotional += t.positionSize;
    weightedEntrySum += t.entryPrice * t.positionSize;

    const units = t.positionSize / t.entryPrice;
    const tradePnl = t.side === 'long'
      ? (currentPrice - t.entryPrice) * units
      : (t.entryPrice - currentPrice) * units;
    unrealizedPnl += tradePnl;
  }

  const avgEntry = totalNotional > 0 ? weightedEntrySum / totalNotional : 0;
  const pnlPctLeveraged = totalMargin > 0 ? (unrealizedPnl / totalMargin) * 100 : 0;

  return { totalMargin, totalNotional, unrealizedPnl, pnlPctLeveraged, avgEntry };
}

// ─── Decidir si agregar balas hoy ───
// Devuelve cuantas balas agregar, o 0 si no toca add
export function decideAddBalas(
  pnlPctLeveraged: number,
  lastAddTimeMs: number
): { add: boolean; balas: number; reason: string } {
  // Cooldown 24h entre adds
  const hoursSinceLastAdd = (Date.now() - lastAddTimeMs) / 3600000;
  if (hoursSinceLastAdd < ANTIVITALIK_CONFIG.evaluationHours) {
    return { add: false, balas: 0, reason: `cooldown ${hoursSinceLastAdd.toFixed(1)}h < 24h` };
  }

  const { addsByLevel } = ANTIVITALIK_CONFIG;

  // Por orden de severidad (peor primero)
  if (pnlPctLeveraged <= -20) {
    return { add: true, balas: addsByLevel.minus20, reason: `P&L ${pnlPctLeveraged.toFixed(1)}%, agregar ${addsByLevel.minus20} balas` };
  }
  if (pnlPctLeveraged <= -15) {
    return { add: true, balas: addsByLevel.minus15, reason: `P&L ${pnlPctLeveraged.toFixed(1)}%, agregar ${addsByLevel.minus15} balas` };
  }
  if (pnlPctLeveraged <= -10) {
    return { add: true, balas: addsByLevel.minus10, reason: `P&L ${pnlPctLeveraged.toFixed(1)}%, agregar ${addsByLevel.minus10} balas` };
  }
  if (pnlPctLeveraged <= -5) {
    return { add: true, balas: addsByLevel.minus5, reason: `P&L ${pnlPctLeveraged.toFixed(1)}%, agregar ${addsByLevel.minus5} balas` };
  }
  if (pnlPctLeveraged > 0) {
    return { add: true, balas: addsByLevel.positive, reason: `P&L ${pnlPctLeveraged.toFixed(1)}% positivo, agregar ${addsByLevel.positive} bala` };
  }

  return { add: false, balas: 0, reason: `P&L ${pnlPctLeveraged.toFixed(1)}% en zona neutral (-5 a 0%)` };
}

// ─── Decidir si cerrar trade compuesto ───
export function shouldCloseCompound(
  pnlPctLeveraged: number
): { close: boolean; reason: 'tp_hit' | 'sl_hit' | null } {
  if (pnlPctLeveraged >= ANTIVITALIK_CONFIG.takeProfitPct) {
    return { close: true, reason: 'tp_hit' };
  }
  if (pnlPctLeveraged <= ANTIVITALIK_CONFIG.catastrophicStopPct) {
    return { close: true, reason: 'sl_hit' };
  }
  return { close: false, reason: null };
}

// ─── Obtener el timestamp del ultimo add para un par ───
export function getLastAddTime(trades: PaperTrade[], symbol: string): number {
  const openOrRecent = trades.filter(t =>
    t.mode === 'antivitalik' && t.symbol === symbol
  );
  if (openOrRecent.length === 0) return 0;

  // El timestamp mas reciente de entryTime de los trades de este par
  return Math.max(...openOrRecent.map(t => t.entryTime));
}
