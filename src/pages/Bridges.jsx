import React, { useState, useEffect } from "react";
import { RefreshCw, ArrowLeftRight, Lock, MessageSquare, Layers } from "lucide-react";
import ExportCsvButton from "@/components/ExportCsvButton";

// Wormholescan public API — no API key required.
// Verified live response shapes:
//   /scorecards        → flat object; all numeric fields arrive as strings (USD for volumes).
//   /x-chain-activity  → { txs: [{ chain, volume, percentage, destinations: [...] }] }
//     where `chain` is a Wormhole-specific chain ID (NOT an EVM chain ID).
const WORMHOLESCAN_BASE = "https://api.wormholescan.io/api/v1";

// Official Wormhole chain ID → name table (from Wormhole's own docs).
// Any ID not present here is rendered as "Chain {id}" — never guess a name.
const WORMHOLE_CHAIN_NAMES = {
  1: "Solana",
  2: "Ethereum",
  3: "Terra",
  4: "BNB Smart Chain",
  5: "Polygon",
  6: "Avalanche",
  8: "Algorand",
  10: "Fantom",
  13: "Kaia",
  14: "Celo",
  15: "NEAR",
  16: "Moonbeam",
  19: "Injective",
  20: "Osmosis",
  21: "Sui",
  22: "Aptos",
  23: "Arbitrum",
  24: "Optimism",
  26: "Pythnet",
  30: "Base",
  32: "Sei",
  34: "Scroll",
  35: "Mantle",
  37: "X Layer",
  38: "Linea",
  39: "Berachain",
  40: "SeiEVM",
  44: "Unichain",
  45: "World Chain",
  46: "Ink",
  47: "HyperEVM",
  48: "Monad",
  50: "Mezo",
  51: "Fogo",
  52: "Sonic",
  53: "Converge",
  55: "Plume",
  57: "XRPL-EVM",
  58: "Plasma",
  59: "CreditCoin",
  60: "Stacks",
  63: "Moca",
  64: "MegaETH",
  65000: "HyperCore",
  66: "Xrpl",
  67: "0G (Zero Gravity)",
  4000: "Cosmos Hub",
  4001: "Evmos",
  4002: "Kujira",
  4003: "Neutron",
  4004: "Celestia",
  4005: "Stargaze",
  4006: "SEDA",
  4007: "Dymension",
  4008: "Provenance",
  4009: "Noble",
};

const chainName = (id) => WORMHOLE_CHAIN_NAMES[id] || `Chain ${id}`;

const toNumber = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

export default function Bridges() {
  const [scorecards, setScorecards] = useState(null);
  const [chainActivity, setChainActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [scoreRes, activityRes] = await Promise.all([
        fetch(`${WORMHOLESCAN_BASE}/scorecards`),
        fetch(`${WORMHOLESCAN_BASE}/x-chain-activity`),
      ]);
      if (!scoreRes.ok) throw new Error(`scorecards HTTP ${scoreRes.status}`);
      if (!activityRes.ok) throw new Error(`x-chain-activity HTTP ${activityRes.status}`);

      const scoreData = await scoreRes.json();
      const activityData = await activityRes.json();

      // All scorecard numeric fields arrive as strings — parse them.
      setScorecards({
        volume24h: toNumber(scoreData["24h_volume"]),
        volume7d: toNumber(scoreData["7d_volume"]),
        volume30d: toNumber(scoreData["30d_volume"]),
        tvl: toNumber(scoreData.tvl),
        totalMessages: toNumber(scoreData.total_messages),
        totalTxCount: toNumber(scoreData.total_tx_count),
        totalVolume: toNumber(scoreData.total_volume),
      });

      const txs = Array.isArray(activityData?.txs) ? activityData.txs : [];
      const rows = txs
        .map((tx) => {
          const volume = toNumber(tx.volume) ?? 0;
          const destinations = (Array.isArray(tx.destinations) ? tx.destinations : [])
            .map((d) => ({ chain: d.chain, volume: toNumber(d.volume) ?? 0 }))
            .sort((a, b) => b.volume - a.volume);
          return {
            chain: tx.chain,
            volume,
            percentage: toNumber(tx.percentage) ?? 0,
            topDestination: destinations[0] || null,
          };
        })
        .sort((a, b) => b.volume - a.volume);
      setChainActivity(rows);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Wormhole API error:", err);
      setError("Unable to load Wormhole bridge data from Wormholescan. The API may be temporarily unavailable. Try refreshing.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Network-wide aggregates don't move second-to-second — refresh every 3 minutes.
    const interval = setInterval(fetchData, 180000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatUsd = (value) => {
    if (value === null || value === undefined) return "—";
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatCount = (value) => {
    if (value === null || value === undefined) return "—";
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return value.toLocaleString();
  };

  if (loading && !scorecards) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-10 w-64 bg-[#22222f] border border-[#2d2d3d] rounded-xl animate-pulse"></div>
          <div className="h-10 w-32 bg-[#22222f] border border-[#2d2d3d] rounded-xl animate-pulse"></div>
        </div>
        <div className="grid grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg h-24 animate-pulse"></div>
          ))}
        </div>
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-6 shadow-lg">
          <div className="h-4 w-48 bg-[#2d2d3d] rounded mb-6 animate-pulse"></div>
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-12 bg-[#2d2d3d] rounded mb-3 animate-pulse" style={{ animationDelay: `${i * 50}ms` }}></div>
          ))}
        </div>
      </div>
    );
  }

  if (error && !scorecards) {
    return (
      <div className="text-red-400 text-center py-8">
        Error loading data: {error}
      </div>
    );
  }

  const csvRows = chainActivity.map((row, index) => ({
    rank: index + 1,
    chain: chainName(row.chain),
    wormhole_chain_id: row.chain,
    volume_usd: row.volume,
    percentage: row.percentage,
    top_destination: row.topDestination ? chainName(row.topDestination.chain) : "",
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Wormhole Bridge Activity</h1>
          <p className="text-xs text-[#6b7280] mt-1">
            Live stats for the Wormhole network only — one major cross-chain bridge, not an
            aggregate of all bridges (DeFiLlama&apos;s aggregate bridge rankings are now Pro-tier only).
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-xs text-[#6b7280]">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2.5 text-sm bg-[#22222f] border border-[#2d2d3d] rounded-lg text-[#6b7280] hover:border-[#a97bd1] hover:text-white transition-colors"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
          <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">24h Volume</div>
          <div className="flex items-center gap-2">
            <ArrowLeftRight size={20} className="text-[#a97bd1]" />
            <span className="text-2xl font-bold text-white">{formatUsd(scorecards?.volume24h)}</span>
          </div>
        </div>
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
          <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">7d Volume</div>
          <div className="text-2xl font-bold text-white">{formatUsd(scorecards?.volume7d)}</div>
        </div>
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
          <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">30d Volume</div>
          <div className="text-2xl font-bold text-white">{formatUsd(scorecards?.volume30d)}</div>
        </div>
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
          <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Total Value Locked</div>
          <div className="flex items-center gap-2">
            <Lock size={20} className="text-[#34d399]" />
            <span className="text-2xl font-bold text-white">{formatUsd(scorecards?.tvl)}</span>
          </div>
        </div>
      </div>

      {/* Lifetime stats strip */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg flex items-center gap-3">
          <MessageSquare size={18} className="text-[#a97bd1]" />
          <div>
            <div className="text-[11px] text-[#6b7280] uppercase tracking-wide">Lifetime Messages</div>
            <div className="text-lg font-semibold text-white">{formatCount(scorecards?.totalMessages)}</div>
          </div>
        </div>
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg flex items-center gap-3">
          <Layers size={18} className="text-[#a97bd1]" />
          <div>
            <div className="text-[11px] text-[#6b7280] uppercase tracking-wide">Lifetime Transactions</div>
            <div className="text-lg font-semibold text-white">{formatCount(scorecards?.totalTxCount)}</div>
          </div>
        </div>
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg flex items-center gap-3">
          <ArrowLeftRight size={18} className="text-[#a97bd1]" />
          <div>
            <div className="text-[11px] text-[#6b7280] uppercase tracking-wide">Lifetime Volume</div>
            <div className="text-lg font-semibold text-white">{formatUsd(scorecards?.totalVolume)}</div>
          </div>
        </div>
      </div>

      {/* Per-chain activity table */}
      <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl shadow-lg overflow-hidden">
        <div className="p-5 border-b border-[#2d2d3d] flex justify-between items-center">
          <h2 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide">
            Cross-Chain Activity by Source Chain
          </h2>
          <ExportCsvButton data={csvRows} filename="wormhole-chain-activity.csv" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[11px] text-[#6b7280] uppercase tracking-wide bg-[#1c1c27]/50">
                <th className="py-4 px-5 font-semibold">#</th>
                <th className="py-4 px-5 font-semibold">Source Chain</th>
                <th className="py-4 px-5 font-semibold text-right">Volume</th>
                <th className="py-4 px-5 font-semibold text-right">Share</th>
                <th className="py-4 px-5 font-semibold">Top Destination</th>
              </tr>
            </thead>
            <tbody>
              {chainActivity.map((row, index) => (
                <tr
                  key={row.chain}
                  className="border-b border-[#2d2d3d] last:border-b-0 hover:bg-[#2d2d3d]/30 transition-colors"
                >
                  <td className="py-4 px-5 text-[#6b7280]">{index + 1}</td>
                  <td className="py-4 px-5">
                    <span className="text-white font-medium">{chainName(row.chain)}</span>
                    <span className="text-[#6b7280] text-xs ml-2">ID {row.chain}</span>
                  </td>
                  <td className="py-4 px-5 text-right text-white font-semibold">{formatUsd(row.volume)}</td>
                  <td className="py-4 px-5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <div className="w-24 h-1.5 bg-[#2d2d3d] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#a97bd1] rounded-full"
                          style={{ width: `${Math.min(100, Math.max(0, row.percentage))}%` }}
                        ></div>
                      </div>
                      <span className="text-[#6b7280] text-xs w-14 text-right">
                        {row.percentage.toFixed(2)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-5 text-[#6b7280] text-xs">
                    {row.topDestination ? chainName(row.topDestination.chain) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-[#2d2d3d] text-[11px] text-[#6b7280]">
          Source: Wormholescan public API (api.wormholescan.io). Chain names use Wormhole&apos;s
          official chain ID registry; unrecognized IDs are shown as &quot;Chain {"{id}"}&quot; rather
          than guessed. Volumes are in USD as reported by the API. Auto-refreshes every 3 minutes.
        </div>
      </div>
    </div>
  );
}
