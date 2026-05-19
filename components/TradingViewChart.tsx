'use client';

import { useEffect, useRef, memo } from 'react';

type Props = {
  symbol: string;
  interval?: string;
  height?: number;
  studies?: string[];
};

function TradingViewChartImpl({
  symbol,
  interval = 'D',
  height = 800,
  studies = ['STD;EMA'],
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      width: '100%',
      height: height,
      symbol: `BYBIT:${symbol}`,
      interval,
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'es',
      enable_publishing: false,
      backgroundColor: 'rgba(17, 21, 15, 1)',
      gridColor: 'rgba(45, 61, 40, 0.5)',
      allow_symbol_change: false,
      save_image: false,
      studies,
      support_host: 'https://www.tradingview.com',
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [symbol, interval, height, JSON.stringify(studies)]);

  return (
    <div
      className="tradingview-widget-container"
      ref={containerRef}
      style={{
        height: `${height}px`,
        width: '100%',
        background: 'var(--bg-elev)',
        border: '1px solid var(--line-bright)',
      }}
    />
  );
}

export const TradingViewChart = memo(TradingViewChartImpl);
