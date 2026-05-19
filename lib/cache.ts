type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry<any>>();

export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const entry = cache.get(key);
  if (entry && entry.expiresAt > now) {
    return entry.value as T;
  }
  const value = await fetcher();
  cache.set(key, { value, expiresAt: now + ttlSeconds * 1000 });
  return value;
}

export function ttlForInterval(interval: string): number {
  if (interval === '15m' || interval === '15') return 60;
  if (interval === '1h' || interval === '60') return 180;
  if (interval === '4h' || interval === '240') return 300;
  if (interval === '1d' || interval === 'D') return 1800;
  if (interval === '1w' || interval === 'W') return 14400;
  return 600;
}

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
      if (entry.expiresAt < now) cache.delete(key);
    }
  }, 60_000);
}
