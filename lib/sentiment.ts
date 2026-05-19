export async function fetchFearGreed(): Promise<{ value: number; classification: string } | null> {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1', { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.data && data.data[0]) {
      return {
        value: parseInt(data.data[0].value),
        classification: data.data[0].value_classification,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchGlobalData(): Promise<{ btcDominance: number; totalMcap: number } | null> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/global', { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      btcDominance: data.data.market_cap_percentage.btc,
      totalMcap: data.data.total_market_cap.usd,
    };
  } catch {
    return null;
  }
}
