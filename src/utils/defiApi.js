export async function fetchHomeData() {
  try {
    const [globalTvlRes, poolsRes, stablecoinsRes, dexsRes, feesRes] = await Promise.all([
      fetch("https://api.llama.fi/v2/globalTvl"),
      fetch("https://yields.llama.fi/pools"),
      fetch("https://stablecoins.llama.fi/stablecoins"),
      fetch("https://api.llama.fi/overview/dexs"),
      fetch("https://api.llama.fi/overview/fees"),
    ]);

    if (!globalTvlRes.ok || !poolsRes.ok || !stablecoinsRes.ok || !dexsRes.ok || !feesRes.ok) {
      throw new Error("Failed to fetch home data");
    }

    const [globalTvl, pools, stablecoins, dexs, fees] = await Promise.all([
      globalTvlRes.json(),
      poolsRes.json(),
      stablecoinsRes.json(),
      dexsRes.json(),
      feesRes.json(),
    ]);

    const stablecoinsMarketCap = stablecoins.peggedAssets.reduce(
      (sum, sc) => sum + (sc.circulating?.peggedUSD || 0),
      0
    );

    return {
      totalTvl: globalTvl.tvl || 0,
      tvl24hChange: globalTvl.tvlPrevDay24hPct || 0,
      totalPools: pools.data?.length || 0,
      stablecoinsMarketCap,
      dexVolume24h: dexs.total24h || 0,
      fees24h: fees.total24h || 0,
    };
  } catch (error) {
    console.error("Error fetching home data:", error);
    throw error;
  }
}

export async function fetchTvlHistory() {
  try {
    const res = await fetch("https://api.llama.fi/v2/historicalChainTvl");
    if (!res.ok) throw new Error("Failed to fetch TVL history");
    const data = await res.json();
    const last30 = data.slice(-30);
    return last30.map((item) => ({
      date: new Date(item.date * 1000).toLocaleDateString(),
      tvl: item.tvl,
    }));
  } catch (error) {
    console.error("Error fetching TVL history:", error);
    throw error;
  }
}

export async function fetchProtocols() {
  try {
    const res = await fetch("https://api.llama.fi/protocols");
    if (!res.ok) throw new Error(`Failed to fetch protocols: ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Invalid data format received");
    return data.sort((a, b) => (b.tvl || 0) - (a.tvl || 0));
  } catch (error) {
    console.error("Error fetching protocols:", error);
    throw error;
  }
}

export async function fetchYields() {
  try {
    const res = await fetch("https://yields.llama.fi/pools");
    if (!res.ok) throw new Error("Failed to fetch yields");
    const data = await res.json();
    return data.data?.filter(
      (pool) =>
        pool.apy !== null &&
        pool.apy <= 10000 &&
        pool.tvlUsd >= 1000
    ) || [];
  } catch (error) {
    console.error("Error fetching yields:", error);
    throw error;
  }
}

export async function fetchChains() {
  try {
    const res = await fetch("https://api.llama.fi/v2/chains");
    if (!res.ok) throw new Error("Failed to fetch chains");
    const data = await res.json();
    return data.sort((a, b) => (b.tvl || 0) - (a.tvl || 0));
  } catch (error) {
    console.error("Error fetching chains:", error);
    throw error;
  }
}

export async function fetchStablecoins() {
  try {
    const res = await fetch("https://stablecoins.llama.fi/stablecoins?includePrices=true");
    if (!res.ok) throw new Error("Failed to fetch stablecoins");
    const data = await res.json();
    return data.peggedAssets.sort(
      (a, b) => (b.circulating?.peggedUSD || 0) - (a.circulating?.peggedUSD || 0)
    );
  } catch (error) {
    console.error("Error fetching stablecoins:", error);
    throw error;
  }
}

export async function fetchDexVolumes() {
  try {
    const res = await fetch("https://api.llama.fi/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true");
    if (!res.ok) throw new Error("Failed to fetch DEX volumes");
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Error fetching DEX volumes:", error);
    throw error;
  }
}

export async function fetchFees() {
  try {
    const res = await fetch("https://api.llama.fi/overview/fees");
    if (!res.ok) throw new Error("Failed to fetch fees");
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Error fetching fees:", error);
    throw error;
  }
}

export function formatNumber(num) {
  if (num === null || num === undefined) return "0";
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
}

export function formatPercent(num) {
  if (num === null || num === undefined) return "0%";
  return `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`;
}