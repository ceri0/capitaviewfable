import React, { useState, useEffect } from "react";

export default function NetworkWidgets() {
  const [btcStats, setBtcStats] = useState(null);
  const [mempoolFees, setMempoolFees] = useState(null);
  const [ethGas, setEthGas] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [btcStatsRes, mempoolRes, ethGasRes] = await Promise.all([
          fetch("https://api.blockchain.info/stats")
            .then(r => r.ok ? r.json() : null)
            .catch(() => null),
          fetch("https://mempool.space/api/v1/fees/recommended")
            .then(r => r.ok ? r.json() : null)
            .catch(() => null),
          fetch("https://ethgas.watch/api/gas")
            .then(r => r.ok ? r.json() : null)
            .catch(() => null),
        ]);

        setBtcStats(btcStatsRes);
        setMempoolFees(mempoolRes);
        // ethgas.watch returns {instant: {gwei: 10}, fast: {gwei: 8}, ...}
        const parsedEthGas = ethGasRes ? {
          instant: ethGasRes.instant?.gwei || 0,
          fast: ethGasRes.fast?.gwei || 0,
          standard: ethGasRes.standard?.gwei || 0,
          slow: ethGasRes.slow?.gwei || 0,
        } : null;
        setEthGas(parsedEthGas);
      } catch (err) {
        console.error("NetworkWidgets error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg h-24 animate-pulse"></div>
        ))}
      </div>
    );
  }

  const btcPrice = btcStats?.market_price_usd || 0;
  const hashrateGh = btcStats?.hash_rate || 0; // blockchain.info returns GH/s
  const hashrate = hashrateGh / 1000; // Convert GH/s to TH/s
  const totalTransactions = btcStats?.n_tx || 0; // Use n_tx instead of n_tx_total

  const formatHashrate = (hashrate) => {
    if (hashrate >= 1e6) return `${(hashrate / 1e6).toFixed(2)} EH/s`;
    if (hashrate >= 1e3) return `${(hashrate / 1e3).toFixed(2)} PH/s`;
    return `${hashrate.toFixed(2)} TH/s`;
  };

  const formatNumber = (num) => {
    if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    return num.toLocaleString();
  };

  return (
    <div>
      <h2 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide mb-4">Network Stats</h2>
      <div className="grid grid-cols-4 gap-6">
        {/* Bitcoin Stats */}
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
          <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">BTC Price</div>
          <div className="text-2xl font-bold text-white">${btcPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
          <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Hash Rate</div>
          <div className="text-2xl font-bold text-white">{formatHashrate(hashrate)}</div>
        </div>
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
          <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Total Transactions</div>
          <div className="text-2xl font-bold text-white">{totalTransactions.toLocaleString()}</div>
        </div>

        {/* Mempool Fees */}
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
          <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Mempool Fees (sat/vB)</div>
          <div className="flex items-baseline gap-3">
            <div className="text-lg font-bold text-[#34d399]">{mempoolFees?.fastestFee || 0}</div>
            <div className="text-xs text-[#6b7280]">Fast</div>
            <div className="text-lg font-bold text-yellow-400">{mempoolFees?.halfHourFee || 0}</div>
            <div className="text-xs text-[#6b7280]">Med</div>
            <div className="text-lg font-bold text-[#6b7280]">{mempoolFees?.hourFee || 0}</div>
            <div className="text-xs text-[#6b7280]">Slow</div>
          </div>
        </div>
      </div>

      {/* ETH Gas Widget */}
      <div className="mt-6 bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
        <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-3">ETH Gas (Gwei)</div>
        <div className="flex gap-6">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] text-[#6b7280] uppercase">Instant</span>
            <span className="text-xl font-bold text-[#34d399]">{ethGas?.instant?.gwei || ethGas?.instant || 0}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] text-[#6b7280] uppercase">Fast</span>
            <span className="text-xl font-bold text-yellow-400">{ethGas?.fast?.gwei || ethGas?.fast || 0}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] text-[#6b7280] uppercase">Standard</span>
            <span className="text-xl font-bold text-white">{ethGas?.standard?.gwei || ethGas?.standard || 0}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] text-[#6b7280] uppercase">Slow</span>
            <span className="text-xl font-bold text-[#6b7280]">{ethGas?.slow?.gwei || ethGas?.slow || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}