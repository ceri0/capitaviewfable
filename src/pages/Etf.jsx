import React, { useState, useEffect, useMemo, useRef } from "react";
import { Search, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import ExportCsvButton from "@/components/ExportCsvButton";

// SoSoValue Open API — keyed, free tier is limited to 20 requests/minute
// (and 100k/month), per https://sosovalue.gitbook.io/soso-value-api-doc/rate-limit.
// One full page load for an asset costs ~14-16 requests (2 summaries + 1 fund
// list + 1 market-snapshot per ticker), so we refresh slowly: ETF flow data
// only changes once per US trading day anyway.
//
// Response envelope (verified live): { code: 0, message: "success", data: ..., details: null }
// - /etfs/summary-history data: array (newest first, dates can repeat as the
//   latest day gets revised intraday) of { date, total_net_inflow,
//   total_value_traded, total_net_assets, cum_net_inflow } — all USD numbers.
// - /etfs data: array of { ticker, name, exchange }.
// - /etfs/{ticker}/market-snapshot data: single object { date, ticker,
//   sponsor_fee, net_inflow, cum_inflow, net_assets, mkt_price, value_traded,
//   volume (string) }. NOTE: the documented prem_dsc field was absent in live
//   responses, so it is not relied upon here.
const API_BASE = "https://openapi.sosovalue.com/openapi/v1";
const API_KEY = import.meta.env.VITE_SOSOVALUE_API_KEY;
const REFRESH_MS = 10 * 60 * 1000; // 10 minutes — keeps well clear of the 20 req/min cap
const ASSETS = ["BTC", "ETH"];

async function sosoFetch(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "x-soso-api-key": API_KEY },
  });
  if (res.status === 429) throw new Error("RATE_LIMIT");
  if (res.status === 401 || res.status === 403) throw new Error("AUTH");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== 0) {
    if (json.code === 42901) throw new Error("RATE_LIMIT"); // documented rate-limit code
    if (json.code === 40101 || json.code === 40301) throw new Error("AUTH");
    throw new Error(json.message || `SoSoValue API error (code ${json.code})`);
  }
  return json.data;
}

function friendlyError(err) {
  if (err?.message === "RATE_LIMIT")
    return "SoSoValue rate limit hit (free tier allows 20 requests/minute). Wait a minute, then refresh.";
  if (err?.message === "AUTH")
    return "SoSoValue API key is missing or invalid. Set VITE_SOSOVALUE_API_KEY in .env and restart the dev server.";
  return `Unable to load ETF data from SoSoValue: ${err?.message || "unknown error"}`;
}

export default function Etf() {
  const [summaries, setSummaries] = useState({ BTC: null, ETH: null });
  const [funds, setFunds] = useState([]);
  const [asset, setAsset] = useState("BTC");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [partialNotice, setPartialNotice] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 25;

  // Per-asset cache so toggling BTC <-> ETH doesn't re-spend ~12 API calls
  // (and risk the 20/min rate limit) when we already have fresh data.
  const fundsCacheRef = useRef({});
  const summariesLoadedRef = useRef(false);

  const fetchSummaries = async () => {
    const results = await Promise.allSettled(
      ASSETS.map((sym) =>
        sosoFetch(`/etfs/summary-history?symbol=${sym}&country_code=US&limit=5`)
      )
    );
    const next = {};
    ASSETS.forEach((sym, i) => {
      const r = results[i];
      // Newest-first; the first row for the latest date is the most recent revision.
      next[sym] =
        r.status === "fulfilled" && Array.isArray(r.value) && r.value.length > 0
          ? r.value[0]
          : null;
    });
    setSummaries(next);
    summariesLoadedRef.current = Object.values(next).some((v) => v !== null);
    // Surface auth/rate-limit problems even if only the summaries failed.
    const firstRejection = results.find((r) => r.status === "rejected");
    if (!summariesLoadedRef.current && firstRejection) throw firstRejection.reason;
  };

  const fetchFunds = async (sym) => {
    const list = await sosoFetch(`/etfs?symbol=${sym}&country_code=US`);
    if (!Array.isArray(list) || list.length === 0) {
      throw new Error(`No ${sym} ETFs returned`);
    }
    const snaps = await Promise.allSettled(
      list.map((etf) =>
        sosoFetch(`/etfs/${encodeURIComponent(etf.ticker)}/market-snapshot`)
      )
    );
    const rows = [];
    let failed = 0;
    let rateLimited = false;
    snaps.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value) {
        rows.push({ ...list[i], ...r.value });
      } else {
        failed++;
        if (r.status === "rejected" && r.reason?.message === "RATE_LIMIT") rateLimited = true;
      }
    });
    if (rows.length === 0) {
      throw rateLimited ? new Error("RATE_LIMIT") : new Error(`No ${sym} fund snapshots returned`);
    }
    rows.sort((a, b) => (b.net_assets ?? 0) - (a.net_assets ?? 0));
    return { rows, failed, rateLimited, fetchedAt: Date.now() };
  };

  const loadData = async (sym, { force = false } = {}) => {
    if (!API_KEY) {
      setError(friendlyError(new Error("AUTH")));
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const cached = fundsCacheRef.current[sym];
      const cacheFresh = cached && Date.now() - cached.fetchedAt < REFRESH_MS;

      const tasks = [];
      if (force || !summariesLoadedRef.current) tasks.push(fetchSummaries());
      const needFunds = force || !cacheFresh;
      if (needFunds) tasks.push(fetchFunds(sym).then((r) => (fundsCacheRef.current[sym] = r)));
      await Promise.all(tasks);

      const result = fundsCacheRef.current[sym];
      setFunds(result.rows);
      setPartialNotice(
        result.failed > 0
          ? `${result.failed} fund snapshot${result.failed > 1 ? "s" : ""} could not be loaded${
              result.rateLimited ? " (rate-limited — try refreshing in a minute)" : ""
            }.`
          : null
      );
      setLastUpdated(new Date());
    } catch (err) {
      console.error("ETF (SoSoValue) error:", err);
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    loadData(asset);
    // Slow auto-refresh: flows update once per trading day, and the free API
    // tier only allows 20 requests/minute.
    const interval = setInterval(() => loadData(asset, { force: true }), REFRESH_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset]);

  const filteredFunds = useMemo(() => {
    if (!search) return funds;
    const q = search.toLowerCase();
    return funds.filter(
      (f) => f.ticker?.toLowerCase().includes(q) || f.name?.toLowerCase().includes(q)
    );
  }, [funds, search]);

  const totalPages = Math.max(1, Math.ceil(filteredFunds.length / rowsPerPage));
  const paginatedFunds = filteredFunds.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const csvData = useMemo(
    () =>
      filteredFunds.map((f) => ({
        ticker: f.ticker,
        name: f.name,
        exchange: f.exchange,
        snapshot_date: f.date,
        daily_net_inflow_usd: f.net_inflow,
        cumulative_inflow_usd: f.cum_inflow,
        net_assets_usd: f.net_assets,
        market_price_usd: f.mkt_price,
        sponsor_fee: f.sponsor_fee,
      })),
    [filteredFunds]
  );

  const formatUsd = (v) => {
    if (v === null || v === undefined || !Number.isFinite(v)) return "—";
    const abs = Math.abs(v);
    let s;
    if (abs >= 1e9) s = `$${(abs / 1e9).toFixed(2)}B`;
    else if (abs >= 1e6) s = `$${(abs / 1e6).toFixed(2)}M`;
    else if (abs >= 1e3) s = `$${(abs / 1e3).toFixed(1)}K`;
    else s = `$${abs.toFixed(2)}`;
    return v < 0 ? `-${s}` : s;
  };

  const flowClass = (v) =>
    v === null || v === undefined || !Number.isFinite(v)
      ? "text-[#6b7280]"
      : v >= 0
        ? "text-[#34d399]"
        : "text-red-400";

  const formatFee = (fee) =>
    fee === null || fee === undefined || !Number.isFinite(fee) ? "—" : `${(fee * 100).toFixed(2)}%`;

  const formatPrice = (p) =>
    p === null || p === undefined || !Number.isFinite(p)
      ? "—"
      : `$${p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading && funds.length === 0 && !error) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-[#22222f] border border-[#2d2d3d] rounded-xl animate-pulse"></div>
          ))}
        </div>
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-6 shadow-lg">
          <div className="h-4 w-32 bg-[#2d2d3d] rounded mb-6 animate-pulse"></div>
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-12 bg-[#2d2d3d] rounded mb-3 animate-pulse" style={{ animationDelay: `${i * 50}ms` }}></div>
          ))}
        </div>
      </div>
    );
  }

  if (error && funds.length === 0) {
    return (
      <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-8 text-center">
        <div className="text-white font-semibold mb-2">Unable to Load ETF Data</div>
        <div className="text-[#6b7280] text-sm mb-4">{error}</div>
        <button
          onClick={() => loadData(asset, { force: true })}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#a97bd1] text-white text-sm rounded-lg hover:bg-[#9465c4] transition-colors"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    );
  }

  const summaryCards = ASSETS.flatMap((sym) => {
    const s = summaries[sym];
    return [
      {
        key: `${sym}-flow`,
        label: `${sym} ETF Daily Net Flow`,
        value: s ? formatUsd(s.total_net_inflow) : "—",
        valueClass: s ? flowClass(s.total_net_inflow) : "text-white",
        sub: s?.date ? `US spot ${sym} ETFs · ${s.date}` : `US spot ${sym} ETFs`,
      },
      {
        key: `${sym}-aum`,
        label: `${sym} ETF Net Assets`,
        value: s ? formatUsd(s.total_net_assets) : "—",
        valueClass: "text-white",
        sub: s ? `Cumulative inflow ${formatUsd(s.cum_net_inflow)}` : "",
      },
    ];
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Crypto ETF Flows</h1>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-xs text-[#6b7280]">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => loadData(asset, { force: true })}
            className="flex items-center gap-2 px-4 py-2.5 text-sm bg-[#22222f] border border-[#2d2d3d] rounded-lg text-[#6b7280] hover:border-[#a97bd1] hover:text-white transition-colors"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards — aggregate US spot ETF flows from /etfs/summary-history */}
      <div className="grid grid-cols-4 gap-6">
        {summaryCards.map((card) => (
          <div key={card.key} className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
            <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">{card.label}</div>
            <div className={`text-2xl font-bold ${card.valueClass}`}>{card.value}</div>
            {card.sub && <div className="text-[11px] text-[#6b7280] mt-1">{card.sub}</div>}
          </div>
        ))}
      </div>

      {/* Asset toggle + search */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex bg-[#22222f] border border-[#2d2d3d] rounded-lg p-1">
          {ASSETS.map((sym) => (
            <button
              key={sym}
              onClick={() => setAsset(sym)}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                asset === sym
                  ? "bg-[#a97bd1] text-white font-semibold"
                  : "text-[#6b7280] hover:text-white"
              }`}
            >
              {sym} ETFs
            </button>
          ))}
        </div>
        <div className="relative max-w-md flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280]" size={16} />
          <input
            type="text"
            placeholder="Search by ticker or fund name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 bg-[#22222f] border border-[#2d2d3d] rounded-lg text-sm text-white placeholder-[#6b7280] focus:outline-none focus:border-[#a97bd1] transition-colors"
          />
        </div>
      </div>

      {(partialNotice || (error && funds.length > 0)) && (
        <div className="bg-[#22222f] border border-[#a97bd1]/40 rounded-xl px-4 py-3 text-sm text-[#c4b5fd]">
          {error || partialNotice}
        </div>
      )}

      {/* Per-fund table — one /etfs/{ticker}/market-snapshot call per row */}
      <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-6 shadow-lg overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide">
            US Spot {asset} ETFs — Flows &amp; Net Assets
          </h2>
          <ExportCsvButton data={csvData} filename={`etf-${asset.toLowerCase()}-flows.csv`} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[11px] text-[#6b7280] uppercase tracking-wide border-b border-[#2d2d3d]">
                <th className="py-3 px-4 font-semibold">#</th>
                <th className="py-3 px-4 font-semibold">Fund</th>
                <th className="py-3 px-4 font-semibold text-right">Daily Net Inflow</th>
                <th className="py-3 px-4 font-semibold text-right">Cumulative Inflow</th>
                <th className="py-3 px-4 font-semibold text-right">Net Assets</th>
                <th className="py-3 px-4 font-semibold text-right">Mkt Price</th>
                <th className="py-3 px-4 font-semibold text-right">Fee</th>
              </tr>
            </thead>
            <tbody>
              {paginatedFunds.map((fund, index) => {
                const globalIndex = (currentPage - 1) * rowsPerPage + index + 1;
                return (
                  <tr
                    key={fund.ticker || index}
                    className="border-b border-[#2d2d3d] last:border-b-0 hover:bg-[#2d2d3d]/30 transition-colors"
                  >
                    <td className="py-4 px-4 text-[#6b7280]">{globalIndex}</td>
                    <td className="py-4 px-4">
                      <div className="text-white font-medium">{fund.ticker}</div>
                      <div className="text-xs text-[#6b7280]">
                        {fund.name}
                        {fund.exchange ? ` · ${fund.exchange}` : ""}
                      </div>
                    </td>
                    <td className={`py-4 px-4 text-right font-semibold ${flowClass(fund.net_inflow)}`}>
                      {formatUsd(fund.net_inflow)}
                    </td>
                    <td className={`py-4 px-4 text-right font-semibold ${flowClass(fund.cum_inflow)}`}>
                      {formatUsd(fund.cum_inflow)}
                    </td>
                    <td className="py-4 px-4 text-right text-white font-semibold">
                      {formatUsd(fund.net_assets)}
                    </td>
                    <td className="py-4 px-4 text-right text-white">{formatPrice(fund.mkt_price)}</td>
                    <td className="py-4 px-4 text-right text-[#6b7280]">{formatFee(fund.sponsor_fee)}</td>
                  </tr>
                );
              })}
              {paginatedFunds.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#6b7280] text-sm">
                    No funds match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-5 border-t border-[#2d2d3d]">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-[#1c1c27] border border-[#2d2d3d] rounded-lg text-[#6b7280] disabled:opacity-50 disabled:cursor-not-allowed hover:border-[#a97bd1] hover:text-white transition-colors"
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <span className="text-sm text-[#6b7280]">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-[#1c1c27] border border-[#2d2d3d] rounded-lg text-[#6b7280] disabled:opacity-50 disabled:cursor-not-allowed hover:border-[#a97bd1] hover:text-white transition-colors"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        <div className="pt-4 mt-2 border-t border-[#2d2d3d] text-[11px] text-[#6b7280]">
          Daily fund snapshots from SoSoValue{funds[0]?.date ? ` (as of ${funds[0].date})` : ""}.
          Flow data updates once per US trading day; this page auto-refreshes every 10 minutes to
          respect the API&apos;s 20 requests/minute limit.
        </div>
      </div>
    </div>
  );
}
