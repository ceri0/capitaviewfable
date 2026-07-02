import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function TrendingCoins({ coins }) {
  if (!coins || coins.length === 0) return null;

  const formatPrice = (price) => {
    if (price === null || price === undefined || isNaN(price)) return "N/A";
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div>
      <h2 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide mb-4">Trending Coins</h2>
      <div className="grid grid-cols-5 gap-6">
        {coins.slice(0, 5).map((coin) => {
          const priceChange = coin.data?.price_change_percentage_24h?.usd ?? 0;
          const price = coin.data?.price;
          return (
            <div key={coin.coin_id} className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <img src={coin.data?.large} alt={coin.name} className="w-6 h-6 rounded-full" onError={(e) => e.target.style.display = 'none'} />
                <div className="text-sm text-white font-semibold truncate">{coin.name || "Unknown"}</div>
              </div>
              <div className="text-xs text-[#6b7280] uppercase mb-3">{coin.data?.symbol || coin.symbol || "N/A"}</div>
              <div className="flex items-center justify-between">
                <div className="text-base font-bold text-white">{formatPrice(price)}</div>
                <div className={`text-xs font-medium flex items-center gap-1 ${priceChange >= 0 ? "text-[#34d399]" : "text-red-400"}`}>
                  {priceChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {priceChange !== null && !isNaN(priceChange) ? `${priceChange.toFixed(2)}%` : "N/A"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}