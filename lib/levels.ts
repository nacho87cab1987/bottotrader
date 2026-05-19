import { Kline } from './binance';

export type SRLevel = {
  price: number;
  type: 'support' | 'resistance';
  strength: number;
  lastTouch: number;
  distance: number;
};

export type FibLevel = {
  ratio: number;
  price: number;
  label: string;
  distance: number;
};

function findPivots(klines: Kline[], lookback = 5): { highs: number[]; lows: number[] } {
  const highs: number[] = [];
  const lows: number[] = [];

  for (let i = lookback; i < klines.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (klines[i].high <= klines[i - j].high || klines[i].high <= klines[i + j].high) isHigh = false;
      if (klines[i].low >= klines[i - j].low || klines[i].low >= klines[i + j].low) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) highs.push(i);
    if (isLow) lows.push(i);
  }

  return { highs, lows };
}

function clusterPivots(
  klines: Kline[],
  pivotIndices: number[],
  type: 'support' | 'resistance',
  tolerance = 0.015
): SRLevel[] {
  if (pivotIndices.length === 0) return [];

  const points = pivotIndices.map(i => ({
    price: type === 'support' ? klines[i].low : klines[i].high,
    timestamp: klines[i].openTime,
  }));

  points.sort((a, b) => a.price - b.price);

  const clusters: typeof points[] = [];
  let currentCluster: typeof points = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const lastInCluster = currentCluster[currentCluster.length - 1];
    if ((points[i].price - lastInCluster.price) / lastInCluster.price < tolerance) {
      currentCluster.push(points[i]);
    } else {
      clusters.push(currentCluster);
      currentCluster = [points[i]];
    }
  }
  clusters.push(currentCluster);

  const lastPrice = klines[klines.length - 1].close;
  const levels: SRLevel[] = clusters.map(cluster => {
    const avgPrice = cluster.reduce((sum, p) => sum + p.price, 0) / cluster.length;
    const lastTouch = Math.max(...cluster.map(p => p.timestamp));
    return {
      price: avgPrice,
      type,
      strength: cluster.length,
      lastTouch,
      distance: ((avgPrice - lastPrice) / lastPrice) * 100,
    };
  });

  return levels.sort((a, b) => b.strength - a.strength).slice(0, 5);
}

export function detectSupportResistance(klines: Kline[], lookback = 5): { supports: SRLevel[]; resistances: SRLevel[] } {
  if (klines.length < lookback * 3) {
    return { supports: [], resistances: [] };
  }

  const { highs, lows } = findPivots(klines, lookback);
  const lastPrice = klines[klines.length - 1].close;

  const allResistances = clusterPivots(klines, highs, 'resistance');
  const allSupports = clusterPivots(klines, lows, 'support');

  const supports = allSupports.filter(s => s.price < lastPrice).sort((a, b) => b.price - a.price).slice(0, 3);
  const resistances = allResistances.filter(r => r.price > lastPrice).sort((a, b) => a.price - b.price).slice(0, 3);

  return { supports, resistances };
}

export function calculateFibonacci(klines: Kline[], lookbackBars = 100): FibLevel[] {
  if (klines.length < lookbackBars) lookbackBars = klines.length;

  const recent = klines.slice(-lookbackBars);
  const high = Math.max(...recent.map(k => k.high));
  const low = Math.min(...recent.map(k => k.low));
  const lastPrice = klines[klines.length - 1].close;

  const highIdx = recent.findIndex(k => k.high === high);
  const lowIdx = recent.findIndex(k => k.low === low);
  const isUptrend = highIdx > lowIdx;

  const range = high - low;
  const ratios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

  return ratios.map(ratio => {
    const price = isUptrend ? high - range * ratio : low + range * ratio;
    return {
      ratio,
      price,
      label: ratio === 0 ? '0%' : ratio === 1 ? '100%' : `${(ratio * 100).toFixed(1)}%`,
      distance: ((price - lastPrice) / lastPrice) * 100,
    };
  });
}

export function getNearestSR(klines: Kline[]): { nearestSupport: SRLevel | null; nearestResistance: SRLevel | null } {
  const { supports, resistances } = detectSupportResistance(klines);
  return {
    nearestSupport: supports.length > 0 ? supports[0] : null,
    nearestResistance: resistances.length > 0 ? resistances[0] : null,
  };
}
