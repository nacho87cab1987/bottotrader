import { Kline } from './binance';
import { ema, rsi, macd, detectCrossover, volumeStrength } from './indicators';

export type TimeframeBias = 'bullish' | 'bearish' | 'neutral';

export type TimeframeAnalysis = {
  timeframe: string;
  bias: TimeframeBias;
  strength: number;
  price: number;
  indicators: {
    rsi: number;
    ema50: number;
    ema200: number;
    macdHist: number;
    macdCross: 'bullish' | 'bearish' | 'none';
    volumeRatio: number;
    distEma50Pct: number;
    distEma200Pct: number;
  };
  reasons: string[];
};

export function analyzeTimeframe(timeframe: string, klines: Kline[]): TimeframeAnalysis {
  const closes = klines.map(k => k.close);
  const volumes = klines.map(k => k.volume);

  const lastPrice = closes[closes.length - 1];
  const ema50Arr = ema(closes, 50);
  const ema200Arr = ema(closes, 200);
  const rsiArr = rsi(closes, 14);
  const { macdLine, signalLine, histogram } = macd(closes);
  const vol = volumeStrength(volumes, 20);

  const ema50Val = ema50Arr[ema50Arr.length - 1];
  const ema200Val = ema200Arr[ema200Arr.length - 1];
  const lastRsi = rsiArr[rsiArr.length - 1];
  const lastHist = histogram[histogram.length - 1];
  const macdCross = detectCrossover(macdLine, signalLine, 3);

  const distEma50 = ema50Val ? ((lastPrice - ema50Val) / ema50Val) * 100 : 0;
  const distEma200 = ema200Val ? ((lastPrice - ema200Val) / ema200Val) * 100 : 0;

  let bullishPoints = 0;
  let bearishPoints = 0;
  const reasons: string[] = [];

  if (lastPrice > ema50Val && ema50Val > ema200Val) {
    bullishPoints += 30;
    reasons.push('Precio > EMA50 > EMA200 (tendencia alcista)');
  } else if (lastPrice < ema50Val && ema50Val < ema200Val) {
    bearishPoints += 30;
    reasons.push('Precio < EMA50 < EMA200 (tendencia bajista)');
  } else if (lastPrice > ema200Val) {
    bullishPoints += 10;
    reasons.push('Precio sobre EMA200 (estructura alcista)');
  } else if (lastPrice < ema200Val) {
    bearishPoints += 10;
    reasons.push('Precio bajo EMA200 (estructura bajista)');
  }

  if (macdCross === 'bullish' || (lastHist > 0 && lastHist > histogram[histogram.length - 2])) {
    bullishPoints += 20;
    reasons.push(macdCross === 'bullish' ? 'MACD cruce alcista reciente' : 'MACD histograma creciente');
  } else if (macdCross === 'bearish' || (lastHist < 0 && lastHist < histogram[histogram.length - 2])) {
    bearishPoints += 20;
    reasons.push(macdCross === 'bearish' ? 'MACD cruce bajista reciente' : 'MACD histograma decreciente');
  }

  if (lastRsi > 50 && lastRsi < 70) {
    bullishPoints += 15;
    reasons.push(`RSI ${lastRsi.toFixed(1)} (zona bullish saludable)`);
  } else if (lastRsi < 50 && lastRsi > 30) {
    bearishPoints += 15;
    reasons.push(`RSI ${lastRsi.toFixed(1)} (zona bearish saludable)`);
  } else if (lastRsi >= 70) {
    bearishPoints += 5;
    reasons.push(`RSI ${lastRsi.toFixed(1)} (sobrecompra)`);
  } else if (lastRsi <= 30) {
    bullishPoints += 5;
    reasons.push(`RSI ${lastRsi.toFixed(1)} (sobreventa)`);
  }

  const lastChange = closes.length >= 2 ? (closes[closes.length - 1] - closes[closes.length - 2]) : 0;
  if (vol.ratio > 1.3 && lastChange > 0) {
    bullishPoints += 10;
    reasons.push(`Volumen ${vol.ratio.toFixed(2)}x con vela verde`);
  } else if (vol.ratio > 1.3 && lastChange < 0) {
    bearishPoints += 10;
    reasons.push(`Volumen ${vol.ratio.toFixed(2)}x con vela roja`);
  }

  const total = bullishPoints + bearishPoints;
  let bias: TimeframeBias = 'neutral';
  let strength = 0;

  if (total > 0) {
    const ratio = bullishPoints / total;
    if (ratio > 0.65) {
      bias = 'bullish';
      strength = Math.min(100, bullishPoints);
    } else if (ratio < 0.35) {
      bias = 'bearish';
      strength = Math.min(100, bearishPoints);
    } else {
      bias = 'neutral';
      strength = Math.max(bullishPoints, bearishPoints);
    }
  }

  return {
    timeframe,
    bias,
    strength,
    price: lastPrice,
    indicators: {
      rsi: lastRsi,
      ema50: ema50Val,
      ema200: ema200Val,
      macdHist: lastHist,
      macdCross,
      volumeRatio: vol.ratio,
      distEma50Pct: distEma50,
      distEma200Pct: distEma200,
    },
    reasons,
  };
}
