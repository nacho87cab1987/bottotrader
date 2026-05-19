import { promises as fs } from 'fs';
import path from 'path';

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const USE_KV = Boolean(KV_URL && KV_TOKEN);

const DATA_DIR = process.env.NODE_ENV === 'production'
  ? '/tmp/edge-data'
  : path.join(process.cwd(), '.data');

const KEY_PREFIX = 'edge:';

async function kvGet(key: string): Promise<any> {
  try {
    const res = await fetch(`${KV_URL}/get/${KEY_PREFIX}${key}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.result) return null;
    try { return JSON.parse(data.result); } catch { return null; }
  } catch {
    return null;
  }
}

async function kvSet(key: string, value: any): Promise<void> {
  try {
    await fetch(`${KV_URL}/set/${KEY_PREFIX}${key}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(value),
    });
  } catch {}
}

async function ensureDir(): Promise<void> {
  try { await fs.mkdir(DATA_DIR, { recursive: true }); } catch {}
}

async function fsRead<T>(key: string, fallback: T): Promise<T> {
  await ensureDir();
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, `${key}.json`), 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function fsWrite<T>(key: string, value: T): Promise<void> {
  await ensureDir();
  await fs.writeFile(path.join(DATA_DIR, `${key}.json`), JSON.stringify(value, null, 2), 'utf-8');
}

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  if (USE_KV) {
    const value = await kvGet(key);
    return value !== null ? (value as T) : fallback;
  }
  return fsRead(key, fallback);
}

export async function writeJson<T>(key: string, value: T): Promise<void> {
  if (USE_KV) {
    await kvSet(key, value);
    return;
  }
  await fsWrite(key, value);
}

export type WatchlistEntry = {
  symbol: string;
  enabled: boolean;
  addedAt: number;
  modes?: ('swing' | 'intraday')[];
};

export type AlertHistoryEntry = {
  symbol: string;
  side: 'long' | 'short';
  score: number;
  sentAt: number;
  channels: string[];
  mode?: 'swing' | 'intraday';
};

export const STORAGE_KEYS = {
  watchlist: 'watchlist',
  alertHistory: 'alert-history',
  settings: 'settings',
} as const;

export type Settings = {
  cooldownMinutes: number;
  minScore: number;
  scoreGap: number;
};

export const DEFAULT_SETTINGS: Settings = {
  cooldownMinutes: 240,
  minScore: 60,
  scoreGap: 20,
};
