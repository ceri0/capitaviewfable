// API utilities for DeFiDash

export async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
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