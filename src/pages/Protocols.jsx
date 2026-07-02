import React, { useState, useMemo } from "react";
import { formatNumber, formatPercent } from "@/utils/defiApi";
import { useProtocols } from "@/lib/ProtocolsContext";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import ExportCsvButton from "@/components/ExportCsvButton";

export default function Protocols() {
  const { protocols, loading } = useProtocols();
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "tvl", direction: "desc" });
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  const filteredProtocols = useMemo(() => {
    if (!search || !protocols) return protocols || [];
    const searchLower = search.toLowerCase();
    return protocols.filter(
      (p) =>
        p.name?.toLowerCase().includes(searchLower) ||
        p.category?.toLowerCase().includes(searchLower)
    );
  }, [protocols, search]);

  const sortedProtocols = useMemo(() => {
    return [...filteredProtocols].sort((a, b) => {
      const aVal = a[sortConfig.key] ?? 0;
      const bVal = b[sortConfig.key] ?? 0;
      return sortConfig.direction === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [filteredProtocols, sortConfig]);

  const totalPages = Math.ceil(sortedProtocols.length / rowsPerPage);
  const paginatedProtocols = sortedProtocols.slice(
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
          <div className="h-4 w-32 bg-[#2d2d3d] rounded mb-6 animate-pulse"></div>
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-12 bg-[#2d2d3d] rounded mb-3 animate-pulse" style={{ animationDelay: `${i * 50}ms` }}></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280]" size={16} />
        <input
          type="text"
          placeholder="Search protocols..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-[#22222f] border border-[#2d2d3d] rounded-lg text-sm text-white placeholder-[#6b7280] focus:outline-none focus:border-[#a97bd1] transition-colors"
        />
      </div>

      {/* Table */}
      <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-6 shadow-lg overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide">All Protocols</h2>
          <ExportCsvButton data={paginatedProtocols} filename="protocols.csv" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[11px] text-[#6b7280] uppercase tracking-wide border-b border-[#2d2d3d]">
                <th className="py-3 px-4 font-semibold">Rank</th>
                <th className="py-3 px-4 font-semibold cursor-pointer hover:text-[#a97bd1] transition-colors" onClick={() => handleSort("name")}>Name</th>
                <th className="py-3 px-4 font-semibold cursor-pointer hover:text-[#a97bd1] transition-colors" onClick={() => handleSort("category")}>Category</th>
                <th className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-[#a97bd1] transition-colors" onClick={() => handleSort("tvl")}>TVL</th>
                <th className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-[#a97bd1] transition-colors" onClick={() => handleSort("change_1d")}>24h %</th>
                <th className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-[#a97bd1] transition-colors" onClick={() => handleSort("change_7d")}>7d %</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProtocols.map((protocol, index) => {
                const change1d = protocol.change_1d ?? 0;
                const change7d = protocol.change_7d ?? 0;
                const globalIndex = (currentPage - 1) * rowsPerPage + index + 1;
                return (
                  <tr key={protocol.id} className="border-b border-[#2d2d3d] last:border-b-0 hover:bg-[#2d2d3d]/30 transition-colors">
                    <td className="py-4 px-4 text-[#6b7280]">{globalIndex}</td>
                    <td className="py-4 px-4 text-white font-medium">{protocol.name}</td>
                    <td className="py-4 px-4 text-[#6b7280]">{protocol.category || "—"}</td>
                    <td className="py-4 px-4 text-right text-white font-semibold">{formatNumber(protocol.tvl)}</td>
                    <td className={`py-4 px-4 text-right font-medium ${change1d >= 0 ? "text-[#34d399]" : "text-red-400"}`}>
                      {formatPercent(change1d)}
                    </td>
                    <td className={`py-4 px-4 text-right font-medium ${change7d >= 0 ? "text-[#34d399]" : "text-red-400"}`}>
                      {formatPercent(change7d)}
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