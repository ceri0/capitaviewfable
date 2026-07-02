import React, { useState, useEffect, useMemo } from "react";
import { Search, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { fetchCoinGeckoMarkets } from "@/utils/api";
import ExportCsvButton from "@/components/ExportCsvButton";

export default function LivePrices() {
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCountdown, setRetryCountdown] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "rank", direction: "asc" });
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  const fetchPrices = async () => {
    try {
      setLoading(true);
      setRetryCountdown(null);
      setError(null);
      
      // CoinGecko API - CORS enabled, no key required
      const data = await fetchCoinGeckoMarkets({
        perPage: 100,
        page: 1,
        sparkline: false,
        priceChangePercentage: "24h",
      });

      // Map CoinGecko response to our format
      const pricesData = data.map((coin, index) => ({
        rank: index + 1,
        image: coin.image,
        symbol: (coin.symbol || "").toUpperCase(),
        name: coin.name,
        price: parseFloat(coin.current_price || 0),
        change24h: parseFloat(coin.price_change_percentage_24h || 0),
        marketCap: coin.market_cap || 0,
        volume: coin.total_volume || 0,
      }));

      setPrices(pricesData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("LivePrices error:", err);
      setError("Rate limited by CoinGecko. Retrying...");
      // Start 60-second countdown retry
      setRetryCountdown(60);
      const interval = setInterval(() => {
        setRetryCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            fetchPrices(); // Auto-retry
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
    fetchPrices();
    const interval = setInterval(fetchPrices, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  const filteredPrices = useMemo(() => {
    if (!search) return prices;
    const searchLower = search.toLowerCase();
    return prices.filter(p => p.symbol.toLowerCase().includes(searchLower));
  }, [prices, search]);

  const sortedPrices = useMemo(() => {
    return [...filteredPrices].sort((a, b) => {
      const aVal = a[sortConfig.key] ?? 0;
      const bVal = b[sortConfig.key] ?? 0;
      return sortConfig.direction === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [filteredPrices, sortConfig]);

  const totalPages = Math.ceil(sortedPrices.length / rowsPerPage);
  const paginatedPrices = sortedPrices.slice(
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
    if (price >= 1000) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (price >= 1) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(6)}`;
  };

  const formatVolume = (volume) => {
    if (volume === null || volume === undefined) return "N/A";
    if (volume >= 1e9) return `$${(volume / 1e9).toFixed(2)}B`;
    if (volume >= 1e6) return `$${(volume / 1e6).toFixed(2)}M`;
    return `$${volume.toLocaleString()}`;
  };

  const formatMarketCap = (marketCap) => {
    if (marketCap === null || marketCap === undefined) return "N/A";
    if (marketCap >= 1e12) return `$${(marketCap / 1e12).toFixed(2)}T`;
    if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(2)}B`;
    if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(2)}M`;
    return `$${marketCap.toLocaleString()}`;
  };

  if (loading && prices.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-10 w-48 bg-[#22222f] border border-[#2d2d3d] rounded-xl animate-pulse"></div>
          <div className="h-10 w-32 bg-[#22222f] border border-[#2d2d3d] rounded-xl animate-pulse"></div>
        </div>
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-6 shadow-lg">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-12 bg-[#2d2d3d] rounded mb-3 animate-pulse" style={{ animationDelay: `${i * 50}ms` }}></div>
          ))}
        </div>
      </div>
    );
  }

  if (error && prices.length === 0) {
    return (
      <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-8 text-center">
        <div className="text-white font-semibold mb-2">Live Prices Unavailable</div>
        <div className="text-[#6b7280] text-sm mb-4">
          {retryCountdown !== null 
            ? `Rate limited — retrying in ${retryCountdown}s...`
            : "CoinGecko API is temporarily unavailable."}
        </div>
        {retryCountdown === null && (
          <button
            onClick={fetchPrices}
            className="px-4 py-2 bg-[#a97bd1] text-white text-sm rounded-lg hover:bg-[#9465c4] transition-colors inline-flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Try Again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280]" size={16} />
            <input
              type="text"
              placeholder="Search coin..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 pl-10 pr-4 py-2.5 bg-[#22222f] border border-[#2d2d3d] rounded-lg text-sm text-white placeholder-[#6b7280] focus:outline-none focus:border-[#a97bd1] transition-colors"
            />
          </div>
          {lastUpdated && (
            <span className="text-xs text-[#6b7280]">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchPrices}
            className="flex items-center gap-2 px-4 py-2.5 text-sm bg-[#22222f] border border-[#2d2d3d] rounded-lg text-[#6b7280] hover:border-[#a97bd1] hover:text-white transition-colors"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <ExportCsvButton data={paginatedPrices} filename="live-prices.csv" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[11px] text-[#6b7280] uppercase tracking-wide bg-[#1c1c27]/50">
                <th className="py-4 px-5 font-semibold">Rank</th>
                <th className="py-4 px-5 font-semibold">Coin</th>
                <th className="py-4 px-5 font-semibold text-right cursor-pointer hover:text-[#a97bd1] transition-colors" onClick={() => handleSort("price")}>Price</th>
                <th className="py-4 px-5 font-semibold text-right cursor-pointer hover:text-[#a97bd1] transition-colors" onClick={() => handleSort("change24h")}>24h %</th>
                <th className="py-4 px-5 font-semibold text-right cursor-pointer hover:text-[#a97bd1] transition-colors" onClick={() => handleSort("marketCap")}>Market Cap</th>
                <th className="py-4 px-5 font-semibold text-right cursor-pointer hover:text-[#a97bd1] transition-colors" onClick={() => handleSort("volume")}>24h Volume</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPrices.map((coin, index) => {
                const globalIndex = (currentPage - 1) * rowsPerPage + index + 1;
                return (
                  <tr key={coin.symbol} className={`border-b border-[#2d2d3d] last:border-b-0 hover:bg-[#2d2d3d]/30 transition-colors ${index % 2 === 0 ? 'bg-[#22222f]' : 'bg-[#1c1c27]/30'}`}>
                    <td className="py-4 px-5 text-[#6b7280]">{coin.rank || globalIndex}</td>
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        {coin.image && (
                          <img src={coin.image} alt={coin.name} className="w-6 h-6" />
                        )}
                        <div>
                          <div className="text-white font-medium">{coin.symbol}</div>
                          <div className="text-xs text-[#6b7280]">{coin.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-5 text-right text-white font-semibold">{formatPrice(coin.price)}</td>
                    <td className={`py-4 px-5 text-right font-bold ${coin.change24h >= 0 ? "text-[#34d399]" : "text-red-400"}`}>
                      {coin.change24h >= 0 ? "+" : ""}{coin.change24h.toFixed(2)}%
                    </td>
                    <td className="py-4 px-5 text-right text-white">{formatMarketCap(coin.marketCap)}</td>
                    <td className="py-4 px-5 text-right text-white">{formatVolume(coin.volume)}</td>
                  </tr>
                );
              })}
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
      </div>
    </div>
  );
}