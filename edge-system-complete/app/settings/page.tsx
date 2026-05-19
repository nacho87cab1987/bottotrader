'use client';

import { useState, useEffect } from 'react';

const POPULAR = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOGEUSDT', 'ARBUSDT', 'OPUSDT'];

type WatchlistEntry = { symbol: string; enabled: boolean; addedAt: number };
type Settings = { cooldownMinutes: number; minScore: number; scoreGap: number };
type AlertHistoryEntry = { symbol: string; side: 'long' | 'short'; score: number; sentAt: number; channels: string[]; mode?: string };

export default function SettingsPage() {
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [settings, setSettings] = useState<Settings>({ cooldownMinutes: 240, minScore: 60, scoreGap: 20 });
  const [history, setHistory] = useState<AlertHistoryEntry[]>([]);
  const [newSymbol, setNewSymbol] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [cronResult, setCronResult] = useState<any>(null);

  async function load() {
    const res = await fetch('/api/watchlist');
    const data = await res.json();
    setWatchlist(data.watchlist || []);
    setSettings(data.settings || settings);
    setHistory(data.history || []);
  }

  useEffect(() => { load(); }, []);

  async function action(body: any) {
    setLoading(true);
    await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    await load();
    setLoading(false);
  }

  async function testAlerts() {
    setTestResult(null);
    setLoading(true);
    const res = await fetch('/api/alerts/test', { method: 'POST' });
    const data = await res.json();
    setTestResult(data);
    setLoading(false);
  }

  async function runCronManually() {
    setCronResult(null);
    setLoading(true);
    const res = await fetch('/api/cron');
    const data = await res.json();
    setCronResult(data);
    setLoading(false);
    await load();
  }

  return (
    <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', padding: '40px 32px' }}>
      <a href="/" style={{ color: 'var(--ink-dim)', fontSize: 12, letterSpacing: '0.15em', textDecoration: 'none' }}>← VOLVER</a>

      <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 56, fontWeight: 300, letterSpacing: '-0.04em', margin: '24px 0 8px' }}>
        Configuración<em style={{ fontStyle: 'italic', fontWeight: 900, color: 'var(--accent)' }}>.</em>
      </h1>
      <p style={{ color: 'var(--ink-dim)', marginBottom: 48 }}>Watchlist + canales + cron manual</p>

      <Section num="01" title="Watchlist" tag="PARES MONITOREADOS">
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <input value={newSymbol} onChange={e => setNewSymbol(e.target.value.toUpperCase())} placeholder="BTCUSDT" style={inputStyle} />
          <button onClick={() => { if (newSymbol) { action({ action: 'add', symbol: newSymbol }); setNewSymbol(''); } }} disabled={loading} style={btnPrimary}>+ Agregar</button>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
          {POPULAR.filter(s => !watchlist.find(w => w.symbol === s)).map(s => (
            <button key={s} onClick={() => action({ action: 'add', symbol: s })} style={chip}>+ {s.replace('USDT', '')}</button>
          ))}
        </div>

        {watchlist.length === 0 ? (
          <div style={emptyState}>— sin pares —</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {watchlist.map(w => (
              <div key={w.symbol} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 14, border: `1px solid ${w.enabled ? 'var(--line-bright)' : 'var(--line)'}`, background: w.enabled ? 'var(--bg-card)' : 'transparent', opacity: w.enabled ? 1 : 0.5 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={w.enabled} onChange={() => action({ action: 'toggle', symbol: w.symbol })} style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
                  <span>{w.symbol}</span>
                </label>
                <button onClick={() => action({ action: 'remove', symbol: w.symbol })} style={{ ...btnGhost, marginLeft: 'auto' }}>DEL</button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section num="02" title="Canales" tag="WHATSAPP + TELEGRAM">
        <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--line-bright)', padding: 20, marginBottom: 16, fontSize: 13, color: 'var(--ink-dim)' }}>
          Configurá variables en Vercel: <code>WHATSAPP_PHONE</code>, <code>WHATSAPP_API_KEY</code>, <code>TELEGRAM_BOT_TOKEN</code>, <code>TELEGRAM_CHAT_ID</code>
        </div>
        <button onClick={testAlerts} disabled={loading} style={btnPrimary}>
          {loading ? 'Enviando...' : '✉ Probar canales'}
        </button>
        {testResult && (
          <div style={{ marginTop: 16, padding: 16, background: 'var(--bg-elev)', border: '1px solid var(--line-bright)' }}>
            {testResult.error ? (
              <div style={{ color: 'var(--short)' }}>⚠ {testResult.error}</div>
            ) : (
              testResult.results?.map((r: any, i: number) => (
                <div key={i} style={{ marginBottom: 8, fontSize: 12, color: r.success ? 'var(--long)' : 'var(--short)' }}>
                  {r.success ? '✓' : '✗'} {r.channel.toUpperCase()} — {r.success ? 'enviado' : r.error}
                </div>
              ))
            )}
          </div>
        )}
      </Section>

      <Section num="03" title="Cron manual" tag="EJECUTAR ESCANEO">
        <button onClick={runCronManually} disabled={loading} style={btnPrimary}>
          {loading ? 'Escaneando...' : '▶ Correr escaneo ahora'}
        </button>
        {cronResult && (
          <div style={{ marginTop: 16, padding: 16, background: 'var(--bg-elev)', border: '1px solid var(--line-bright)', fontSize: 12, maxHeight: 400, overflow: 'auto' }}>
            {cronResult.error ? (
              <div style={{ color: 'var(--short)' }}>⚠ {cronResult.error}</div>
            ) : (
              <>
                <div style={{ marginBottom: 12, color: 'var(--ink-dim)' }}>
                  Escaneados: {cronResult.scanned} · Duración: {cronResult.durationMs}ms
                </div>
                {cronResult.paper && (
                  <div style={{ marginBottom: 12, padding: 8, background: 'var(--bg-card)', borderLeft: '3px solid var(--warn)' }}>
                    <strong style={{ color: 'var(--warn)' }}>PAPER:</strong> Balance ${cronResult.paper.balance.toFixed(2)} · {cronResult.paper.openPositions} abiertas · {cronResult.paper.events.length} eventos
                  </div>
                )}
                {cronResult.report?.map((r: any, i: number) => (
                  <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                    <span>{r.symbol}</span>
                    {r.mode && <span style={{ color: 'var(--ink-faint)' }}> [{r.mode}]</span>}
                    {' → '}
                    <span>{r.status}</span>
                    {r.score !== undefined && <span style={{ color: 'var(--ink-faint)' }}> (score {r.score})</span>}
                    {r.verdict && <span style={{ color: r.verdict === 'long' ? 'var(--long)' : 'var(--short)' }}> · {r.verdict.toUpperCase()}</span>}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </Section>

      <Section num="04" title="Histórico" tag="ÚLTIMAS 20">
        {history.length === 0 ? (
          <div style={emptyState}>— sin alertas —</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={th}>Fecha</th>
                <th style={th}>Par</th>
                <th style={th}>Modo</th>
                <th style={th}>Side</th>
                <th style={th}>Score</th>
                <th style={th}>Canales</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i}>
                  <td style={td}>{new Date(h.sentAt).toLocaleString()}</td>
                  <td style={td}>{h.symbol}</td>
                  <td style={td}>{h.mode || '-'}</td>
                  <td style={{ ...td, color: h.side === 'long' ? 'var(--long)' : 'var(--short)' }}>{h.side.toUpperCase()}</td>
                  <td style={td}>{h.score}</td>
                  <td style={td}>{h.channels.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

function Section({ num, title, tag, children }: { num: string; title: string; tag: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 64 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, marginBottom: 24, borderBottom: '1px solid var(--line-bright)', paddingBottom: 14 }}>
        <span style={{ fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '0.2em' }}>{num}</span>
        <h2 style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: 24, letterSpacing: '-0.02em' }}>{title}</h2>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ink-faint)', letterSpacing: '0.2em' }}>{tag}</span>
      </div>
      {children}
    </section>
  );
}

const inputStyle: React.CSSProperties = { background: 'var(--bg-elev)', border: '1px solid var(--line-bright)', color: 'var(--ink)', padding: '12px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', flex: '1 1 200px' };
const btnPrimary: React.CSSProperties = { padding: '12px 24px', background: 'var(--accent)', color: 'var(--bg)', border: 'none', fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost: React.CSSProperties = { padding: '6px 12px', background: 'transparent', color: 'var(--ink-faint)', border: '1px solid var(--line)', fontSize: 10, letterSpacing: '0.15em', cursor: 'pointer', fontFamily: 'inherit' };
const chip: React.CSSProperties = { padding: '6px 12px', background: 'transparent', color: 'var(--ink-dim)', border: '1px solid var(--line-bright)', fontSize: 11, letterSpacing: '0.1em', cursor: 'pointer', fontFamily: 'inherit' };
const th: React.CSSProperties = { textAlign: 'left', padding: 10, borderBottom: '1px solid var(--line-bright)', color: 'var(--ink-faint)', fontWeight: 400, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase' };
const td: React.CSSProperties = { padding: '12px 10px', borderBottom: '1px solid var(--line)' };
const emptyState: React.CSSProperties = { textAlign: 'center', padding: 40, color: 'var(--ink-faint)', fontSize: 12, letterSpacing: '0.1em', border: '1px dashed var(--line-bright)' };
