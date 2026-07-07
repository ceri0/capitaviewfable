// API utilities for DeFiDash

export async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

// Canonical price source for the whole app: CoinGecko's /coins/markets endpoint
// (volume-weighted aggregate across exchanges — same source as Markets/Live Prices).
// Takes an array of CoinGecko coin ids and returns a map of
// id -> { price, change24h }. Throws on HTTP/network errors (callers should
// .catch and fall back gracefully, matching existing fetch conventions).
export async function fetchCoinGeckoPrices(ids) {
  if (!ids || ids.length === 0) return {};
  const data = await fetchJSON(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids.join(",")}`
  );
  return (Array.isArray(data) ? data : []).reduce((map, coin) => {
    map[coin.id] = {
      price: coin.current_price,
      change24h: coin.price_change_percentage_24h,
    };
    return map;
  }, {});
}

// Full markets listing from CoinGecko's /coins/markets endpoint — the same
// canonical source as fetchCoinGeckoPrices, but returns the raw coin objects
// with ALL fields (market_cap, total_volume, sparkline_in_7d, market_cap_rank,
// etc.) for a page of top coins by market cap, rather than a curated id list.
// Used by Markets.jsx so the endpoint/URL lives in one place.
// Throws on HTTP/network errors (callers should catch and handle).
export async function fetchCoinGeckoMarkets({
  perPage = 100,
  page = 1,
  sparkline = false,
  priceChangePercentage,
} = {}) {
  let url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=${sparkline}`;
  if (priceChangePercentage) {
    url += `&price_change_percentage=${priceChangePercentage}`;
  }
  const data = await fetchJSON(url);
  return Array.isArray(data) ? data : [];
}

export function formatNumber(num) {
  if (num === null || num === undefined) return "N/A";
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
}

export function formatNumberPlain(num) {
  if (num === null || num === undefined) return "N/A";
  return num.toLocaleString();
}

export function formatPercent(num) {
  if (num === null || num === undefined) return "N/A";
  const sign = num >= 0 ? "+" : "";
  return `${sign}${num.toFixed(2)}%`;
}

export function formatDate(unixTimestamp) {
  return new Date(unixTimestamp * 1000).toLocaleDateString();
}

export function formatTVL(tvl) {
  if (tvl === null || tvl === undefined) return "N/A";
  return formatNumber(tvl);
}