import React from "react";

export default function MarketOverview({ data }) {
  if (!data) return null;

  const formatMarketCap = (value) => {
    if (value === null || value === undefined) return "N/A";
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toLocaleString()}`;
  };

  const formatPercent = (value) => {
    if (value === null || value === undefined) return "N/A";
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  };

  const marketCapChange = data.market_cap_change_percentage_24h_usd ?? 0;

  return (
    <div>
      <h2 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide mb-4">Global Crypto Market Overview</h2>
      <div className="grid grid-cols-5 gap-6">
        {/* Global Market Cap */}
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
          <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Global Market Cap</div>
          <div className="text-2xl font-bold text-white">
            {formatMarketCap(data.total_market_cap?.usd)}
          </div>
        </div>

        {/* 24h Change */}
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
          <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">24h Change</div>
          <div className={`text-2xl font-bold ${marketCapChange >= 0 ? "text-[#34d399]" : "text-red-400"}`}>
            {formatPercent(marketCapChange)}
          </div>
        </div>

        {/* BTC Dominance */}
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
          <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">BTC Dominance</div>
          <div className="text-2xl font-bold text-white">
            {data.market_cap_percentage?.btc !== null && data.market_cap_percentage?.btc !== undefined
              ? `${data.market_cap_percentage.btc.toFixed(2)}%`
              : "N/A"}
          </div>
        </div>

        {/* ETH Dominance */}
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
          <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">ETH Dominance</div>
          <div className="text-2xl font-bold text-white">
            {data.market_cap_percentage?.eth !== null && data.market_cap_percentage?.eth !== undefined
              ? `${data.market_cap_percentage.eth.toFixed(2)}%`
              : "N/A"}
          </div>
        </div>

        {/* Active Cryptocurrencies */}
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
          <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Active Cryptocurrencies</div>
          <div className="text-2xl font-bold text-white">
            {data.active_cryptocurrencies?.toLocaleString() ?? "N/A"}
          </div>
        </div>
      </div>
    </div>
  );
}