import React, { useState, useEffect } from "react";
import { RefreshCw, ExternalLink } from "lucide-react";
import { formatNumber } from "@/utils/api";

// DAO treasury tracker built on Safe's public Transaction Service API
// (DeFiLlama's broader /treasuries endpoint moved behind their Pro tier, so
// this page now tracks a curated, manually verified set of major protocol
// treasuries via their public Safe multisig wallets instead).
//
// Data flow per treasury (verified live):
// 1. GET https://api.safe.global/tx-service/eth/api/v1/safes/{address}/balances/
//    -> JSON array of { tokenAddress, token, balance }. Native ETH rows have
//    tokenAddress === null and token === null; ERC-20 rows have
//    token = { name, symbol, decimals, logoUri } and balance as a raw integer
//    string in the token's smallest unit.
//    IMPORTANT: this endpoint is CASE-SENSITIVE — it requires the exact
//    EIP-55 checksummed address. The same address in all-lowercase returns an
//    empty response (verified live), so the addresses below must be passed
//    through EXACTLY as written. Do not lowercase or transform them.
// 2. GET https://api.coingecko.com/api/v3/simple/token_price/ethereum
//    ?contract_addresses=...&vs_currencies=usd (one batched call per treasury)
//    -> { "<lowercase contract address>": { usd: <price> }, ... }. NOTE: the
//    response keys are ALWAYS lowercase even when the request used checksummed
//    addresses (verified live), so lookups must lowercase the Safe-provided
//    tokenAddress — but only for this price map, never for the Safe URL.
// 3. Native ETH is priced separately via /simple/price?ids=ethereum (one
//    shared call per page load).
//
// Spam filtering: active treasuries accumulate hundreds of scam airdrop
// tokens ("Visit xyz.com to claim rewards"). We deliberately keep only
// holdings that CoinGecko returns a real USD price for — spam tokens aren't
// listed there, so they drop out naturally. No manual denylist.
const TREASURIES = [
  { name: "Gitcoin", subtitle: "Matching Pool Multisig", address: "0xde21F729137C5Af1b01d73aF1dC21eFfa2B8a0d6" },
  { name: "Balancer", subtitle: "DAO Multisig", address: "0x10A19e7eE7d7F8a52822f6817de8ea18204F2e4f" },
  { name: "Aave", subtitle: "Treasury", address: "0x89C51828427F70D77875C6747759fB17Ba10Ceb0" },
  { name: "BanklessDAO", subtitle: "Treasury", address: "0xf26d1Bb347a59F6C283C53156519cC1B1ABacA51" },
  { name: "ShapeShift DAO", subtitle: "Treasury", address: "0x90A48D5CF7343B08dA12E067680B4C6dbfE551Be" },
  { name: "Yearn Finance", subtitle: "ychad.eth Multisig", address: "0xFEB4acf3df3cDEA7399794D0869ef76A6EfAff52" },
];

const SAFE_BASE = "https://api.safe.global/tx-service/eth/api/v1/safes";
// Treasury balances move slowly; a 10 minute refresh (same reasoning as
// Etf.jsx) also keeps the ~13 requests per load well clear of CoinGecko's
// free-tier rate limit.
const REFRESH_MS = 10 * 60 * 1000;
// Keep token_price URLs a sane length for treasuries holding 100+ tokens.
const PRICE_CHUNK_SIZE = 100;
const TOP_HOLDINGS = 5;

async function fetchJson(url) {
  const res = await fetch(url);
  if (res.status === 429) throw new Error("Rate limited by price API — retry in a minute");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchEthPriceUsd() {
  const data = await fetchJson(
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
  );
  const price = data?.ethereum?.usd;
  return typeof price === "number" && price > 0 ? price : null;
}

// Fetch + price a single treasury. Throws on failure so Promise.allSettled
// in loadData can isolate it — one broken treasury never blanks the page.
async function loadTreasury(treasury, ethPriceUsd) {
  // Address must stay exactly as checksummed — the Safe API is case-sensitive.
  const balances = await fetchJson(`${SAFE_BASE}/${treasury.address}/balances/`);
  if (!Array.isArray(balances)) throw new Error("Unexpected Safe balances response");

  const erc20s = balances.filter(
    (b) => b.tokenAddress && b.token && Number.isFinite(b.token.decimals)
  );

  // One batched CoinGecko call per treasury (chunked only for very long lists).
  const priceMap = {};
  const addresses = erc20s.map((b) => b.tokenAddress);
  for (let i = 0; i < addresses.length; i += PRICE_CHUNK_SIZE) {
    const chunk = addresses.slice(i, i + PRICE_CHUNK_SIZE);
    const prices = await fetchJson(
      `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${chunk.join(",")}&vs_currencies=usd`
    );
    Object.assign(priceMap, prices || {});
  }

  const holdings = [];
  erc20s.forEach((b) => {
    // Price map keys are lowercase regardless of request casing.
    const price = priceMap[b.tokenAddress.toLowerCase()]?.usd;
    if (typeof price !== "number" || price <= 0) return; // spam / unlisted -> drop
    const amount = Number(b.balance) / 10 ** b.token.decimals;
    const usd = amount * price;
    if (!Number.isFinite(usd) || usd <= 0) return;
    holdings.push({ symbol: b.token.symbol || "?", amount, usd });
  });

  // Native ETH row: tokenAddress === null, balance in wei.
  const native = balances.find((b) => b.tokenAddress === null);
  if (native && ethPriceUsd) {
    const amount = Number(native.balance) / 1e18;
    if (amount > 0) holdings.push({ symbol: "ETH", amount, usd: amount * ethPriceUsd });
  }

  holdings.sort((a, b) => b.usd - a.usd);
  return {
    // Total is computed from ALL priced holdings, not just the displayed top 5.
    totalUsd: holdings.reduce((sum, h) => sum + h.usd, 0),
    topHoldings: holdings.slice(0, TOP_HOLDINGS),
    pricedCount: holdings.length,
  };
}

function formatAmount(amount) {
  if (!Number.isFinite(amount)) return "—";
  if (amount >= 1e9) return `${(amount / 1e9).toFixed(2)}B`;
  if (amount >= 1e6) return `${(amount / 1e6).toFixed(2)}M`;
  if (amount >= 1e3) return `${(amount / 1e3).toFixed(1)}K`;
  if (amount >= 1) return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return amount.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function shortAddress(address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function Treasuries() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // ETH price is shared by all treasuries; if it fails we still show
      // ERC-20 holdings (native ETH just goes unpriced for this cycle).
      let ethPriceUsd = null;
      try {
        ethPriceUsd = await fetchEthPriceUsd();
      } catch (err) {
        console.error("ETH price lookup failed:", err);
      }

      // allSettled per treasury so one failing wallet/API call doesn't break
      // the whole page (same pattern as Etf.jsx fund snapshots).
      const results = await Promise.allSettled(
        TREASURIES.map((t) => loadTreasury(t, ethPriceUsd))
      );

      // Merge into previous rows instead of replacing wholesale: a treasury
      // that fails on a background refresh (e.g. a shared CoinGecko rate
      // limit hitting all 6 at once) keeps showing its last-known-good data
      // marked "stale" rather than getting wiped to a blank error card.
      // Only treasuries that have NEVER loaded successfully get "error".
      setRows((prevRows) => {
        const prevByAddress = Object.fromEntries(prevRows.map((r) => [r.address, r]));
        return TREASURIES.map((t, i) => {
          const r = results[i];
          if (r.status === "fulfilled") {
            return { ...t, status: "ok", ...r.value };
          }
          const errorMessage = r.reason?.message || "Failed to load";
          const prev = prevByAddress[t.address];
          if (prev && (prev.status === "ok" || prev.status === "stale")) {
            return { ...prev, status: "stale", errorMessage };
          }
          return { ...t, status: "error", errorMessage };
        });
      });

      setLastUpdated(new Date());
    } catch (err) {
      console.error("Treasuries error:", err);
      setError(err.message || "Unable to load treasury data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, REFRESH_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "ok" and "stale" both have real, displayable data — "stale" just means
  // the most recent refresh attempt failed and we're showing the last
  // successful load instead of wiping it out.
  const loaded = rows.filter((r) => r.status === "ok" || r.status === "stale");
  const staleRows = rows.filter((r) => r.status === "stale");
  const failed = rows.filter((r) => r.status === "error");
  const grandTotal = loaded.reduce((sum, r) => sum + r.totalUsd, 0);

  if (loading && rows.length === 0) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-72 bg-[#22222f] border border-[#2d2d3d] rounded-xl animate-pulse"></div>
        <div className="grid grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-[#22222f] border border-[#2d2d3d] rounded-xl animate-pulse"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-6 shadow-lg">
              <div className="h-4 w-24 bg-[#2d2d3d] rounded mb-4 animate-pulse"></div>
              <div className="h-8 w-32 bg-[#2d2d3d] rounded mb-6 animate-pulse"></div>
              {[...Array(5)].map((_, j) => (
                <div key={j} className="h-6 bg-[#2d2d3d] rounded mb-2 animate-pulse" style={{ animationDelay: `${j * 50}ms` }}></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Only show the full blank-page error when we have never successfully
  // loaded any treasury (e.g. the very first load failed outright). If we
  // have last-known-good data for at least one treasury, keep showing the
  // page — loadData() already downgrades failed refreshes to "stale" rows
  // instead of wiping them, so a transient failure here means every single
  // treasury has never once loaded, not just that the latest refresh failed.
  if (error || (rows.length > 0 && loaded.length === 0)) {
    const message = error || failed[0]?.errorMessage || "Unable to load treasury data";
    return (
      <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-8 text-center">
        <div className="text-white font-semibold mb-2">Unable to Load Treasury Data</div>
        <div className="text-[#6b7280] text-sm mb-4">{message}</div>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#a97bd1] text-white text-sm rounded-lg hover:bg-[#9465c4] transition-colors"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">DAO Treasuries</h1>
          <p className="text-sm text-[#6b7280] mt-1 max-w-2xl">
            Live on-chain balances for a curated set of major protocol treasuries, read directly
            from their public Safe multisig wallets on Ethereum. Holdings without a real market
            price are filtered out automatically.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-xs text-[#6b7280]">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 text-sm bg-[#22222f] border border-[#2d2d3d] rounded-lg text-[#6b7280] disabled:opacity-50 hover:border-[#a97bd1] hover:text-white transition-colors"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
          <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Combined Treasury Value</div>
          <div className="text-2xl font-bold text-white">{formatNumber(grandTotal)}</div>
          <div className="text-[11px] text-[#6b7280] mt-1">
            Sum of all priced holdings across {loaded.length} treasuries
          </div>
        </div>
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
          <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Treasuries Tracked</div>
          <div className="text-2xl font-bold text-white">
            {loaded.length}<span className="text-[#6b7280] text-lg"> / {TREASURIES.length}</span>
          </div>
          <div className="text-[11px] text-[#6b7280] mt-1">Manually verified Safe multisigs</div>
        </div>
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
          <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Largest Treasury</div>
          <div className="text-2xl font-bold text-white">
            {loaded.length > 0
              ? [...loaded].sort((a, b) => b.totalUsd - a.totalUsd)[0].name
              : "—"}
          </div>
          <div className="text-[11px] text-[#6b7280] mt-1">
            {loaded.length > 0
              ? formatNumber([...loaded].sort((a, b) => b.totalUsd - a.totalUsd)[0].totalUsd)
              : "No data loaded"}
          </div>
        </div>
      </div>

      {/* Partial-failure notice — treasuries that have NEVER loaded successfully */}
      {failed.length > 0 && loaded.length > 0 && (
        <div className="bg-[#22222f] border border-[#a97bd1]/40 rounded-xl px-4 py-3 text-sm text-[#c4b5fd]">
          {failed.map((f) => f.name).join(", ")} could not be loaded this cycle
          {failed[0]?.errorMessage ? ` (${failed[0].errorMessage})` : ""}. Other treasuries are
          unaffected — try refreshing in a minute.
        </div>
      )}

      {/* Stale notice — treasuries with real data that just failed to refresh */}
      {staleRows.length > 0 && (
        <div className="bg-[#22222f] border border-[#a97bd1]/40 rounded-xl px-4 py-3 text-sm text-[#c4b5fd]">
          {staleRows.map((f) => f.name).join(", ")} could not refresh this cycle
          {staleRows[0]?.errorMessage ? ` (${staleRows[0].errorMessage})` : ""} — showing the last
          successfully loaded data instead.
        </div>
      )}

      {/* Treasury cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {rows.map((t) => (
          <div key={t.address} className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-6 shadow-lg flex flex-col">
            <div className="flex items-start justify-between mb-1">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">{t.name}</span>
                  {t.status === "stale" && (
                    <span
                      className="text-[9px] uppercase tracking-wide text-[#c4b5fd] border border-[#a97bd1]/40 rounded px-1.5 py-0.5"
                      title={`Refresh failed: ${t.errorMessage}`}
                    >
                      Stale
                    </span>
                  )}
                </div>
                <div className="text-xs text-[#6b7280]">{t.subtitle}</div>
              </div>
              <a
                href={`https://etherscan.io/address/${t.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-[#6b7280] hover:text-[#a97bd1] transition-colors font-mono"
                title={t.address}
              >
                {shortAddress(t.address)}
                <ExternalLink size={11} />
              </a>
            </div>

            {t.status === "error" ? (
              <div className="flex-1 flex items-center justify-center py-8 text-center">
                <div>
                  <div className="text-sm text-[#6b7280] mb-1">Failed to load</div>
                  <div className="text-xs text-[#6b7280]">{t.errorMessage}</div>
                </div>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold text-white mt-3 mb-4">
                  {formatNumber(t.totalUsd)}
                </div>
                <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">
                  Top Holdings
                </div>
                <div className="space-y-1.5 flex-1">
                  {t.topHoldings.length === 0 && (
                    <div className="text-xs text-[#6b7280] py-2">No priced holdings found.</div>
                  )}
                  {t.topHoldings.map((h, i) => (
                    <div
                      key={`${h.symbol}-${i}`}
                      className="flex items-center justify-between text-sm border-b border-[#2d2d3d] last:border-b-0 pb-1.5 last:pb-0"
                    >
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className="text-white font-medium truncate">{h.symbol}</span>
                        <span className="text-[11px] text-[#6b7280]">{formatAmount(h.amount)}</span>
                      </div>
                      <span className="text-white font-semibold whitespace-nowrap">{formatNumber(h.usd)}</span>
                    </div>
                  ))}
                </div>
                {t.pricedCount > TOP_HOLDINGS && (
                  <div className="text-[11px] text-[#6b7280] mt-3">
                    + {t.pricedCount - TOP_HOLDINGS} more priced holding{t.pricedCount - TOP_HOLDINGS > 1 ? "s" : ""} included in total
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <div className="text-[11px] text-[#6b7280]">
        Balances from Safe Transaction Service (api.safe.global) · Prices from CoinGecko ·
        Unpriced/spam airdrop tokens are excluded · Auto-refreshes every 10 minutes.
      </div>
    </div>
  );
}
