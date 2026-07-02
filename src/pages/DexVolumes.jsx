import React, { useState, useEffect, useMemo } from "react";
import { fetchDexVolumes, formatNumber } from "@/utils/defiApi";
import ExportCsvButton from "@/components/ExportCsvButton";

export default function DexVolumes() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: "total24h", direction: "desc" });

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const result = await fetchDexVolumes();
        setData(result);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const sortedProtocols = useMemo(() => {
    if (!data?.total24h) return [];
    const allProtocols = data.protocols || [];
    const sorted = [...allProtocols].sort((a, b) => {
      const aVal = a[sortConfig.key] || 0;
      const bVal = b[sortConfig.key] || 0;
      return sortConfig.direction === "desc" ? bVal - aVal : aVal - bVal;
    });
    return sorted;
  }, [data, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#2d2d3d] border-t-[#a97bd1] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-400 text-sm">Error: {error}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stat Card */}
      <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-6 shadow-lg">
        <div className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide mb-2">Total DEX Volume 24h</div>
        <div className="text-2xl font-bold text-white">{formatNumber(data?.total24h)}</div>
      </div>

      {/* Table */}
      <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-6 shadow-lg overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide">DEX Protocols by Volume</h2>
          <ExportCsvButton data={sortedProtocols} filename="dex-volumes.csv" />
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-left text-[11px] text-[#6b7280] uppercase tracking-wide border-b border-[#2d2d3d]">
              <th className="py-3 px-4 font-semibold">Name</th>
              <th className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-[#a97bd1] transition-colors" onClick={() => handleSort("total24h")}>24h Volume</th>
              <th className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-[#a97bd1] transition-colors" onClick={() => handleSort("total7d")}>7d Volume</th>
              <th className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-[#a97bd1] transition-colors" onClick={() => handleSort("total30d")}>30d Volume</th>
            </tr>
          </thead>
          <tbody>
            {sortedProtocols.map((protocol) => (
              <tr key={protocol.name} className="border-b border-[#2d2d3d] last:border-b-0 hover:bg-[#2d2d3d]/30 transition-colors">
                <td className="py-4 px-4 text-white font-medium">{protocol.name}</td>
                <td className="py-4 px-4 text-right text-white font-semibold">{formatNumber(protocol.total24h)}</td>
                <td className="py-4 px-4 text-right text-white">{formatNumber(protocol.total7d)}</td>
                <td className="py-4 px-4 text-right text-white">{formatNumber(protocol.total30d)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}