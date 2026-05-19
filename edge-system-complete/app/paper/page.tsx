'use client';

import { useState, useEffect } from 'react';
import type { PaperTrade, PaperAccount, PaperConfig } from '@/lib/paper/engine';
import type { PaperStats } from '@/lib/paper/stats';

type PaperData = {
  account: PaperAccount;
  config: PaperConfig;
  stats: PaperStats;
  openTrades: PaperTrade[];
  closedTrades: PaperTrade[];
};

export default function PaperTraderPage() {
  const [data, setData] = useState<PaperData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/paper');
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function action(body: any) {
    setBusy(true);
    try {
      await fetch('/api/paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function resetAccount() {
    if (!confirm('Estas seguro? Vas a perder todo el historial de trades.')) return;
    const balance = prompt('Balance inicial?', '1000');
    if (!balance) return;
    await action({ action: 'reset', initialBalance: parseFloat(balance) });
  }

  if (loading || !data) {
    return (
      <div style={{ padding: 60, color: 'var(--ink-dim)', textAlign: 'center' }}>
        Cargando paper trader...
      </div>
    );
  }

  const { account, stats, openTrades, closedTrades } = data;
  const totalReturn = ((account.balance - account.initialBalance) / account.initialBalance) * 100;
  const returnColor = totalReturn >= 0 ? 'var(--long)' : 'var(--short)';

  return (
    <div style={{ position: 'relative', zIndex: 1, maxWidth: 1400, margin: '0 auto', padding: '40px 32px' }}>
      <a href="/" style={{ color: 'var(--ink-dim)', fontSize: 12, letterSpacing: '0.15em', textDecoration: 'none' }}>← VOLVER AL ANALYZER</a>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 24, marginBottom: 8 }}>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 56, fontWeight: 300, letterSpacing: '-0.04em' }}>
          Paper Trader<em style={{ fontStyle: 'italic', fontWeight: 900, color: 'var(--accent)' }}>.</em>
        </h1>
        <span style={{ fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '0.2em' }}>SIMULADOR</span>
      </div>
      <p style={{ color: 'var(--ink-dim)', marginBottom: 32, maxWidth: 700 }}>
        Sistema operando con dinero virtual. Toma las mismas señales que el motor EDGE pero ejecuta automaticamente con fees y slippage realistas (BingX).
      </p>

      {/* RESUMEN DE CUENTA */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 1,
        background: 'var(--line-bright)',
        border: '1px solid var(--line-bright)',
        marginBottom: 32,
      }}>
        <StatCell label="BALANCE ACTUAL" value={`$${account.balance.toFixed(2)}`} color={returnColor} large />
        <StatCell label="RETURN TOTAL" value={`${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%`} color={returnColor} large />
        <StatCell label="P&L ACUMULADO" value={`${account.totalPnl >= 0 ? '+' : ''}$${account.totalPnl.toFixed(2)}`} color={returnColor} />
        <StatCell label="POSICIONES ABIERTAS" value={openTrades.length.toString()} />
        <StatCell label="TRADES CERRADOS" value={stats.total.toString()} />
        <StatCell label="WIN RATE" value={`${stats.winRate.toFixed(1)}%`} color={stats.winRate >= 50 ? 'var(--long)' : 'var(--short)'} />
        <StatCell label="PROFIT FACTOR" value={stats.profitFactor.toFixed(2)} color={stats.profitFactor >= 1.2 ? 'var(--long)' : stats.profitFactor >= 1 ? 'var(--warn)' : 'var(--short)'} />
        <StatCell label="MAX DRAWDOWN" value={`${account.maxDrawdown.toFixed(2)}%`} color={'var(--short)'} />
      </div>

      {/* BOTONES */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 40, flexWrap: 'wrap' }}>
        <button onClick={load} disabled={busy} style={btnPrimary}>
          {busy ? 'Cargando...' : 'Refresh'}
        </button>
        <button onClick={resetAccount} disabled={busy} style={btnDanger}>
          Reiniciar cuenta
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '0.1em', alignSelf: 'center' }}>
          ACTUALIZADO: {new Date(account.lastUpdated).toLocaleString()}
        </span>
      </div>

      {/* DESGLOSE POR MODO Y SIDE */}
      <Section num="01" title="Desglose por modo y lado" tag="ANALISIS">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <BreakdownCard title="SWING" data={stats.byMode.swing} color="var(--accent)" />
          <BreakdownCard title="INTRADAY" data={stats.byMode.intraday} color="var(--warn)" />
          <BreakdownCard title="LONG" data={stats.bySide.long} color="var(--long)" />
          <BreakdownCard title="SHORT" data={stats.bySide.short} color="var(--short)" />
        </div>
      </Section>

      {/* POSICIONES ABIERTAS */}
      <Section num="02" title="Posiciones abiertas" tag={`${openTrades.length} ACTIVAS`}>
        {openTrades.length === 0 ? (
          <div style={emptyState}>— sin posiciones abiertas —</div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <Th>Par</Th>
                <Th>Modo</Th>
                <Th>Side</Th>
                <Th>Entry</Th>
                <Th>Stop</Th>
                <Th>Target</Th>
                <Th>Size</Th>
                <Th>Score</Th>
                <Th>Abierto hace</Th>
              </tr>
            </thead>
            <tbody>
              {openTrades.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <Td>{t.symbol}</Td>
                  <Td><Badge text={t.mode.toUpperCase()} color={t.mode === 'swing' ? 'var(--accent)' : 'var(--warn)'} /></Td>
                  <Td><Badge text={t.side.toUpperCase()} color={t.side === 'long' ? 'var(--long)' : 'var(--short)'} /></Td>
                  <Td>${t.entryPrice.toFixed(t.entryPrice < 1 ? 6 : 2)}</Td>
                  <Td style={{ color: 'var(--short)' }}>${t.stopLoss.toFixed(t.stopLoss < 1 ? 6 : 2)}</Td>
                  <Td style={{ color: 'var(--long)' }}>${t.takeProfit.toFixed(t.takeProfit < 1 ? 6 : 2)}</Td>
                  <Td>${t.positionSize.toFixed(0)}</Td>
                  <Td>{t.entryScore}</Td>
                  <Td>{formatTimeSince(t.entryTime)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* HISTORICO */}
      <Section num="03" title="Historico de trades" tag={`ULTIMOS ${closedTrades.length}`}>
        {closedTrades.length === 0 ? (
          <div style={emptyState}>— sin trades cerrados aun —</div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <Th>Cerrado</Th>
                <Th>Par</Th>
                <Th>Modo</Th>
                <Th>Side</Th>
                <Th>Entry</Th>
                <Th>Exit</Th>
                <Th>Razon</Th>
                <Th>P&L</Th>
                <Th>%</Th>
              </tr>
            </thead>
            <tbody>
              {closedTrades.map(t => {
                const pnlColor = (t.pnl || 0) >= 0 ? 'var(--long)' : 'var(--short)';
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <Td>{t.exitTime ? new Date(t.exitTime).toLocaleString().split(',')[0] : '-'}</Td>
                    <Td>{t.symbol}</Td>
                    <Td><Badge text={t.mode.toUpperCase()} color={t.mode === 'swing' ? 'var(--accent)' : 'var(--warn)'} /></Td>
                    <Td><Badge text={t.side.toUpperCase()} color={t.side === 'long' ? 'var(--long)' : 'var(--short)'} /></Td>
                    <Td>${t.entryPrice.toFixed(t.entryPrice < 1 ? 6 : 2)}</Td>
                    <Td>${(t.exitPrice || 0).toFixed(t.entryPrice < 1 ? 6 : 2)}</Td>
                    <Td style={{ fontSize: 10, color: 'var(--ink-dim)' }}>{t.exitReason}</Td>
                    <Td style={{ color: pnlColor, fontWeight: 700 }}>
                      {(t.pnl || 0) >= 0 ? '+' : ''}${(t.pnl || 0).toFixed(2)}
                    </Td>
                    <Td style={{ color: pnlColor }}>
                      {(t.pnlPercent || 0) >= 0 ? '+' : ''}{(t.pnlPercent || 0).toFixed(2)}%
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      <div style={{
        marginTop: 40, padding: 20, background: 'var(--bg-elev)',
        border: '1px solid var(--warn)', color: 'var(--warn)', fontSize: 11, letterSpacing: '0.1em', textAlign: 'center',
      }}>
        ⚠ ESTOS SON TRADES SIMULADOS. SIN DINERO REAL EN JUEGO. CORRE EL SISTEMA AL MENOS 60 DIAS ANTES DE PASAR A REAL.
      </div>
    </div>
  );
}

function StatCell({ label, value, color, large }: { label: string; value: string; color?: string; large?: boolean }) {
  return (
    <div style={{ background: 'var(--bg-card)', padding: 16 }}>
      <div style={{ fontSize: 10, color: 'var(--ink-faint)', letterSpacing: '0.15em', marginBottom: 6 }}>{label}</div>
      <div style={{
        fontFamily: 'Fraunces, serif',
        fontSize: large ? 28 : 22,
        fontWeight: 600,
        color: color || 'var(--ink)',
      }}>{value}</div>
    </div>
  );
}

function BreakdownCard({ title, data, color }: { title: string; data: { count: number; pnl: number; winRate: number }; color: string }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: `1px solid ${color}`, padding: 20 }}>
      <div style={{ fontSize: 11, letterSpacing: '0.2em', color, fontWeight: 700, marginBottom: 14, paddingBottom: 10, borderBottom: '1px dashed var(--line)' }}>
        {title}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
        <div>
          <div style={{ color: 'var(--ink-faint)', fontSize: 10, letterSpacing: '0.1em' }}>TRADES</div>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 600 }}>{data.count}</div>
        </div>
        <div>
          <div style={{ color: 'var(--ink-faint)', fontSize: 10, letterSpacing: '0.1em' }}>WIN RATE</div>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 600 }}>{data.winRate.toFixed(0)}%</div>
        </div>
        <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
          <div style={{ color: 'var(--ink-faint)', fontSize: 10, letterSpacing: '0.1em' }}>P&L NETO</div>
          <div style={{
            fontFamily: 'Fraunces, serif',
            fontSize: 22,
            fontWeight: 600,
            color: data.pnl >= 0 ? 'var(--long)' : 'var(--short)',
          }}>
            {data.pnl >= 0 ? '+' : ''}${data.pnl.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ num, title, tag, children }: { num: string; title: string; tag: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 48 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, marginBottom: 20, borderBottom: '1px solid var(--line-bright)', paddingBottom: 14 }}>
        <span style={{ fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '0.2em' }}>{num}</span>
        <h2 style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: 24, letterSpacing: '-0.02em' }}>{title}</h2>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ink-faint)', letterSpacing: '0.2em' }}>{tag}</span>
      </div>
      {children}
    </section>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      padding: '2px 8px',
      fontSize: 10,
      letterSpacing: '0.15em',
      border: `1px solid ${color}`,
      color,
    }}>{text}</span>
  );
}

function formatTimeSince(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  if (hours === 0) return `${minutes}m`;
  if (hours < 24) return `${hours}h ${minutes}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
};

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{
      textAlign: 'left' as const,
      padding: 10,
      borderBottom: '1px solid var(--line-bright)',
      color: 'var(--ink-faint)',
      fontWeight: 400,
      fontSize: 10,
      letterSpacing: '0.15em',
      textTransform: 'uppercase' as const,
    }}>{children}</th>
  );
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: '12px 10px', ...style }}>{children}</td>;
}

const btnPrimary: React.CSSProperties = {
  padding: '10px 20px',
  background: 'var(--accent)',
  color: 'var(--bg)',
  border: 'none',
  fontSize: 11,
  letterSpacing: '0.2em',
  textTransform: 'uppercase' as const,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const btnDanger: React.CSSProperties = {
  padding: '10px 20px',
  background: 'transparent',
  color: 'var(--short)',
  border: '1px solid var(--short)',
  fontSize: 11,
  letterSpacing: '0.2em',
  textTransform: 'uppercase' as const,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const emptyState: React.CSSProperties = {
  textAlign: 'center' as const,
  padding: 40,
  color: 'var(--ink-faint)',
  fontSize: 12,
  letterSpacing: '0.1em',
  border: '1px dashed var(--line-bright)',
};
