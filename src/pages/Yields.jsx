import React, { useState, useEffect, useMemo } from "react";
import { fetchJSON, formatTVL, formatNumberPlain } from "@/utils/api";
import { Search, ChevronDown, ChevronLeft, ChevronRight, Download } from "lucide-react";
import ExportCsvButton from "@/components/ExportCsvButton";

export default function Yields() {
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [selectedChain, setSelectedChain] = useState("all");
  const [selectedProtocol, setSelectedProtocol] = useState("all");
  const [minTvl, setMinTvl] = useState("1m");
  const [stablecoinsOnly, setStablecoinsOnly] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchJSON("https://yields.llama.fi/pools");
        const validPools = (data.data || []).filter(
          (pool) =>
            pool.apy !== null &&
            pool.apy !== undefined &&
            pool.apy <= 10000 &&
            pool.tvlUsd >= 1000
        );
        setPools(validPools);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const chains = useMemo(() => {
    const unique = [...new Set(pools.map((p) => p.chain).filter(Boolean))];
    return unique.sort();
  }, [pools]);

  const protocols = useMemo(() => {
    const unique = [...new Set(pools.map((p) => p.project).filter(Boolean))];
    return unique.sort();
  }, [pools]);

  const filteredPools = useMemo(() => {
    return pools.filter((pool) => {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        !search ||
        pool.symbol?.toLowerCase().includes(searchLower) ||
        pool.project?.toLowerCase().includes(searchLower) ||
        pool.chain?.toLowerCase().includes(searchLower);

      const matchesChain = selectedChain === "all" || pool.chain === selectedChain;
      const matchesProtocol = selectedProtocol === "all" || pool.project === selectedProtocol;

      let matchesTvl = true;
      if (minTvl === "100k") matchesTvl = pool.tvlUsd >= 100000;
      else if (minTvl === "1m") matchesTvl = pool.tvlUsd >= 1000000;
      else if (minTvl === "10m") matchesTvl = pool.tvlUsd >= 10000000;

      const matchesStablecoin = !stablecoinsOnly || pool.stablecoin === true;

      return matchesSearch && matchesChain && matchesProtocol && matchesTvl && matchesStablecoin;
    });
  }, [pools, search, selectedChain, selectedProtocol, minTvl, stablecoinsOnly]);

  const sortedPools = useMemo(() => {
    return [...filteredPools].sort((a, b) => (b.apy ?? 0) - (a.apy ?? 0));
  }, [filteredPools]);

  const totalPages = Math.ceil(sortedPools.length / rowsPerPage);
  const paginatedPools = sortedPools.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  function getApyColor(apy) {
    if (apy >= 20) return "text-[#34d399]";
    if (apy >= 5) return "text-yellow-400";
    return "text-[#6b7280]";
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
          <div className="h-10 bg-[#2d2d3d] rounded animate-pulse"></div>
        </div>
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl shadow-lg overflow-hidden">
          <div className="p-5 border-b border-[#2d2d3d]">
            <div className="h-4 w-48 bg-[#2d2d3d] rounded animate-pulse"></div>
          </div>
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-12 bg-[#2d2d3d] border-b border-[#2d2d3d] animate-pulse" style={{ animationDelay: `${i * 50}ms` }}></div>
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
      {/* Filters Bar */}
      <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280]" size={16} />
            <input
              type="text"
              placeholder="Search token, protocol, chain..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#1c1c27] border border-[#2d2d3d] rounded-lg text-sm text-white placeholder-[#6b7280] focus:outline-none focus:border-[#a97bd1] transition-colors"
            />
          </div>

          {/* Chain Dropdown */}
          <div className="relative">
            <select
              value={selectedChain}
              onChange={(e) => setSelectedChain(e.target.value)}
              className="appearance-none pl-4 pr-8 py-2.5 bg-[#1c1c27] border border-[#2d2d3d] rounded-lg text-sm text-white focus:outline-none focus:border-[#a97bd1] cursor-pointer transition-colors"
            >
              <option value="all">All Chains</option>
              {chains.map((chain) => (
                <option key={chain} value={chain}>
                  {chain}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6b7280] pointer-events-none" size={14} />
          </div>

          {/* Protocol Dropdown */}
          <div className="relative">
            <select
              value={selectedProtocol}
              onChange={(e) => setSelectedProtocol(e.target.value)}
              className="appearance-none pl-4 pr-8 py-2.5 bg-[#1c1c27] border border-[#2d2d3d] rounded-lg text-sm text-white focus:outline-none focus:border-[#a97bd1] cursor-pointer transition-colors"
            >
              <option value="all">All Protocols</option>
              {protocols.map((protocol) => (
                <option key={protocol} value={protocol}>
                  {protocol}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6b7280] pointer-events-none" size={14} />
          </div>

          {/* Min TVL Dropdown */}
          <div className="relative">
            <select
              value={minTvl}
              onChange={(e) => setMinTvl(e.target.value)}
              className="appearance-none pl-4 pr-8 py-2.5 bg-[#1c1c27] border border-[#2d2d3d] rounded-lg text-sm text-white focus:outline-none focus:border-[#a97bd1] cursor-pointer transition-colors"
            >
              <option value="any">Any TVL</option>
              <option value="100k">$100K+</option>
              <option value="1m">$1M+</option>
              <option value="10m">$10M+</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6b7280] pointer-events-none" size={14} />
          </div>

          {/* Stablecoins Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={stablecoinsOnly}
              onChange={(e) => setStablecoinsOnly(e.target.checked)}
              className="w-4 h-4 rounded border-[#2d2d3d] bg-[#1c1c27] text-[#a97bd1] focus:ring-[#a97bd1]"
            />
            <span className="text-sm text-[#6b7280]">Stablecoins only</span>
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl shadow-lg overflow-hidden">
        <div className="p-5 border-b border-[#2d2d3d] flex items-center justify-between">
          <div className="text-sm text-[#6b7280]">
            Showing {paginatedPools.length} of {filteredPools.length} pools (Total: {pools.length})
          </div>
          <ExportCsvButton data={paginatedPools} filename="yields.csv" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[11px] text-[#6b7280] uppercase tracking-wide bg-[#1c1c27]/50">
                <th className="py-4 px-5 font-semibold">Token</th>
                <th className="py-4 px-5 font-semibold">Protocol</th>
                <th className="py-4 px-5 font-semibold">Chain</th>
                <th className="py-4 px-5 font-semibold text-right">APY</th>
                <th className="py-4 px-5 font-semibold text-right">Base APY</th>
                <th className="py-4 px-5 font-semibold text-right">Reward APY</th>
                <th className="py-4 px-5 font-semibold text-right">TVL</th>
                <th className="py-4 px-5 font-semibold text-center">Type</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPools.map((pool, index) => (
                <tr key={`${pool.pool}-${index}`} className={`border-b border-[#2d2d3d] last:border-b-0 hover:bg-[#2d2d3d]/30 transition-colors ${index % 2 === 0 ? 'bg-[#22222f]' : 'bg-[#1c1c27]/30'}`}>
                  <td className="py-4 px-5 text-white font-medium">{pool.symbol || "N/A"}</td>
                  <td className="py-4 px-5 text-white">{pool.project || "N/A"}</td>
                  <td className="py-4 px-5 text-[#6b7280]">{pool.chain || "N/A"}</td>
                  <td className={`py-4 px-5 text-right font-bold ${getApyColor(pool.apy)}`}>
                    {pool.apy !== null ? `${pool.apy.toFixed(2)}%` : "N/A"}
                  </td>
                  <td className="py-4 px-5 text-right text-[#6b7280]">
                    {pool.apyBase !== null ? `${pool.apyBase.toFixed(2)}%` : "-"}
                  </td>
                  <td className="py-4 px-5 text-right text-[#6b7280]">
                    {pool.apyReward !== null ? `${pool.apyReward.toFixed(2)}%` : "-"}
                  </td>
                  <td className="py-4 px-5 text-right text-white font-semibold">{formatTVL(pool.tvlUsd)}</td>
                  <td className="py-4 px-5 text-center">
                    {pool.stablecoin && (
                      <span className="inline-block px-2.5 py-1 bg-[#2d2d3d] text-[#6b7280] text-xs rounded-md">
                        Stablecoin
                      </span>
                    )}
                  </td>
                </tr>
              ))}
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