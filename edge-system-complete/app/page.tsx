'use client';

import { useState, useEffect } from 'react';
import type { AnalysisResult } from '@/lib/scoring';
import type { TimeframeAnalysis } from '@/lib/timeframe';
import { TradingViewChart } from '@/components/TradingViewChart';
import { MiniChart } from '@/components/MiniChart';
import { LevelsPanel } from '@/components/LevelsPanel';

const POPULAR = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOGEUSDT'];

export default function Home() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [mode, setMode] = useState<'swing' | 'intraday'>('swing');
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [chartInterval, setChartInterval] = useState<string>('D');

  async function analyze(sym: string, m: 'swing' | 'intraday' = mode) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analyze?symbol=${sym}&mode=${m}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      setData(json);
      setLastUpdate(new Date().toLocaleTimeString('es-ES'));
    } catch (e: any) {
      setError(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { analyze(symbol); }, []);

  const verdictText: Record<string, string> = {
    long: '▲ SETUP LONG VÁLIDO',
    short: '▼ SETUP SHORT VÁLIDO',
    neutral: '◆ SEÑALES MIXTAS',
    wait: '○ ESPERAR',
  };

  const verdictColor: Record<string, string> = {
    long: 'var(--long)',
    short: 'var(--short)',
    neutral: 'var(--warn)',
    wait: 'var(--ink-dim)',
  };

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <header style={{
        borderBottom: '1px solid var(--line-bright)',
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backdropFilter: 'blur(8px)',
        background: 'rgba(10, 13, 10, 0.7)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 800, letterSpacing: '0.15em', fontSize: 13 }}>
          <div style={{ width: 24, height: 24, background: 'var(--accent)', color: 'var(--bg)', display: 'grid', placeItems: 'center', fontWeight: 800, transform: 'rotate(-5deg)' }}>E</div>
          <span>EDGE / SWING SYSTEM</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, color: 'var(--ink-dim)', fontSize: 11, letterSpacing: '0.1em' }}>
          {loading ? <span>ANALYZING...</span> : <span>UPDATED {lastUpdate}</span>}
          <a href="/paper" style={{ color: 'var(--warn)', textDecoration: 'none', letterSpacing: '0.15em', borderBottom: '1px solid var(--warn)', paddingBottom: 2 }}>📊 PAPER</a>
          <a href="/settings" style={{ color: 'var(--accent)', textDecoration: 'none', letterSpacing: '0.15em', borderBottom: '1px solid var(--accent)', paddingBottom: 2 }}>⚙ SETTINGS</a>
        </div>
      </header>

      <section style={{ padding: '60px 32px 40px', maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 24, color: 'var(--ink-faint)', fontSize: 11, letterSpacing: '0.2em', marginBottom: 24, textTransform: 'uppercase' }}>
          <span>v2.0</span><span>//</span><span>Multi-Timeframe</span><span>//</span><span>Paper Trader</span>
        </div>

        <h1 style={{ fontFamily: 'Fraunces, serif', fontWeight: 300, fontSize: 'clamp(40px, 6vw, 80px)', lineHeight: 0.95, letterSpacing: '-0.04em', marginBottom: 32 }}>
          Tres timeframes,<br />
          <em style={{ fontStyle: 'italic', fontWeight: 900, color: 'var(--accent)' }}>una sola decisión.</em>
        </h1>

        <div style={{ display: 'flex', gap: 0, marginBottom: 20, border: '1px solid var(--line-bright)', width: 'fit-content' }}>
          {[
            { v: 'swing' as const, label: 'SWING', desc: '4H · 1D · 1W' },
            { v: 'intraday' as const, label: 'INTRADAY', desc: '15M · 1H · 4H' },
          ].map(m => (
            <button
              key={m.v}
              onClick={() => { setMode(m.v); analyze(symbol, m.v); }}
              style={{
                padding: '12px 24px',
                background: mode === m.v ? 'var(--accent)' : 'transparent',
                color: mode === m.v ? 'var(--bg)' : 'var(--ink-dim)',
                border: 'none',
                fontSize: 12, letterSpacing: '0.2em',
                fontFamily: 'inherit',
                fontWeight: mode === m.v ? 700 : 400,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div>{m.label}</div>
              <div style={{ fontSize: 9, letterSpacing: '0.1em', opacity: 0.7, marginTop: 2 }}>{m.desc}</div>
            </button>
          ))}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); analyze(symbol); }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="BTCUSDT"
            style={{ flex: '1 1 280px', background: 'var(--bg-elev)', border: '1px solid var(--line-bright)', color: 'var(--ink)', padding: '14px 18px', fontSize: 16, letterSpacing: '0.1em', outline: 'none' }}
          />
          <button type="submit" disabled={loading} style={{ padding: '14px 32px', background: 'var(--accent)', color: 'var(--bg)', border: 'none', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700, cursor: loading ? 'wait' : 'pointer' }}>
            {loading ? 'Analizando...' : 'Analizar →'}
          </button>
        </form>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {POPULAR.map(s => (
            <button key={s} onClick={() => { setSymbol(s); analyze(s); }} style={{ padding: '6px 12px', background: symbol === s ? 'var(--accent)' : 'transparent', color: symbol === s ? 'var(--bg)' : 'var(--ink-dim)', border: '1px solid var(--line-bright)', fontSize: 11, letterSpacing: '0.1em', cursor: 'pointer' }}>
              {s.replace('USDT', '')}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 32px' }}>
          <div style={{ background: 'var(--short-glow)', border: '1px solid var(--short)', padding: 20, color: 'var(--short)' }}>⚠ {error}</div>
        </div>
      )}

      {data && (
        <main style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 32px 80px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--line-bright)', padding: 28 }}>
              <div style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--ink-dim)', marginBottom: 12 }}>{data.symbol} · PRECIO</div>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: 48, fontWeight: 600, lineHeight: 1 }}>
                ${data.price.toLocaleString('en-US', { maximumFractionDigits: data.price < 1 ? 6 : 2 })}
              </div>
              <div style={{ marginTop: 8, fontSize: 14, color: data.priceChange24h >= 0 ? 'var(--long)' : 'var(--short)' }}>
                {data.priceChange24h >= 0 ? '▲' : '▼'} {data.priceChange24h.toFixed(2)}%
              </div>
            </div>

            <div style={{ background: 'var(--bg-card)', border: `2px solid ${verdictColor[data.verdict]}`, padding: 28 }}>
              <div style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--ink-dim)', marginBottom: 12 }}>VEREDICTO</div>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: 28, fontWeight: 600, color: verdictColor[data.verdict], lineHeight: 1.1 }}>
                {verdictText[data.verdict]}
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-dim)' }}>
                LONG: {data.longScore}/100 · SHORT: {data.shortScore}/100
              </div>
            </div>
          </div>

          {/* CHART */}
          <section style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, marginBottom: 16, borderBottom: '1px solid var(--line-bright)', paddingBottom: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '0.2em' }}>CHART</span>
              <h2 style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: 24, letterSpacing: '-0.02em' }}>Gráfico en vivo</h2>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                {[{ v: '15', label: '15m' }, { v: '60', label: '1H' }, { v: '240', label: '4H' }, { v: 'D', label: '1D' }, { v: 'W', label: '1W' }].map(tf => (
                  <button key={tf.v} onClick={() => setChartInterval(tf.v)} style={{ padding: '6px 12px', background: chartInterval === tf.v ? 'var(--accent)' : 'transparent', color: chartInterval === tf.v ? 'var(--bg)' : 'var(--ink-dim)', border: '1px solid var(--line-bright)', fontSize: 11, letterSpacing: '0.1em', fontFamily: 'inherit', cursor: 'pointer', fontWeight: chartInterval === tf.v ? 700 : 400 }}>
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>
            <TradingViewChart symbol={data.symbol} interval={chartInterval} height={800} />
          </section>

          {/* MULTI-TF */}
          <section style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, marginBottom: 20, borderBottom: '1px solid var(--line-bright)', paddingBottom: 14 }}>
              <span style={{ fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '0.2em' }}>MTF</span>
              <h2 style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: 24, letterSpacing: '-0.02em' }}>Multi-Timeframe</h2>
              <div style={{ marginLeft: 'auto', padding: '6px 14px', background: 'var(--accent)22', border: '1px solid var(--accent)', color: 'var(--accent)', fontSize: 11, letterSpacing: '0.2em', fontWeight: 700 }}>
                CONSENSO: {data.consensus.level}
              </div>
            </div>

            <div style={{ marginBottom: 20, padding: 14, background: 'var(--bg-elev)', border: '1px dashed var(--accent)', fontSize: 13 }}>
              <span style={{ color: 'var(--accent)', fontWeight: 700, marginRight: 8 }}>→</span>
              {data.consensus.description}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <TimeframeCard tf={data.tfTrigger} label={`${data.tfLabels.trigger} · TIMING`} symbol={data.symbol} interval={data.mode === 'intraday' ? '15' : '240'} />
              <TimeframeCard tf={data.tfSetup} label={`${data.tfLabels.setup} · SETUP`} symbol={data.symbol} interval={data.mode === 'intraday' ? '60' : 'D'} highlight />
              <TimeframeCard tf={data.tfMacro} label={`${data.tfLabels.macro} · MACRO`} symbol={data.symbol} interval={data.mode === 'intraday' ? '240' : 'W'} />
            </div>
          </section>

          {/* LEVELS */}
          {data.levels && (
            <section style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, marginBottom: 16, borderBottom: '1px solid var(--line-bright)', paddingBottom: 14 }}>
                <span style={{ fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '0.2em' }}>SR</span>
                <h2 style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: 24, letterSpacing: '-0.02em' }}>Niveles clave</h2>
              </div>
              <LevelsPanel supports={data.levels.supports} resistances={data.levels.resistances} fibonacci={data.levels.fibonacci} currentPrice={data.price} />
            </section>
          )}

          <div style={{ marginTop: 40, padding: 20, background: 'var(--bg-elev)', border: '1px solid var(--warn)', color: 'var(--warn)', fontSize: 11, letterSpacing: '0.1em', textAlign: 'center' }}>
            ⚠ EDUCATIVO. NO ES ASESORIA FINANCIERA.
          </div>
        </main>
      )}
    </div>
  );
}

function TimeframeCard({ tf, label, highlight, symbol, interval }: { tf: TimeframeAnalysis; label: string; highlight?: boolean; symbol: string; interval: string }) {
  const biasColor = tf.bias === 'bullish' ? 'var(--long)' : tf.bias === 'bearish' ? 'var(--short)' : 'var(--ink-dim)';
  const biasGlow = tf.bias === 'bullish' ? 'var(--long-glow)' : tf.bias === 'bearish' ? 'var(--short-glow)' : 'transparent';
  const biasArrow = tf.bias === 'bullish' ? '▲' : tf.bias === 'bearish' ? '▼' : '◆';

  return (
    <div style={{ background: 'var(--bg-card)', border: `${highlight ? '2' : '1'}px solid ${biasColor}`, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <span style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--ink-faint)' }}>{label}</span>
        <span style={{ fontSize: 11, letterSpacing: '0.15em', color: 'var(--ink-dim)' }}>{tf.timeframe}</span>
      </div>

      <div style={{ marginBottom: 14, border: '1px solid var(--line)', background: 'var(--bg-elev)', height: 240, overflow: 'hidden' }}>
        <MiniChart symbol={symbol} interval={interval} height={240} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: biasGlow, marginBottom: 14 }}>
        <span style={{ fontSize: 28, color: biasColor }}>{biasArrow}</span>
        <div>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 600, color: biasColor, textTransform: 'uppercase' }}>{tf.bias}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-dim)', letterSpacing: '0.1em' }}>FUERZA: {tf.strength}/100</div>
        </div>
      </div>

      <div style={{ height: 4, background: 'var(--bg-elev)', marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${tf.strength}%`, background: biasColor }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
        <div><span style={{ color: 'var(--ink-faint)' }}>RSI: </span><span>{tf.indicators.rsi.toFixed(1)}</span></div>
        <div><span style={{ color: 'var(--ink-faint)' }}>vs EMA50: </span><span>{tf.indicators.distEma50Pct.toFixed(2)}%</span></div>
      </div>
    </div>
  );
}
