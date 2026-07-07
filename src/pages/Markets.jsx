import React, { useState, useEffect, useMemo, useRef } from "react";
import { Search, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { fetchCoinGeckoMarkets } from "@/utils/api";
import ExportCsvButton from "@/components/ExportCsvButton";

// Merged replacement for the old separate Markets + Live Prices pages, which
// were near-duplicates of each other (same CoinGecko /coins/markets source,
// same table shape). This page keeps the best of both: 200 coins with 7d
// sparkline trend (from the old Markets) plus fast auto-refresh, a manual
// Refresh button, and a "last updated" timestamp (from the old Live Prices).
//
// Refresh cadence: CoinGecko's free public API (no key, called directly from
// the browser) has an undocumented rate limit in roughly the 10-30
// calls/minute range per client. One refresh here costs 2 calls (100 coins
// per page x 2 pages), so refreshing every 30s is ~4 calls/min — fast enough
// to feel live while staying well clear of the rate limit we've already hit
// elsewhere in this app during heavy testing.
const REFRESH_MS = 30 * 1000;

export default function Markets() {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCountdown, setRetryCountdown] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "market_cap_rank", direction: "asc" });
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  const countdownIntervalRef = useRef(null);

  const fetchCoins = async () => {
    try {
      setLoading(true);
      setRetryCountdown(null);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }

      // Fetch 2 pages (200 coins) in parallel; a failed page is skipped so
      // the other can still render rather than failing the whole load.
      const [page1, page2] = await Promise.all([
        fetchCoinGeckoMarkets({ perPage: 100, page: 1, sparkline: true }).catch(() => []),
        fetchCoinGeckoMarkets({ perPage: 100, page: 2, sparkline: true }).catch(() => []),
      ]);

      const allCoins = [...page1, ...page2];
      if (allCoins.length === 0) throw new Error("No data received");

      setCoins(allCoins);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("CoinGecko API error:", err);
      // Preserve whatever coins we already have on screen — a failed
      // refresh shouldn't wipe out perfectly good data that's already
      // displayed, it should just retry quietly in the background.
      setError("Rate limited by CoinGecko. Retrying...");
      setRetryCountdown(60);
      countdownIntervalRef.current = setInterval(() => {
        setRetryCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
            fetchCoins();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoins();
    const interval = setInterval(fetchCoins, REFRESH_MS);
    return () => {
      clearInterval(interval);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredCoins = useMemo(() => {
    if (!search) return coins;
    const searchLower = search.toLowerCase();
    return coins.filter(
      (c) =>
        c.name?.toLowerCase().includes(searchLower) ||
        c.symbol?.toLowerCase().includes(searchLower)
    );
  }, [coins, search]);

  const sortedCoins = useMemo(() => {
    return [...filteredCoins].sort((a, b) => {
      const aVal = a[sortConfig.key] ?? 0;
      const bVal = b[sortConfig.key] ?? 0;
      return sortConfig.direction === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [filteredCoins, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedCoins.length / rowsPerPage));
  const paginatedCoins = sortedCoins.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  const formatPrice = (price) => {
    if (price === null || price === undefined) return "N/A";
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatMarketCap = (value) => {
    if (value === null || value === undefined) return "N/A";
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toLocaleString()}`;
  };

  const formatVolume = (value) => {
    if (value === null || value === undefined) return "N/A";
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toLocaleString()}`;
  };

  if (loading && coins.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-10 w-64 bg-[#22222f] border border-[#2d2d3d] rounded-xl animate-pulse"></div>
          <div className="h-10 w-32 bg-[#22222f] border border-[#2d2d3d] rounded-xl animate-pulse"></div>
        </div>
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-6 shadow-lg">
          <div className="h-4 w-32 bg-[#2d2d3d] rounded mb-6 animate-pulse"></div>
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="h-16 bg-[#2d2d3d] rounded mb-3 animate-pulse"
              style={{ animationDelay: `${i * 50}ms` }}
            ></div>
          ))}
        </div>
      </div>
    );
  }

  // Only show the full blank-page error if we've never successfully loaded
  // any coins. If we already have data on screen, a failed background
  // refresh just retries quietly (see the banner below) instead of wiping
  // out what's already displayed.
  if (error && coins.length === 0) {
    return (
      <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-8 text-center">
        <div className="text-white font-semibold mb-2">Market Data Unavailable</div>
        <div className="text-[#6b7280] text-sm mb-4">
          {retryCountdown !== null
            ? `Rate limited — retrying in ${retryCountdown}s...`
            : "Rate limited — please try again."}
        </div>
        <button
          onClick={fetchCoins}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#a97bd1] text-white text-sm rounded-lg hover:bg-[#9465c4] transition-colors"
        >
          <RefreshCw size={14} />
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280]" size={16} />
            <input
              type="text"
              placeholder="Search coins..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-64 pl-10 pr-4 py-2.5 bg-[#22222f] border border-[#2d2d3d] rounded-lg text-sm text-white placeholder-[#6b7280] focus:outline-none focus:border-[#a97bd1] transition-colors"
            />
          </div>
          {lastUpdated && (
            <span className="text-xs text-[#6b7280]">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
        <button
          onClick={fetchCoins}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 text-sm bg-[#22222f] border border-[#2d2d3d] rounded-lg text-[#6b7280] disabled:opacity-50 hover:border-[#a97bd1] hover:text-white transition-colors"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Refresh-failed banner — only shows when we still have prior data on screen */}
      {error && coins.length > 0 && (
        <div className="bg-[#22222f] border border-[#a97bd1]/40 rounded-xl px-4 py-3 text-sm text-[#c4b5fd]">
          Latest refresh was rate limited by CoinGecko
          {retryCountdown !== null ? ` — retrying in ${retryCountdown}s` : ""}. Showing the last
          successfully loaded prices.
        </div>
      )}

      {/* Table */}
      <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-6 shadow-lg overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide">All Cryptocurrencies</h2>
          <ExportCsvButton data={paginatedCoins} filename="markets.csv" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[11px] text-[#6b7280] uppercase tracking-wide border-b border-[#2d2d3d]">
                <th
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-[#a97bd1] transition-colors"
                  onClick={() => handleSort("market_cap_rank")}
                >
                  #
                </th>
                <th
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-[#a97bd1] transition-colors"
                  onClick={() => handleSort("name")}
                >
                  Coin
                </th>
                <th
                  className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-[#a97bd1] transition-colors"
                  onClick={() => handleSort("current_price")}
                >
                  Price
                </th>
                <th
                  className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-[#a97bd1] transition-colors"
                  onClick={() => handleSort("price_change_percentage_24h")}
                >
                  24h %
                </th>
                <th
                  className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-[#a97bd1] transition-colors"
                  onClick={() => handleSort("market_cap")}
                >
                  Market Cap
                </th>
                <th
                  className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-[#a97bd1] transition-colors"
                  onClick={() => handleSort("total_volume")}
                >
                  24h Volume
                </th>
                <th className="py-3 px-4 font-semibold">7d Trend</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCoins.map((coin, index) => {
                const globalIndex = (currentPage - 1) * rowsPerPage + index + 1;
                const priceChange = coin.price_change_percentage_24h ?? 0;
                const sparklineData = coin.sparkline_in_7d?.price || [];
                const chartData = sparklineData.map((price, i) => ({ index: i, price }));

                return (
                  <tr
                    key={coin.id}
                    className="border-b border-[#2d2d3d] last:border-b-0 hover:bg-[#2d2d3d]/30 transition-colors"
                  >
                    <td className="py-4 px-4 text-[#6b7280]">{coin.market_cap_rank || globalIndex}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <img src={coin.image} alt={coin.name} className="w-6 h-6" />
                        <div>
                          <div className="text-white font-medium">{coin.name}</div>
                          <div className="text-xs text-[#6b7280] uppercase">{coin.symbol}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right text-white font-semibold">
                      {formatPrice(coin.current_price)}
                    </td>
                    <td
                      className={`py-4 px-4 text-right font-medium ${priceChange >= 0 ? "text-[#34d399]" : "text-red-400"}`}
                    >
                      <div className="flex items-center justify-end gap-1">
                        {priceChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {coin.price_change_percentage_24h !== null && coin.price_change_percentage_24h !== undefined
                          ? `${priceChange.toFixed(2)}%`
                          : "N/A"}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right text-white font-semibold">
                      {formatMarketCap(coin.market_cap)}
                    </td>
                    <td className="py-4 px-4 text-right text-[#6b7280]">{formatVolume(coin.total_volume)}</td>
                    <td className="py-4 px-4">
                      {chartData.length > 0 ? (
                        <div className="h-10 w-24">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                              <Line
                                type="monotone"
                                dataKey="price"
                                stroke={priceChange >= 0 ? "#34d399" : "#f87171"}
                                strokeWidth={1.5}
                                dot={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="text-[#6b7280] text-xs">N/A</div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {paginatedCoins.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#6b7280] text-sm">
                    No coins match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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
          Prices from CoinGecko · Top 200 coins by market cap · Auto-refreshes every 30 seconds.
        </div>
      </div>
    </div>
  );
}
