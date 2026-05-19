'use client';

import { useEffect, useRef, memo } from 'react';

type Props = {
  symbol: string;
  interval?: string;
  height?: number;
};

function MiniChartImpl({ symbol, interval = 'D', height = 240 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const dateRange = interval === 'W' ? '3M' : interval === '240' ? '1M' : '1M';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: `BYBIT:${symbol}`,
      width: '100%',
      height: height,
      locale: 'es',
      dateRange,
      colorTheme: 'dark',
      isTransparent: true,
      autosize: false,
      chartOnly: true,
      noTimeScale: false,
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [symbol, interval, height]);

  return (
    <div
      className="tradingview-widget-container"
      ref={containerRef}
      style={{ height, width: '100%' }}
    />
  );
}

export const MiniChart = memo(MiniChartImpl);
