import React, { useState, useEffect, useMemo } from "react";
import { Search, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import ExportCsvButton from "@/components/ExportCsvButton";

export default function Derivatives() {
  const [futures, setFutures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "volume24h", direction: "desc" });
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // CoinGecko derivatives API - CORS enabled, no key required
      const response = await fetch("https://api.coingecko.com/api/v3/derivatives");
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();

      // Process derivatives data from CoinGecko
      const derivativesData = (Array.isArray(data) ? data : []).map((d, index) => ({
        rank: index + 1,
        name: d.market || d.exchange || "Unknown",
        symbol: d.symbol || "",
        price: parseFloat(d.price || 0),
        openInterest: parseFloat(d.open_interest || d.open_interest_usd || 0),
        volume24h: parseFloat(d.volume_24h || 0),
        change24h: parseFloat(d.price_percentage_change_24h || 0),
        type: d.contract_type || "Perpetual",
        fundingRate: parseFloat(d.funding_rate || 0) * 100,
      }));

      setFutures(derivativesData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Derivatives error:", err);
      setError("Unable to load derivatives data. CoinGecko API may be unavailable.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredFutures = useMemo(() => {
    if (!search) return futures;
    const searchLower = search.toLowerCase();
    return futures.filter(f => 
      f.name?.toLowerCase().includes(searchLower) || 
      f.symbol?.toLowerCase().includes(searchLower)
    );
  }, [futures, search]);

  const sortedFutures = useMemo(() => {
    return [...filteredFutures].sort((a, b) => {
      const aVal = a[sortConfig.key] ?? 0;
      const bVal = b[sortConfig.key] ?? 0;
      return sortConfig.direction === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [filteredFutures, sortConfig]);

  const totalPages = Math.ceil(sortedFutures.length / rowsPerPage);
  const paginatedFutures = sortedFutures.slice(
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

  const formatOI = (oi) => {
    if (oi === null || oi === undefined) return "N/A";
    if (oi >= 1e9) return `$${(oi / 1e9).toFixed(2)}B`;
    if (oi >= 1e6) return `$${(oi / 1e6).toFixed(2)}M`;
    return `$${oi.toLocaleString()}`;
  };

  if (loading && futures.length === 0) {
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

  if (error) {
    return (
      <div className="text-red-400 text-center py-8">
        Error loading data: {error}
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
              placeholder="Search market..."
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
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2.5 text-sm bg-[#22222f] border border-[#2d2d3d] rounded-lg text-[#6b7280] hover:border-[#a97bd1] hover:text-white transition-colors"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <ExportCsvButton data={paginatedFutures} filename="derivatives.csv" />
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
          <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Total Protocols</div>
          <div className="text-2xl font-bold text-white">{futures.length}</div>
        </div>
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
          <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Total Open Interest</div>
          <div className="text-2xl font-bold text-white">
            ${((futures.reduce((sum, f) => sum + (f.openInterest || 0), 0) || 0) / 1e9).toFixed(2)}B
          </div>
        </div>
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
          <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Total 24h Volume</div>
          <div className="text-2xl font-bold text-white">
            ${((futures.reduce((sum, f) => sum + (f.volume24h || 0), 0) || 0) / 1e9).toFixed(2)}B
          </div>
        </div>
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
          <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Avg Funding Rate</div>
          <div className="text-2xl font-bold text-white">
            {futures.filter(f => f.fundingRate !== null && f.fundingRate !== undefined).length > 0
              ? `${(futures.filter(f => f.fundingRate !== null && f.fundingRate !== undefined).reduce((sum, f) => sum + (f.fundingRate || 0), 0) / futures.filter(f => f.fundingRate !== null && f.fundingRate !== undefined).length).toFixed(4)}%`
              : "N/A"}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[11px] text-[#6b7280] uppercase tracking-wide bg-[#1c1c27]/50">
                <th className="py-4 px-5 font-semibold">Rank</th>
                <th className="py-4 px-5 font-semibold cursor-pointer hover:text-[#a97bd1] transition-colors" onClick={() => handleSort("name")}>Market</th>
                <th className="py-4 px-5 font-semibold">Symbol</th>
                <th className="py-4 px-5 font-semibold text-right cursor-pointer hover:text-[#a97bd1] transition-colors" onClick={() => handleSort("price")}>Price</th>
                <th className="py-4 px-5 font-semibold text-right cursor-pointer hover:text-[#a97bd1] transition-colors" onClick={() => handleSort("openInterest")}>Open Interest</th>
                <th className="py-4 px-5 font-semibold text-right cursor-pointer hover:text-[#a97bd1] transition-colors" onClick={() => handleSort("volume24h")}>24h Volume</th>
                <th className="py-4 px-5 font-semibold text-right cursor-pointer hover:text-[#a97bd1] transition-colors" onClick={() => handleSort("change24h")}>24h Change</th>
                <th className="py-4 px-5 font-semibold text-right cursor-pointer hover:text-[#a97bd1] transition-colors" onClick={() => handleSort("fundingRate")}>Funding Rate</th>
              </tr>
            </thead>
            <tbody>
              {paginatedFutures.map((fut, index) => {
                const globalIndex = (currentPage - 1) * rowsPerPage + index + 1;
                return (
                  <tr key={`${fut.name}-${fut.symbol}`} className={`border-b border-[#2d2d3d] last:border-b-0 hover:bg-[#2d2d3d]/30 transition-colors ${index % 2 === 0 ? 'bg-[#22222f]' : 'bg-[#1c1c27]/30'}`}>
                    <td className="py-4 px-5 text-[#6b7280]">{fut.rank || globalIndex}</td>
                    <td className="py-4 px-5 text-white font-medium">{fut.name}</td>
                    <td className="py-4 px-5 text-[#6b7280] text-sm">{fut.symbol}</td>
                    <td className="py-4 px-5 text-right text-white font-semibold">{formatPrice(fut.price)}</td>
                    <td className="py-4 px-5 text-right text-white font-semibold">{formatOI(fut.openInterest)}</td>
                    <td className="py-4 px-5 text-right text-white">{formatVolume(fut.volume24h)}</td>
                    <td className={`py-4 px-5 text-right font-bold ${fut.change24h >= 0 ? "text-[#34d399]" : "text-red-400"}`}>
                      {fut.change24h >= 0 ? "+" : ""}{fut.change24h.toFixed(2)}%
                    </td>
                    <td className="py-4 px-5 text-right">
                      {fut.fundingRate !== null && fut.fundingRate !== undefined ? (
                        <span className={fut.fundingRate >= 0 ? "text-[#34d399]" : "text-red-400"}>
                          {fut.fundingRate >= 0 ? "+" : ""}{fut.fundingRate.toFixed(4)}%
                        </span>
                      ) : (
                        <span className="text-[#6b7280]">N/A</span>
                      )}
                    </td>
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