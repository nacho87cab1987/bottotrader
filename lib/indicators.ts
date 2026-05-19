export function sma(values: number[], period: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { out.push(NaN); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    out.push(sum / period);
  }
  return out;
}

export function ema(values: number[], period: number): number[] {
  const out: number[] = [];
  const k = 2 / (period + 1);
  let prev = NaN;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { out.push(NaN); continue; }
    if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j <= i; j++) sum += values[j];
      prev = sum / period;
      out.push(prev);
      continue;
    }
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function rsi(values: number[], period = 14): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (values.length < period + 1) return out;

  let gainSum = 0, lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gainSum += diff;
    else lossSum -= diff;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function macd(values: number[], fast = 12, slow = 26, signal = 9) {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine = values.map((_, i) => {
    if (isNaN(emaFast[i]) || isNaN(emaSlow[i])) return NaN;
    return emaFast[i] - emaSlow[i];
  });
  const validMacd = macdLine.filter(v => !isNaN(v));
  const signalRaw = ema(validMacd, signal);
  const offset = macdLine.length - validMacd.length;
  const signalLine: number[] = new Array(macdLine.length).fill(NaN);
  for (let i = 0; i < signalRaw.length; i++) signalLine[i + offset] = signalRaw[i];

  const histogram = macdLine.map((v, i) => {
    if (isNaN(v) || isNaN(signalLine[i])) return NaN;
    return v - signalLine[i];
  });
  return { macdLine, signalLine, histogram };
}

export function detectCrossover(line1: number[], line2: number[], lookback = 3): 'bullish' | 'bearish' | 'none' {
  const n = line1.length;
  for (let i = n - lookback; i < n; i++) {
    if (i < 1) continue;
    const a1 = line1[i - 1], a2 = line1[i];
    const b1 = line2[i - 1], b2 = line2[i];
    if (isNaN(a1) || isNaN(a2) || isNaN(b1) || isNaN(b2)) continue;
    if (a1 <= b1 && a2 > b2) return 'bullish';
    if (a1 >= b1 && a2 < b2) return 'bearish';
  }
  return 'none';
}

export function volumeStrength(volumes: number[], period = 20): { current: number; avg: number; ratio: number } {
  const recent = volumes[volumes.length - 1];
  const slice = volumes.slice(-period);
  const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
  return { current: recent, avg, ratio: recent / avg };
}
