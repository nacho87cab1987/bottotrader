import { NextRequest, NextResponse } from 'next/server';
import {
  readJson, writeJson, STORAGE_KEYS, DEFAULT_SETTINGS,
  type WatchlistEntry, type Settings, type AlertHistoryEntry,
} from '@/lib/storage/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const [watchlist, settings, history] = await Promise.all([
    readJson<WatchlistEntry[]>(STORAGE_KEYS.watchlist, []),
    readJson<Settings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS),
    readJson<AlertHistoryEntry[]>(STORAGE_KEYS.alertHistory, []),
  ]);
  return NextResponse.json({ watchlist, settings, history: history.slice(-20).reverse() });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.action === 'add') {
    const symbol = (body.symbol || '').toUpperCase();
    if (!symbol) return NextResponse.json({ error: 'symbol requerido' }, { status: 400 });
    const watchlist = await readJson<WatchlistEntry[]>(STORAGE_KEYS.watchlist, []);
    if (!watchlist.find(w => w.symbol === symbol)) {
      watchlist.push({ symbol, enabled: true, addedAt: Date.now() });
      await writeJson(STORAGE_KEYS.watchlist, watchlist);
    }
    return NextResponse.json({ watchlist });
  }

  if (body.action === 'remove') {
    const symbol = (body.symbol || '').toUpperCase();
    const watchlist = await readJson<WatchlistEntry[]>(STORAGE_KEYS.watchlist, []);
    const filtered = watchlist.filter(w => w.symbol !== symbol);
    await writeJson(STORAGE_KEYS.watchlist, filtered);
    return NextResponse.json({ watchlist: filtered });
  }

  if (body.action === 'toggle') {
    const symbol = (body.symbol || '').toUpperCase();
    const watchlist = await readJson<WatchlistEntry[]>(STORAGE_KEYS.watchlist, []);
    const entry = watchlist.find(w => w.symbol === symbol);
    if (entry) entry.enabled = !entry.enabled;
    await writeJson(STORAGE_KEYS.watchlist, watchlist);
    return NextResponse.json({ watchlist });
  }

  if (body.action === 'updateSettings') {
    const settings = await readJson<Settings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
    const updated: Settings = {
      cooldownMinutes: typeof body.cooldownMinutes === 'number' ? body.cooldownMinutes : settings.cooldownMinutes,
      minScore: typeof body.minScore === 'number' ? body.minScore : settings.minScore,
      scoreGap: typeof body.scoreGap === 'number' ? body.scoreGap : settings.scoreGap,
    };
    await writeJson(STORAGE_KEYS.settings, updated);
    return NextResponse.json({ settings: updated });
  }

  return NextResponse.json({ error: 'action inválida' }, { status: 400 });
}
