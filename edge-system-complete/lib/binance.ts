import { withCache, ttlForInterval } from './cache';

const BASE = 'https://api.coingecko.com/api/v3';

export type Kline = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
};

const SYMBOL_TO_COIN_ID: Record<string, string> = {
  BTCUSDT: 'bitcoin',
  ETHUSDT: 'ethereum',
  SOLUSDT: 'solana',
  BNBUSDT: 'binancecoin',
  XRPUSDT: 'ripple',
  ADAUSDT: 'cardano',
  DOGEUSDT: 'dogecoin',
  AVAXUSDT: 'avalanche-2',
  LINKUSDT: 'chainlink',
  DOTUSDT: 'polkadot',
  MATICUSDT: 'matic-network',
  LTCUSDT: 'litecoin',
  UNIUSDT: 'uniswap',
  ATOMUSDT: 'cosmos',
  NEARUSDT: 'near',
  APTUSDT: 'aptos',
  ARBUSDT: 'arbitrum',
  OPUSDT: 'optimism',
  SUIUSDT: 'sui',
  INJUSDT: 'injective-protocol',
  TIAUSDT: 'celestia',
  SEIUSDT: 'sei-network',
  RNDRUSDT: 'render-token',
  FETUSDT: 'fetch-ai',
  ICPUSDT: 'internet-computer',
  FILUSDT: 'filecoin',
  HBARUSDT: 'hedera-hashgraph',
  VETUSDT: 'vechain',
  TRXUSDT: 'tron',
  BCHUSDT: 'bitcoin-cash',
  ETCUSDT: 'ethereum-classic',
  XLMUSDT: 'stellar',
  ALGOUSDT: 'algorand',
  AAVEUSDT: 'aave',
  MKRUSDT: 'maker',
};

function symbolToCoinId(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (SYMBOL_TO_COIN_ID[upper]) return SYMBOL_TO_COIN_ID[upper];
  return upper.replace(/USDT$/, '').toLowerCase();
}

async function fetchKlinesFromMarketChart(coinId: string, days: number, bucketMs: number): Promise<Kline[]> {
  const apiKey = process.env.COINGECKO_API_KEY;
  const keyParam = apiKey ? `&x_cg_demo_api_key=${apiKey}` : '';
  const url = `${BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}${keyParam}`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`CoinGecko klines error: ${res.status}`);

  const data = await res.json();
  const prices: [number, number][] = data.prices || [];
  const volumes: [number, number][] = data.total_volumes || [];

  if (prices.length === 0) return [];

  const buckets = new Map<number, { prices: number[]; volumes: number[] }>();

  for (let i = 0; i < prices.length; i++) {
    const [ts, price] = prices[i];
    const bucketKey = Math.floor(ts / bucketMs) * bucketMs;
    if (!buckets.has(bucketKey)) buckets.set(bucketKey, { prices: [], volumes: [] });
    buckets.get(bucketKey)!.prices.push(price);
  }

  for (let i = 0; i < volumes.length; i++) {
    const [ts, vol] = volumes[i];
    const bucketKey = Math.floor(ts / bucketMs) * bucketMs;
    if (buckets.has(bucketKey)) buckets.get(bucketKey)!.volumes.push(vol);
  }

  const klines: Kline[] = [];
  const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);
  for (const key of sortedKeys) {
    const b = buckets.get(key)!;
    if (b.prices.length === 0) continue;
    const open = b.prices[0];
    const close = b.prices[b.prices.length - 1];
    const high = Math.max(...b.prices);
    const low = Math.min(...b.prices);
    const volume = b.volumes.length > 0 ? b.volumes[b.volumes.length - 1] : 0;
    klines.push({ openTime: key, open, high, low, close, volume, closeTime: key + bucketMs });
  }

  return klines;
}

export async function fetchKlines(symbol: string, interval: string, limit = 500): Promise<Kline[]> {
  const cacheKey = `klines:${symbol}:${interval}:${limit}`;
  const ttl = ttlForInterval(interval);

  return withCache(cacheKey, ttl, async () => {
    const coinId = symbolToCoinId(symbol);
    let days: number;
    let bucketMs: number;

    if (interval === '15m' || interval === '15') {
      days = 1;
      bucketMs = 15 * 60 * 1000;
    } else if (interval === '1h' || interval === '60') {
      days = 14;
      bucketMs = 60 * 60 * 1000;
    } else if (interval === '4h' || interval === '240') {
      days = 90;
      bucketMs = 4 * 60 * 60 * 1000;
    } else if (interval === '1d' || interval === 'D') {
      days = Math.min(limit, 365);
      bucketMs = 24 * 60 * 60 * 1000;
    } else if (interval === '1w' || interval === 'W') {
      days = 365;
      bucketMs = 7 * 24 * 60 * 60 * 1000;
    } else {
      days = 90;
      bucketMs = 24 * 60 * 60 * 1000;
    }

    return fetchKlinesFromMarketChart(coinId, days, bucketMs);
  });
}

export async function fetchFundingRate(_symbol: string): Promise<number | null> { return null; }
export async function fetchOpenInterest(_symbol: string): Promise<number | null> { return null; }
export async function fetchLongShortRatio(_symbol: string): Promise<number | null> { return null; }

export async function fetchSpotSymbols(): Promise<string[]> {
  return Object.keys(SYMBOL_TO_COIN_ID).sort();
}
