import { Kline } from './binance';
import { analyzeTimeframe, TimeframeAnalysis, TimeframeBias } from './timeframe';
import { detectSupportResistance, calculateFibonacci, SRLevel, FibLevel } from './levels';

export type AnalysisMode = 'swing' | 'intraday' | 'antivitalik';
export type Signal = {
  id: string;
  name: string;
  description: string;
  weight: number;
  triggered: boolean;
  value?: string;
};

export type MtfConsensus = {
  level: 'A+' | 'A' | 'B' | 'C' | 'CONFLICT' | 'NEUTRAL';
  description: string;
  scoreModifier: number;
  alignedDirection: 'long' | 'short' | null;
};

export type AnalysisResult = {
  symbol: string;
  mode: AnalysisMode;
  price: number;
  priceChange24h: number;
  tfMacro: TimeframeAnalysis;
  tfSetup: TimeframeAnalysis;
  tfTrigger: TimeframeAnalysis;
  tfLabels: {
    macro: string;
    setup: string;
    trigger: string;
  };
  consensus: MtfConsensus;
  longSignals: Signal[];
  shortSignals: Signal[];
  longScore: number;
  shortScore: number;
  verdict: 'long' | 'short' | 'neutral' | 'wait';
  indicators: {
    rsi: number;
    ema50: number;
    ema200: number;
    macdHist: number;
    macdCross: 'bullish' | 'bearish' | 'none';
    volumeRatio: number;
  };
  context: {
    fearGreed: number | null;
    fearGreedLabel: string | null;
    funding: number | null;
    longShortRatio: number | null;
    btcDominance: number | null;
  };
  levels: {
    supports: SRLevel[];
    resistances: SRLevel[];
    fibonacci: FibLevel[];
    nearestSupport: SRLevel | null;
    nearestResistance: SRLevel | null;
  };
  timestamp: number;
};

function evaluateConsensus(
  tfTrigger: TimeframeAnalysis,
  tfSetup: TimeframeAnalysis,
  tfMacro: TimeframeAnalysis,
  labels: { macro: string; setup: string; trigger: string }
): MtfConsensus {
  const biases: TimeframeBias[] = [tfTrigger.bias, tfSetup.bias, tfMacro.bias];
  const bullishCount = biases.filter(b => b === 'bullish').length;
  const bearishCount = biases.filter(b => b === 'bearish').length;

  if (
    (tfMacro.bias === 'bullish' && tfSetup.bias === 'bearish') ||
    (tfMacro.bias === 'bearish' && tfSetup.bias === 'bullish')
  ) {
    return {
      level: 'CONFLICT',
      description: `${labels.macro} ${tfMacro.bias} vs ${labels.setup} ${tfSetup.bias} — timeframes en conflicto, no operar`,
      scoreModifier: -40,
      alignedDirection: null,
    };
  }

  if (bullishCount === 3) {
    return {
      level: 'A+',
      description: `${labels.trigger} + ${labels.setup} + ${labels.macro} todos alcistas — alineación máxima`,
      scoreModifier: 15,
      alignedDirection: 'long',
    };
  }
  if (bearishCount === 3) {
    return {
      level: 'A+',
      description: `${labels.trigger} + ${labels.setup} + ${labels.macro} todos bajistas — alineación máxima`,
      scoreModifier: 15,
      alignedDirection: 'short',
    };
  }

  if (tfSetup.bias === 'bullish' && tfMacro.bias === 'bullish') {
    return {
      level: 'A',
      description: `${labels.setup} + ${labels.macro} alcistas (${labels.trigger} esperando)`,
      scoreModifier: 5,
      alignedDirection: 'long',
    };
  }
  if (tfSetup.bias === 'bearish' && tfMacro.bias === 'bearish') {
    return {
      level: 'A',
      description: `${labels.setup} + ${labels.macro} bajistas (${labels.trigger} esperando)`,
      scoreModifier: 5,
      alignedDirection: 'short',
    };
  }

  if (tfSetup.bias === 'bullish' && tfTrigger.bias === 'bullish' && tfMacro.bias === 'neutral') {
    return {
      level: 'B',
      description: `${labels.setup} + ${labels.trigger} alcistas, ${labels.macro} neutral — entrada temprana`,
      scoreModifier: 0,
      alignedDirection: 'long',
    };
  }
  if (tfSetup.bias === 'bearish' && tfTrigger.bias === 'bearish' && tfMacro.bias === 'neutral') {
    return {
      level: 'B',
      description: `${labels.setup} + ${labels.trigger} bajistas, ${labels.macro} neutral — entrada temprana`,
      scoreModifier: 0,
      alignedDirection: 'short',
    };
  }

  if (tfSetup.bias === 'bullish' && tfTrigger.bias !== 'bearish' && tfMacro.bias !== 'bearish') {
    return {
      level: 'C',
      description: `Solo ${labels.setup} alcista — señal débil sin confirmación de otros TFs`,
      scoreModifier: -20,
      alignedDirection: 'long',
    };
  }
  if (tfSetup.bias === 'bearish' && tfTrigger.bias !== 'bullish' && tfMacro.bias !== 'bullish') {
    return {
      level: 'C',
      description: `Solo ${labels.setup} bajista — señal débil sin confirmación de otros TFs`,
      scoreModifier: -20,
      alignedDirection: 'short',
    };
  }

  return {
    level: 'NEUTRAL',
    description: 'Sin consenso multi-timeframe — esperar',
    scoreModifier: -15,
    alignedDirection: null,
  };
}

const MODE_LABELS: Record<AnalysisMode, { macro: string; setup: string; trigger: string }> = {
  swing: { macro: '1W', setup: '1D', trigger: '4H' },
  intraday: { macro: '4H', setup: '1H', trigger: '15M' },
  antivitalik: { macro: '1D', setup: '4H', trigger: '1H' },
};

export function getModeLabels(mode: AnalysisMode) {
  return MODE_LABELS[mode];
}

export function analyzeMarket(
  symbol: string,
  klinesTrigger: Kline[],
  klinesSetup: Kline[],
  klinesMacro: Kline[],
  context: {
    fearGreed: number | null;
    fearGreedLabel: string | null;
    funding: number | null;
    longShortRatio: number | null;
    btcDominance: number | null;
  },
  mode: AnalysisMode = 'swing'
): AnalysisResult {
  const labels = MODE_LABELS[mode];

  const tfTrigger = analyzeTimeframe(labels.trigger, klinesTrigger);
  const tfSetup = analyzeTimeframe(labels.setup, klinesSetup);
  const tfMacro = analyzeTimeframe(labels.macro, klinesMacro);
  const consensus = evaluateConsensus(tfTrigger, tfSetup, tfMacro, labels);

  const closes = klinesSetup.map(k => k.close);
  const lastPrice = closes[closes.length - 1];
  const prevPrice = closes[closes.length - 2] || lastPrice;
  const priceChange24h = ((lastPrice - prevPrice) / prevPrice) * 100;

  const longSignals: Signal[] = [
    {
      id: 'mtf-l',
      name: `Multi-TF alcista (${mode})`,
      description: `Consenso entre ${labels.trigger}, ${labels.setup} y ${labels.macro}`,
      weight: 30,
      triggered: consensus.alignedDirection === 'long' && (consensus.level === 'A+' || consensus.level === 'A'),
      value: `${consensus.level}: ${consensus.description}`,
    },
    {
      id: 'tf-setup-l',
      name: `Setup ${labels.setup} bullish`,
      description: `Tendencia ${labels.setup} alcista con fuerza > 50`,
      weight: 25,
      triggered: tfSetup.bias === 'bullish' && tfSetup.strength > 50,
      value: `Strength: ${tfSetup.strength}`,
    },
    {
      id: 'tf-trigger-l',
      name: `Trigger ${labels.trigger} bullish`,
      description: `Confirmación de timing en ${labels.trigger}`,
      weight: 20,
      triggered: tfTrigger.bias === 'bullish' && tfTrigger.strength > 40,
      value: `Strength: ${tfTrigger.strength}`,
    },
    {
      id: 'fund-l',
      name: 'Funding rate bajo o negativo',
      description: 'Funding < 0.005% (si disponible)',
      weight: 5,
      triggered: context.funding !== null && context.funding < 0.00005,
      value: context.funding !== null ? `${(context.funding * 100).toFixed(4)}%` : 'N/A',
    },
    {
      id: 'ls-l',
      name: 'Top traders posicionados long',
      description: 'Long/Short ratio > 1.5 (si disponible)',
      weight: 5,
      triggered: context.longShortRatio !== null && context.longShortRatio > 1.5,
      value: context.longShortRatio !== null ? `${context.longShortRatio.toFixed(2)}` : 'N/A',
    },
    {
      id: 'fg-l',
      name: 'Sentimiento de miedo extremo',
      description: 'Fear & Greed < 30',
      weight: 10,
      triggered: context.fearGreed !== null && context.fearGreed < 30,
      value: context.fearGreed !== null ? `F&G: ${context.fearGreed}` : 'N/A',
    },
    {
      id: 'rsi-l',
      name: `RSI ${labels.setup} no sobrecomprado`,
      description: 'RSI < 70 deja espacio para subir',
      weight: 15,
      triggered: tfSetup.indicators.rsi < 70 && tfSetup.indicators.rsi > 40,
      value: `RSI: ${tfSetup.indicators.rsi.toFixed(1)}`,
    },
  ];

  const shortSignals: Signal[] = [
    {
      id: 'mtf-s',
      name: `Multi-TF bajista (${mode})`,
      description: `Consenso entre ${labels.trigger}, ${labels.setup} y ${labels.macro}`,
      weight: 30,
      triggered: consensus.alignedDirection === 'short' && (consensus.level === 'A+' || consensus.level === 'A'),
      value: `${consensus.level}: ${consensus.description}`,
    },
    {
      id: 'tf-setup-s',
      name: `Setup ${labels.setup} bearish`,
      description: `Tendencia ${labels.setup} bajista con fuerza > 50`,
      weight: 25,
      triggered: tfSetup.bias === 'bearish' && tfSetup.strength > 50,
      value: `Strength: ${tfSetup.strength}`,
    },
    {
      id: 'tf-trigger-s',
      name: `Trigger ${labels.trigger} bearish`,
      description: `Confirmación de timing en ${labels.trigger}`,
      weight: 20,
      triggered: tfTrigger.bias === 'bearish' && tfTrigger.strength > 40,
      value: `Strength: ${tfTrigger.strength}`,
    },
    {
      id: 'fund-s',
      name: 'Funding rate extremo positivo',
      description: 'Funding > 0.05% (si disponible)',
      weight: 5,
      triggered: context.funding !== null && context.funding > 0.0005,
      value: context.funding !== null ? `${(context.funding * 100).toFixed(4)}%` : 'N/A',
    },
    {
      id: 'ls-s',
      name: 'Top traders posicionados short',
      description: 'Long/Short ratio < 0.7 (si disponible)',
      weight: 5,
      triggered: context.longShortRatio !== null && context.longShortRatio < 0.7,
      value: context.longShortRatio !== null ? `${context.longShortRatio.toFixed(2)}` : 'N/A',
    },
    {
      id: 'fg-s',
      name: 'Sentimiento de codicia extrema',
      description: 'Fear & Greed > 75',
      weight: 10,
      triggered: context.fearGreed !== null && context.fearGreed > 75,
      value: context.fearGreed !== null ? `F&G: ${context.fearGreed}` : 'N/A',
    },
    {
      id: 'rsi-s',
      name: `RSI ${labels.setup} no sobrevendido`,
      description: 'RSI > 30 deja espacio para bajar',
      weight: 15,
      triggered: tfSetup.indicators.rsi > 30 && tfSetup.indicators.rsi < 60,
      value: `RSI: ${tfSetup.indicators.rsi.toFixed(1)}`,
    },
  ];

  let longScore = longSignals.filter(s => s.triggered).reduce((sum, s) => sum + s.weight, 0);
  let shortScore = shortSignals.filter(s => s.triggered).reduce((sum, s) => sum + s.weight, 0);

  if (consensus.alignedDirection === 'long') {
    longScore = Math.max(0, Math.min(100, longScore + consensus.scoreModifier));
  } else if (consensus.alignedDirection === 'short') {
    shortScore = Math.max(0, Math.min(100, shortScore + consensus.scoreModifier));
  } else {
    longScore = Math.max(0, longScore + consensus.scoreModifier);
    shortScore = Math.max(0, shortScore + consensus.scoreModifier);
  }

  let verdict: 'long' | 'short' | 'neutral' | 'wait' = 'wait';
  if (consensus.level === 'CONFLICT') {
    verdict = 'wait';
  } else if (longScore >= 60 && longScore > shortScore + 20) {
    verdict = 'long';
  } else if (shortScore >= 60 && shortScore > longScore + 20) {
    verdict = 'short';
  } else if (Math.abs(longScore - shortScore) < 20) {
    verdict = 'neutral';
  }

  const { supports, resistances } = detectSupportResistance(klinesSetup, 5);
  const fibonacci = calculateFibonacci(klinesSetup, 100);
  const nearestSupport = supports.length > 0 ? supports[0] : null;
  const nearestResistance = resistances.length > 0 ? resistances[0] : null;

  return {
    symbol,
    mode,
    price: lastPrice,
    priceChange24h,
    tfMacro,
    tfSetup,
    tfTrigger,
    tfLabels: labels,
    consensus,
    longSignals,
    shortSignals,
    longScore,
    shortScore,
    verdict,
    indicators: {
      rsi: tfSetup.indicators.rsi,
      ema50: tfSetup.indicators.ema50,
      ema200: tfSetup.indicators.ema200,
      macdHist: tfSetup.indicators.macdHist,
      macdCross: tfSetup.indicators.macdCross,
      volumeRatio: tfSetup.indicators.volumeRatio,
    },
    context,
    levels: { supports, resistances, fibonacci, nearestSupport, nearestResistance },
    timestamp: Date.now(),
  };
}
