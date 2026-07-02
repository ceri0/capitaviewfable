import React, { useState, useEffect, useMemo } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import ExportCsvButton from "@/components/ExportCsvButton";

export default function Options() {
  const [data, setData] = useState(null);
  const [protocols, setProtocols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch("https://api.llama.fi/overview/options");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = await res.json();
        setData(result);
        const optsData = result.allPools || result.protocols || [];
        setProtocols(Array.isArray(optsData) ? optsData : []);
      } catch (err) {
        console.error("Options API error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredProtocols = useMemo(() => {
    if (!search) return protocols;
    const searchLower = search.toLowerCase();
    return protocols.filter((p) =>
      p.name?.toLowerCase().includes(searchLower)
    );
  }, [protocols, search]);

  const sortedProtocols = useMemo(() => {
    return [...filteredProtocols].sort((a, b) => (b.total24h ?? 0) - (a.total24h ?? 0));
  }, [filteredProtocols]);

  const totalPages = Math.ceil(sortedProtocols.length / rowsPerPage);
  const paginatedProtocols = sortedProtocols.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-20 bg-[#22222f] border border-[#2d2d3d] rounded-xl animate-pulse"></div>
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-6 shadow-lg">
          <div className="h-4 w-32 bg-[#2d2d3d] rounded mb-6 animate-pulse"></div>
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-12 bg-[#2d2d3d] rounded mb-3 animate-pulse" style={{ animationDelay: `${i * 50}ms` }}></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-8 text-center">
        <div className="text-white font-semibold mb-2">Options Data Requires Pro API</div>
        <div className="text-[#6b7280] text-sm mb-4">
          DeFiLlama has moved options analytics to their Pro tier.
        </div>
        <a
          href="https://defillama.com/subscription"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 bg-[#a97bd1] text-white text-sm rounded-lg hover:bg-[#9465c4] transition-colors"
        >
          View DeFiLlama Pro Plans
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
          <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Total Options Volume 24h</div>
          <div className="text-2xl font-bold text-white">
            ${((data?.total24h ?? 0) / 1e6).toFixed(2)}M
          </div>
        </div>
      </div>

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

      <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-6 shadow-lg overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide">Options by Volume</h2>
          <ExportCsvButton data={paginatedProtocols} filename="options.csv" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[11px] text-[#6b7280] uppercase tracking-wide border-b border-[#2d2d3d]">
                <th className="py-3 px-4 font-semibold">#</th>
                <th className="py-3 px-4 font-semibold">Protocol</th>
                <th className="py-3 px-4 font-semibold">Chain</th>
                <th className="py-3 px-4 font-semibold text-right">24h Volume</th>
                <th className="py-3 px-4 font-semibold text-right">7d Volume</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProtocols.map((protocol, index) => {
                const globalIndex = (currentPage - 1) * rowsPerPage + index + 1;
                return (
                  <tr key={protocol.name || index} className="border-b border-[#2d2d3d] last:border-b-0 hover:bg-[#2d2d3d]/30 transition-colors">
                    <td className="py-4 px-4 text-[#6b7280]">{globalIndex}</td>
                    <td className="py-4 px-4 text-white font-medium">{protocol.name || "N/A"}</td>
                    <td className="py-4 px-4 text-[#6b7280]">{protocol.chains?.[0] || protocol.chain || "N/A"}</td>
                    <td className="py-4 px-4 text-right text-white font-semibold">
                      ${((protocol.total24h ?? 0) / 1e6).toFixed(2)}M
                    </td>
                    <td className="py-4 px-4 text-right text-white">
                      ${((protocol.total7d ?? 0) / 1e6).toFixed(2)}M
                    </td>
                  </tr>
                );
              })}
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
      </div>
    </div>
  );
}