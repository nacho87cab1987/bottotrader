'use client';

import { memo } from 'react';
import type { SRLevel, FibLevel } from '@/lib/levels';

type Props = {
  supports: SRLevel[];
  resistances: SRLevel[];
  fibonacci: FibLevel[];
  currentPrice: number;
};

function LevelsPanelImpl({ supports, resistances, fibonacci }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--short)', padding: 20 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--short)', marginBottom: 14, fontWeight: 700, paddingBottom: 10, borderBottom: '1px dashed var(--line)' }}>▲ RESISTENCIAS</div>
        {resistances.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>— sin niveles —</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {resistances.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, background: 'var(--bg-elev)', borderLeft: '3px solid var(--short)' }}>
                <div>
                  <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 600 }}>
                    ${r.price.toLocaleString('en-US', { maximumFractionDigits: r.price < 1 ? 6 : 2 })}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--ink-faint)', letterSpacing: '0.1em' }}>
                    {r.strength} TOQUE{r.strength > 1 ? 'S' : ''}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--short)', fontWeight: 700 }}>+{r.distance.toFixed(2)}%</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--long)', padding: 20 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--long)', marginBottom: 14, fontWeight: 700, paddingBottom: 10, borderBottom: '1px dashed var(--line)' }}>▼ SOPORTES</div>
        {supports.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>— sin niveles —</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {supports.map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, background: 'var(--bg-elev)', borderLeft: '3px solid var(--long)' }}>
                <div>
                  <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 600 }}>
                    ${s.price.toLocaleString('en-US', { maximumFractionDigits: s.price < 1 ? 6 : 2 })}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--ink-faint)', letterSpacing: '0.1em' }}>
                    {s.strength} TOQUE{s.strength > 1 ? 'S' : ''}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--long)', fontWeight: 700 }}>{s.distance.toFixed(2)}%</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--accent)', padding: 20 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--accent)', marginBottom: 14, fontWeight: 700, paddingBottom: 10, borderBottom: '1px dashed var(--line)' }}>◆ FIBONACCI</div>
        {fibonacci.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>— sin niveles —</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fibonacci.map((f, i) => {
              const isCurrent = Math.abs(f.distance) < 0.5;
              return (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 10px',
                  background: isCurrent ? 'var(--accent)' : 'var(--bg-elev)',
                  color: isCurrent ? 'var(--bg)' : 'var(--ink)',
                  fontWeight: isCurrent ? 700 : 400, fontSize: 12,
                }}>
                  <span style={{ letterSpacing: '0.1em' }}>{f.label}</span>
                  <span style={{ fontFamily: 'Fraunces, serif' }}>
                    ${f.price.toLocaleString('en-US', { maximumFractionDigits: f.price < 1 ? 6 : 2 })}
                  </span>
                  <span style={{ fontSize: 10, color: isCurrent ? 'var(--bg)' : (f.distance >= 0 ? 'var(--short)' : 'var(--long)') }}>
                    {f.distance >= 0 ? '+' : ''}{f.distance.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export const LevelsPanel = memo(LevelsPanelImpl);
