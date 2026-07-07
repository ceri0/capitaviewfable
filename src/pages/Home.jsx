import React, { useState, useEffect, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { fetchJSON, fetchCoinGeckoPrices, formatTVL, formatPercent, formatNumberPlain } from "@/utils/api";
import { useProtocols } from "@/lib/ProtocolsContext";
import ProtocolLogo from "@/components/ProtocolLogo";
import ExportCsvButton from "@/components/ExportCsvButton";
import GlobalSearch from "@/components/GlobalSearch";
import MarketOverview from "@/components/MarketOverview";
import FearGreedIndex from "@/components/FearGreedIndex";
import TrendingCoins from "@/components/TrendingCoins";
import NetworkWidgets from "@/components/NetworkWidgets";

const TIME_RANGES = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
];

export default function Home() {
  const { protocols } = useProtocols();
  const [stats, setStats] = useState({
    totalTvl: null,
    tvlChange24h: null,
    totalPools: null,
    stablecoinsMarketCap: null,
    dexVolume24h: null,
    feesPaid24h: null,
  });
  const [historicalData, setHistoricalData] = useState([]);
  const [topProtocols, setTopProtocols] = useState([]);
  const [topGainers, setTopGainers] = useState([]);
  const [topLosers, setTopLosers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState(30);
  const [marketData, setMarketData] = useState(null);
  const [trendingCoins, setTrendingCoins] = useState([]);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch CoinGecko market data
        const [globalRes, trendingRes] = await Promise.all([
          fetch("https://api.coingecko.com/api/v3/global").catch(() => null),
          fetch("https://api.coingecko.com/api/v3/search/trending").catch(() => null),
        ]);
        
        if (globalRes?.ok) {
          const globalData = await globalRes.json();
          setMarketData(globalData.data);
        }
        
        if (trendingRes?.ok) {
          const trendingData = await trendingRes.json();
          let coins = trendingData.coins?.map(c => ({
            coin_id: c.item?.id || c.coin_id,
            name: c.item?.name || c.name,
            symbol: c.item?.symbol || c.symbol,
            data: {
              large: c.item?.large,
              price: c.item?.data?.price,
              price_change_percentage_24h: { usd: c.item?.data?.price_change_percentage_24h?.usd || 0 }
            }
          })) || [];

          // /search/trending's price field is a stale snapshot — overwrite it with
          // the canonical CoinGecko /coins/markets price so trending coins match
          // what Markets/Live Prices show for the same coin at the same moment.
          const coinIds = coins.map(c => c.coin_id).filter(Boolean);
          const prices = await fetchCoinGeckoPrices(coinIds).catch(() => null);
          if (prices) {
            coins = coins.map(c => prices[c.coin_id] ? {
              ...c,
              data: {
                ...c.data,
                price: prices[c.coin_id].price,
                price_change_percentage_24h: { usd: prices[c.coin_id].change24h ?? 0 }
              }
            } : c);
          }

          setTrendingCoins(coins);
        }

        const [chains, pools, stablecoins, dexs, fees, historical] = await Promise.all([
          fetchJSON("https://api.llama.fi/v2/chains").catch(() => null),
          fetchJSON("https://yields.llama.fi/pools").catch(() => null),
          fetchJSON("https://stablecoins.llama.fi/stablecoins").catch(() => null),
          fetchJSON("https://api.llama.fi/overview/dexs").catch(() => null),
          fetchJSON("https://api.llama.fi/overview/fees").catch(() => null),
          fetchJSON("https://api.llama.fi/v2/historicalChainTvl").catch(() => null),
        ]);

        const totalTvl = chains && Array.isArray(chains) ? chains.reduce((sum, chain) => sum + (chain.tvl ?? 0), 0) : null;
        const chainsPrevDay = chains && Array.isArray(chains) ? chains.reduce((sum, chain) => sum + (chain.tvlPrevDay ?? chain.tvl ?? 0), 0) : 0;
        const tvlChange24h = chainsPrevDay ? ((totalTvl - chainsPrevDay) / chainsPrevDay * 100) : null;
        const totalPools = pools?.data?.length ?? null;
        const stablecoinsMarketCap = stablecoins?.peggedAssets?.reduce(
          (sum, sc) => sum + (sc.circulating?.peggedUSD ?? 0),
          0
        ) ?? null;
        const dexVolume24h = dexs?.total24h ?? null;
        const feesPaid24h = fees?.total24h ?? null;

        setStats({
          totalTvl,
          tvlChange24h,
          totalPools,
          stablecoinsMarketCap,
          dexVolume24h,
          feesPaid24h,
          totalRaised30d: null,
          totalHacksLost: null,
        });

        if (historical && Array.isArray(historical)) {
          const now = Date.now() / 1000;
          const cutoff = now - (selectedTimeRange * 24 * 60 * 60);
          const filtered = historical.filter((item) => item.date >= cutoff);
          const chartData = filtered.map((item) => ({
            date: new Date(item.date * 1000).toLocaleDateString(),
            tvl: item.tvl,
          }));
          setHistoricalData(chartData);
        }

        if (protocols && Array.isArray(protocols) && protocols.length > 0) {
          const sorted = [...protocols]
            .sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0))
            .slice(0, 20);

          const topProtocolsData = sorted.map((p) => ({
            name: p.name,
            slug: p.slug,
            category: p.category,
            tvl: p.tvl,
            change1d: p.change_1d,
            change7d: p.change_7d,
          }));

          setTopProtocols(topProtocolsData);

          const gainers = protocols
            .filter((p) => (p.tvl ?? 0) > 1000000 && (p.change_1d ?? 0) > 0 && (p.change_1d ?? 0) <= 500)
            .sort((a, b) => (b.change_1d ?? 0) - (a.change_1d ?? 0))
            .slice(0, 5)
            .map((p) => ({
              name: p.name,
              slug: p.slug,
              category: p.category,
              tvl: p.tvl,
              change1d: p.change_1d ?? 0,
            }));
          setTopGainers(gainers);

          const losers = protocols
            .filter((p) => (p.tvl ?? 0) > 1000000 && (p.change_1d ?? 0) < 0)
            .sort((a, b) => (a.change_1d ?? 0) - (b.change_1d ?? 0))
            .slice(0, 5)
            .map((p) => ({
              name: p.name,
              slug: p.slug,
              category: p.category,
              tvl: p.tvl,
              change1d: p.change_1d ?? 0,
            }));
          setTopLosers(losers);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [protocols, selectedTimeRange]);

  const chartData = useMemo(() => historicalData, [historicalData]);

  if (loading) {
    return (
      <div className="space-y-8">
        <GlobalSearch />
        <div className="grid grid-cols-5 gap-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg h-20 animate-pulse"></div>
          ))}
        </div>
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-6 shadow-lg h-80 animate-pulse"></div>
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-6 shadow-lg h-64 animate-pulse"></div>
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
    <div className="space-y-8">
      <div className="flex justify-center mb-6">
        <div className="w-full max-w-2xl">
          <GlobalSearch />
        </div>
      </div>
      
      {/* Market Overview */}
      <MarketOverview data={marketData} />
      
      {/* Trending Coins */}
      <TrendingCoins coins={trendingCoins} />
      
      {/* Fear & Greed Index */}
      <FearGreedIndex />
      
      {/* Network Stats */}
      <NetworkWidgets />
      
      {/* DeFi Stats */}
      <div className="grid grid-cols-5 gap-6">
        <StatCard
          label="Total DeFi TVL"
          value={formatTVL(stats.totalTvl)}
          change={stats.tvlChange24h}
        />
        <StatCard
          label="Total Pools"
          value={formatNumberPlain(stats.totalPools)}
          isCount
        />
        <StatCard
          label="Stablecoins Market Cap"
          value={formatTVL(stats.stablecoinsMarketCap)}
        />
        <StatCard
          label="DEX Volume 24h"
          value={formatTVL(stats.dexVolume24h)}
        />
        <StatCard
          label="Fees Paid 24h"
          value={formatTVL(stats.feesPaid24h)}
        />
      </div>

      <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide">TVL Over Time</h2>
          <div className="flex gap-2">
            {TIME_RANGES.map((range) => (
              <button
                key={range.label}
                onClick={() => setSelectedTimeRange(range.days)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                  selectedTimeRange === range.days
                    ? "bg-[#a97bd1] text-white"
                    : "bg-[#2d2d3d] text-[#6b7280] hover:text-white"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="tvlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a97bd1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#a97bd1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d2d3d" />
              <XAxis dataKey="date" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1e9).toFixed(0)}B`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#22222f",
                  border: "1px solid #2d2d3d",
                  fontSize: "12px",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "#fff" }}
                formatter={(value) => [formatTVL(value), "TVL"]}
              />
              <Area type="monotone" dataKey="tvl" stroke="#a97bd1" strokeWidth={2} fill="url(#tvlGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {topGainers.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide mb-4">Top Gainers (24h)</h2>
          <div className="grid grid-cols-5 gap-6">
            {topGainers.map((protocol) => (
              <div key={protocol.name} className="bg-[#22222f] border border-[#2d2d3d] border-l-4 border-l-[#34d399] rounded-xl p-5 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <ProtocolLogo name={protocol.name} slug={protocol.slug} size={32} />
                  <div className="text-sm font-bold text-[#34d399]">
                    {formatPercent(protocol.change1d)}
                  </div>
                </div>
                <div className="text-sm text-white font-semibold mb-1 truncate">{protocol.name}</div>
                <div className="text-xs text-[#6b7280] mb-3">{protocol.category || "DeFi"}</div>
                <div className="text-base font-bold text-white">{formatTVL(protocol.tvl)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {topLosers.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide mb-4">Top Losers (24h)</h2>
          <div className="grid grid-cols-5 gap-6">
            {topLosers.map((protocol) => (
              <div key={protocol.name} className="bg-[#22222f] border border-[#2d2d3d] border-l-4 border-l-red-400 rounded-xl p-5 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <ProtocolLogo name={protocol.name} slug={protocol.slug} size={32} />
                  <div className="text-sm font-bold text-red-400">
                    {formatPercent(protocol.change1d)}
                  </div>
                </div>
                <div className="text-sm text-white font-semibold mb-1 truncate">{protocol.name}</div>
                <div className="text-xs text-[#6b7280] mb-3">{protocol.category || "DeFi"}</div>
                <div className="text-base font-bold text-white">{formatTVL(protocol.tvl)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide">Top Protocols</h2>
          <ExportCsvButton data={topProtocols} filename="top-protocols.csv" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[11px] text-[#6b7280] uppercase tracking-wide border-b border-[#2d2d3d]">
                <th className="pb-3 pl-6 font-semibold">#</th>
                <th className="pb-3 font-semibold">Name</th>
                <th className="pb-3 font-semibold">Category</th>
                <th className="pb-3 font-semibold text-right">TVL</th>
                <th className="pb-3 font-semibold text-right">24h %</th>
                <th className="pb-3 font-semibold text-right">7d %</th>
              </tr>
            </thead>
            <tbody>
              {topProtocols.map((protocol, index) => (
                <tr key={protocol.name} className="border-b border-[#2d2d3d] last:border-b-0 hover:bg-[#2d2d3d]/30 transition-colors">
                  <td className="py-4 pl-6 text-[#6b7280]">{index + 1}</td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <ProtocolLogo name={protocol.name} slug={protocol.slug} size={24} />
                      <span className="text-white font-medium">{protocol.name}</span>
                    </div>
                  </td>
                  <td className="py-4 text-[#6b7280]">{protocol.category || "N/A"}</td>
                  <td className="py-4 text-right text-white font-semibold">{formatTVL(protocol.tvl)}</td>
                  <td className={`py-4 text-right font-medium ${protocol.change1d >= 0 ? "text-[#34d399]" : "text-red-400"}`}>
                    {formatPercent(protocol.change1d)}
                  </td>
                  <td className={`py-4 text-right font-medium ${protocol.change7d >= 0 ? "text-[#34d399]" : "text-red-400"}`}>
                    {formatPercent(protocol.change7d)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, change, isCount = false }) {
  return (
    <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
      <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">{label}</div>
      <div className="flex items-baseline gap-2">
        <div className="text-2xl font-bold text-white">{value}</div>
        {change !== null && change !== undefined && (
          <div className={`text-xs font-medium ${change >= 0 ? "text-[#34d399]" : "text-red-400"}`}>
            {formatPercent(change)}
          </div>
        )}
      </div>
    </div>
  );
}