import React, { useState, useEffect, useMemo } from "react";
import { fetchStablecoins, formatNumber } from "@/utils/defiApi";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import ExportCsvButton from "@/components/ExportCsvButton";

export default function Stablecoins() {
  const [stablecoins, setStablecoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: "circulating", direction: "desc" });
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 200;

  useEffect(() => {
    async function loadStablecoins() {
      try {
        setLoading(true);
        const data = await fetchStablecoins();
        setStablecoins(data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadStablecoins();
  }, []);

  const filteredStablecoins = useMemo(() => {
    if (!search) return stablecoins;
    const searchLower = search.toLowerCase();
    return stablecoins.filter((sc) =>
      sc.name?.toLowerCase().includes(searchLower) ||
      sc.symbol?.toLowerCase().includes(searchLower)
    );
  }, [stablecoins, search]);

  const sortedStablecoins = useMemo(() => {
    return [...filteredStablecoins].sort((a, b) => {
      let aVal, bVal;
      if (sortConfig.key === "circulating") {
        aVal = a.circulating?.peggedUSD ?? 0;
        bVal = b.circulating?.peggedUSD ?? 0;
      } else if (sortConfig.key === "name" || sortConfig.key === "symbol") {
        aVal = (a[sortConfig.key] || "").toLowerCase();
        bVal = (b[sortConfig.key] || "").toLowerCase();
        return sortConfig.direction === "desc" ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      } else {
        aVal = a[sortConfig.key] ?? 0;
        bVal = b[sortConfig.key] ?? 0;
      }
      return sortConfig.direction === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [filteredStablecoins, sortConfig]);

  const totalPages = Math.ceil(sortedStablecoins.length / rowsPerPage);
  const paginatedStablecoins = sortedStablecoins.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-[#22222f] border border-[#2d2d3d] rounded-xl animate-pulse"></div>
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-6 shadow-lg">
          <div className="h-4 w-48 bg-[#2d2d3d] rounded mb-6 animate-pulse"></div>
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-12 bg-[#2d2d3d] rounded mb-3 animate-pulse" style={{ animationDelay: `${i * 50}ms` }}></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-400 text-center py-8">Error: {error}</div>;
  }

  const totalStablecoins = stablecoins.length;
  const totalMarketCap = stablecoins.reduce((sum, sc) => sum + (sc.circulating?.peggedUSD || 0), 0);
  const largestStablecoin = stablecoins.length > 0 ? stablecoins[0] : null;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
          <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Total Stablecoins</div>
          <div className="text-2xl font-bold text-white">{totalStablecoins}</div>
        </div>
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
          <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Total Market Cap</div>
          <div className="text-2xl font-bold text-white">
            ${((totalMarketCap || 0) / 1e9).toFixed(2)}B
          </div>
        </div>
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
          <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Largest</div>
          <div className="text-2xl font-bold text-white">{largestStablecoin?.name || "N/A"}</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280]" size={16} />
        <input
          type="text"
          placeholder="Search stablecoins..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-[#22222f] border border-[#2d2d3d] rounded-lg text-sm text-white placeholder-[#6b7280] focus:outline-none focus:border-[#a97bd1] transition-colors"
        />
      </div>

      {/* Table */}
      <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-6 shadow-lg overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide">Stablecoins by Market Cap</h2>
          <ExportCsvButton data={paginatedStablecoins} filename="stablecoins.csv" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[11px] text-[#6b7280] uppercase tracking-wide border-b border-[#2d2d3d]">
                <th className="py-3 px-4 font-semibold">Rank</th>
                <th className="py-3 px-4 font-semibold cursor-pointer hover:text-[#a97bd1] transition-colors" onClick={() => handleSort("name")}>Name</th>
                <th className="py-3 px-4 font-semibold cursor-pointer hover:text-[#a97bd1] transition-colors" onClick={() => handleSort("symbol")}>Symbol</th>
                <th className="py-3 px-4 font-semibold">Peg Type</th>
                <th className="py-3 px-4 font-semibold">Mechanism</th>
                <th className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-[#a97bd1] transition-colors" onClick={() => handleSort("circulating")}>Market Cap</th>
              </tr>
            </thead>
            <tbody>
              {paginatedStablecoins.map((sc, index) => {
                const globalIndex = (currentPage - 1) * rowsPerPage + index + 1;
                return (
                  <tr key={sc.name} className="border-b border-[#2d2d3d] last:border-b-0 hover:bg-[#2d2d3d]/30 transition-colors">
                    <td className="py-4 px-4 text-[#6b7280]">{globalIndex}</td>
                    <td className="py-4 px-4 text-white font-medium">{sc.name}</td>
                    <td className="py-4 px-4 text-[#6b7280]">{sc.symbol}</td>
                    <td className="py-4 px-4 text-[#6b7280]">{sc.pegType || "—"}</td>
                    <td className="py-4 px-4 text-[#6b7280] text-xs max-w-[200px] truncate" title={sc.pegMechanism || "—"}>{sc.pegMechanism || "—"}</td>
                    <td className="py-4 px-4 text-right text-white font-semibold">${((sc.circulating?.peggedUSD || 0) / 1e6).toFixed(2)}M</td>
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