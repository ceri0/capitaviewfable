import React, { useState, useEffect, useMemo } from "react";
import { RefreshCw } from "lucide-react";

export default function OnChain() {
  const [btcStats, setBtcStats] = useState(null);
  const [mempoolFees, setMempoolFees] = useState(null);
  const [recentBlocks, setRecentBlocks] = useState([]);
  const [ethGas, setEthGas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [btcStatsRes, mempoolRes, blocksRes, ethGasRes] = await Promise.all([
        fetch("https://api.blockchain.info/stats")
          .then(r => r.ok ? r.json() : null)
          .catch(() => null),
        fetch("https://mempool.space/api/v1/fees/recommended")
          .then(r => r.ok ? r.json() : null)
          .catch(() => null),
        fetch("https://mempool.space/api/v1/blocks?limit=10")
          .then(r => r.ok ? r.json() : null)
          .catch(() => null),
        fetch("https://ethgas.watch/api/gas")
          .then(r => r.ok ? r.json() : null)
          .catch(() => null),
      ]);

      setBtcStats(btcStatsRes);
      setMempoolFees(mempoolRes);
      setRecentBlocks(blocksRes || []);
      // ethgas.watch returns {instant: {gwei: 10}, fast: {gwei: 8}, ...}
      const parsedEthGas = ethGasRes ? {
        instant: ethGasRes.instant?.gwei || 0,
        fast: ethGasRes.fast?.gwei || 0,
        standard: ethGasRes.standard?.gwei || 0,
        slow: ethGasRes.slow?.gwei || 0,
      } : null;
      setEthGas(parsedEthGas);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("OnChain error:", err);
      setError("Unable to load on-chain data. APIs may be rate-limited. Try refreshing.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatBTC = (value) => {
    if (value === null || value === undefined) return "N/A";
    if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    return value.toLocaleString();
  };

  const formatHashrate = (hashrate) => {
    if (hashrate === null || hashrate === undefined) return "N/A";
    // hashrate is in hashes per second
    if (hashrate >= 1e20) return `${(hashrate / 1e20).toFixed(2)} EH/s`;
    if (hashrate >= 1e18) return `${(hashrate / 1e18).toFixed(2)} PH/s`;
    if (hashrate >= 1e15) return `${(hashrate / 1e15).toFixed(2)} TH/s`;
    return `${hashrate.toLocaleString()} H/s`;
  };

  if (loading && !btcStats && !mempoolFees && !ethGas) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-10 w-48 bg-[#22222f] border border-[#2d2d3d] rounded-xl animate-pulse"></div>
          <div className="h-10 w-32 bg-[#22222f] border border-[#2d2d3d] rounded-xl animate-pulse"></div>
        </div>
        <div className="grid grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg h-24 animate-pulse"></div>
          ))}
        </div>
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-6 shadow-lg">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-12 bg-[#2d2d3d] rounded mb-3 animate-pulse" style={{ animationDelay: `${i * 50}ms` }}></div>
          ))}
        </div>
      </div>
    );
  }

  // Show partial data even if some APIs failed
  const hasPartialData = btcStats || mempoolFees || ethGas || recentBlocks?.length > 0;
  
  if (error && !hasPartialData) {
    return (
      <div className="text-red-400 text-center py-8">
        Error loading data: {error}
      </div>
    );
  }

  const btcPrice = btcStats?.market_price_usd || 0;
  const hashrateGh = btcStats?.hash_rate || 0; // blockchain.info returns GH/s
  const totalTransactions = btcStats?.n_tx_total || 0;
  const avgBlockSize = btcStats?.avg_block_size || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">On-Chain Analytics</h1>
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

      {/* Bitcoin Network Stats */}
      <div>
        <h2 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide mb-4">Bitcoin Network</h2>
        <div className="grid grid-cols-4 gap-6">
          <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
            <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">BTC Price</div>
            <div className="text-2xl font-bold text-white">${btcPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
            <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Hash Rate</div>
            <div className="text-2xl font-bold text-white">
              {hashrateGh >= 1e11 ? `${(hashrateGh / 1e11).toFixed(2)} EH/s` :
               hashrateGh >= 1e9 ? `${(hashrateGh / 1e9).toFixed(2)} PH/s` :
               `${(hashrateGh / 1e6).toFixed(2)} TH/s`}
            </div>
          </div>
          <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
            <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Total Transactions</div>
            <div className="text-2xl font-bold text-white">{totalTransactions.toLocaleString()}</div>
          </div>
          <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
            <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Avg Block Size</div>
            <div className="text-2xl font-bold text-white">{(avgBlockSize / 1e6).toFixed(2)} MB</div>
          </div>
        </div>
      </div>

      {/* Mempool & Gas */}
      <div className="grid grid-cols-2 gap-6">
        {/* Bitcoin Mempool */}
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-6 shadow-lg">
          <h2 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide mb-4">Bitcoin Mempool Fees</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Fast</div>
              <div className="text-xl font-bold text-[#34d399]">{mempoolFees?.fastestFee || 0} <span className="text-sm text-[#6b7280]">sat/vB</span></div>
            </div>
            <div>
              <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Medium</div>
              <div className="text-xl font-bold text-yellow-400">{mempoolFees?.halfHourFee || 0} <span className="text-sm text-[#6b7280]">sat/vB</span></div>
            </div>
            <div>
              <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Slow</div>
              <div className="text-xl font-bold text-[#6b7280]">{mempoolFees?.hourFee || 0} <span className="text-sm text-[#6b7280]">sat/vB</span></div>
            </div>
          </div>
        </div>

        {/* ETH Gas */}
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-6 shadow-lg">
          <h2 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide mb-4">ETH Gas Prices</h2>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Instant</div>
              <div className="text-lg font-bold text-[#34d399]">{ethGas?.instant?.gwei || ethGas?.instant || 0} <span className="text-sm text-[#6b7280]">Gwei</span></div>
            </div>
            <div>
              <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Fast</div>
              <div className="text-lg font-bold text-yellow-400">{ethGas?.fast?.gwei || ethGas?.fast || 0} <span className="text-sm text-[#6b7280]">Gwei</span></div>
            </div>
            <div>
              <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Standard</div>
              <div className="text-lg font-bold text-white">{ethGas?.standard?.gwei || ethGas?.standard || 0} <span className="text-sm text-[#6b7280]">Gwei</span></div>
            </div>
            <div>
              <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Slow</div>
              <div className="text-lg font-bold text-[#6b7280]">{ethGas?.slow?.gwei || ethGas?.slow || 0} <span className="text-sm text-[#6b7280]">Gwei</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Bitcoin Blocks */}
      <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl shadow-lg overflow-hidden">
        <div className="p-5 border-b border-[#2d2d3d]">
          <h2 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide">Recent Bitcoin Blocks</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[11px] text-[#6b7280] uppercase tracking-wide bg-[#1c1c27]/50">
                <th className="py-4 px-5 font-semibold">Height</th>
                <th className="py-4 px-5 font-semibold">Time</th>
                <th className="py-4 px-5 font-semibold text-right">Transactions</th>
                <th className="py-4 px-5 font-semibold text-right">Size</th>
                <th className="py-4 px-5 font-semibold text-right">Total Fees</th>
              </tr>
            </thead>
            <tbody>
              {recentBlocks.map((block) => (
                <tr key={block.id} className="border-b border-[#2d2d3d] last:border-b-0 hover:bg-[#2d2d3d]/30 transition-colors">
                  <td className="py-4 px-5 text-white font-medium">#{block.height}</td>
                  <td className="py-4 px-5 text-[#6b7280]">{new Date(block.timestamp * 1000).toLocaleString()}</td>
                  <td className="py-4 px-5 text-right text-white">{block.tx_count}</td>
                  <td className="py-4 px-5 text-right text-[#6b7280]">{(block.size / 1e6).toFixed(2)} MB</td>
                  <td className="py-4 px-5 text-right text-white">{((block.feeTotal || block.totalFees || 0) / 1e8).toFixed(4)} BTC</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}