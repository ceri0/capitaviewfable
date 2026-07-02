import React, { useState, useEffect, useRef } from "react";
import { RefreshCw, TrendingDown, TrendingUp, Zap } from "lucide-react";

// OKX public v5 API — no API key required.
// NOTE (verified against the live API): for SWAP, /public/liquidation-orders
// requires a `uly` (or instFamily) param when `state` is passed — calling it
// with instType=SWAP alone returns nothing. So we fetch one request per pair.
const TRACKED_PAIRS = ["BTC-USDT", "ETH-USDT", "SOL-USDT", "XRP-USDT", "DOGE-USDT"];

const OKX_BASE = "https://www.okx.com/api/v5/public";

export default function Liquidations() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  // Contract specs (ctVal per instrument) — fetched once and cached, since
  // they never change. ctVal is the contract multiplier in base currency
  // (e.g. BTC-USDT-SWAP: 1 contract = 0.01 BTC), needed to convert `sz`
  // (contracts) into a real coin amount / USD notional.
  const contractSpecsRef = useRef({});

  const fetchContractSpecs = async () => {
    const missing = TRACKED_PAIRS.filter(
      (uly) => !contractSpecsRef.current[`${uly}-SWAP`]
    );
    if (missing.length === 0) return;

    const results = await Promise.all(
      missing.map((uly) =>
        fetch(`${OKX_BASE}/instruments?instType=SWAP&instId=${uly}-SWAP`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    );

    results.forEach((res) => {
      const inst = res?.code === "0" ? res?.data?.[0] : null;
      if (!inst?.instId) return;
      const ctVal = parseFloat(inst.ctVal);
      // Only trust the multiplier for linear (USDT-margined) contracts where
      // ctVal is denominated in the base coin — that's what makes
      // sz * ctVal * bkPx a genuine USD(T) notional.
      if (inst.ctType === "linear" && Number.isFinite(ctVal) && ctVal > 0) {
        contractSpecsRef.current[inst.instId] = {
          ctVal,
          ctValCcy: inst.ctValCcy,
        };
      }
    });
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [liqResults] = await Promise.all([
        Promise.all(
          TRACKED_PAIRS.map((uly) =>
            fetch(
              `${OKX_BASE}/liquidation-orders?instType=SWAP&state=filled&uly=${uly}&limit=100`
            )
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          )
        ),
        fetchContractSpecs().catch(() => null),
      ]);

      const allEvents = [];
      const seen = new Set();

      liqResults.forEach((res) => {
        if (res?.code !== "0" || !Array.isArray(res.data)) return;
        // `data` is an array of per-instrument entries, each holding the
        // actual liquidation events in its `details` array.
        res.data.forEach((entry) => {
          const instId = entry?.instId;
          if (!instId || !Array.isArray(entry.details)) return;
          entry.details.forEach((d) => {
            const ts = parseInt(d.ts, 10); // ts is a string in ms
            const price = parseFloat(d.bkPx);
            const sz = parseFloat(d.sz);
            if (!Number.isFinite(ts) || !Number.isFinite(price) || !Number.isFinite(sz)) return;
            // The API can repeat the same instrument entry — dedupe events.
            const key = `${instId}|${d.ts}|${d.bkPx}|${d.sz}|${d.posSide}`;
            if (seen.has(key)) return;
            seen.add(key);

            // posSide directly says which side got liquidated; fall back to
            // side (buy = short liquidated, sell = long liquidated).
            const posSide =
              d.posSide === "long" || d.posSide === "short"
                ? d.posSide
                : d.side === "sell"
                  ? "long"
                  : "short";

            const spec = contractSpecsRef.current[instId];
            const coinAmount = spec ? sz * spec.ctVal : null;
            const usdValue = spec ? sz * spec.ctVal * price : null;

            allEvents.push({
              key,
              instId,
              coin: instId.split("-")[0],
              posSide,
              price,
              sz,
              coinAmount,
              usdValue,
              ts,
            });
          });
        });
      });

      if (allEvents.length === 0) {
        throw new Error("No liquidation data returned");
      }

      allEvents.sort((a, b) => b.ts - a.ts);
      setEvents(allEvents);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Liquidations error:", err);
      setError("Unable to load liquidation data from OKX. The API may be rate-limited. Try refreshing.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every 60 seconds
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatPrice = (price) => {
    if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 1 });
    if (price >= 1) return price.toLocaleString(undefined, { maximumFractionDigits: 4 });
    return price.toLocaleString(undefined, { maximumFractionDigits: 6 });
  };

  const formatUsd = (value) => {
    if (value === null || value === undefined) return "—";
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatCoinAmount = (event) => {
    if (event.coinAmount === null) return `${event.sz.toLocaleString()} contracts`;
    const amount = event.coinAmount;
    const digits = amount >= 100 ? 1 : amount >= 1 ? 3 : 5;
    return `${amount.toLocaleString(undefined, { maximumFractionDigits: digits })} ${event.coin}`;
  };

  const timeAgo = (ts) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return "just now";
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (loading && events.length === 0) {
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

  if (error && events.length === 0) {
    return (
      <div className="text-red-400 text-center py-8">
        Error loading data: {error}
      </div>
    );
  }

  const longCount = events.filter((e) => e.posSide === "long").length;
  const shortCount = events.filter((e) => e.posSide === "short").length;
  const largestEvent = events.reduce(
    (max, e) => (e.usdValue !== null && (max === null || e.usdValue > max.usdValue) ? e : max),
    null
  );
  const displayedEvents = events.slice(0, 60);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Liquidations</h1>
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
          <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Liquidation Events</div>
          <div className="text-2xl font-bold text-white">{events.length.toLocaleString()}</div>
        </div>
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
          <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Longs Liquidated</div>
          <div className="flex items-center gap-2">
            <TrendingDown size={20} className="text-red-400" />
            <span className="text-2xl font-bold text-red-400">{longCount.toLocaleString()}</span>
          </div>
        </div>
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
          <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Shorts Liquidated</div>
          <div className="flex items-center gap-2">
            <TrendingUp size={20} className="text-[#34d399]" />
            <span className="text-2xl font-bold text-[#34d399]">{shortCount.toLocaleString()}</span>
          </div>
        </div>
        <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-5 shadow-lg">
          <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-2">Largest Liquidation</div>
          <div className="flex items-center gap-2">
            <Zap size={20} className="text-[#a97bd1]" />
            <span className="text-2xl font-bold text-white">
              {largestEvent ? formatUsd(largestEvent.usdValue) : "—"}
            </span>
            {largestEvent && (
              <span className="text-xs text-[#6b7280]">{largestEvent.coin}</span>
            )}
          </div>
        </div>
      </div>

      {/* Recent Liquidations Table */}
      <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl shadow-lg overflow-hidden">
        <div className="p-5 border-b border-[#2d2d3d] flex justify-between items-center">
          <h2 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide">Recent Liquidations — OKX Perpetual Swaps</h2>
          <span className="text-[11px] text-[#6b7280]">{TRACKED_PAIRS.map((p) => p.split("-")[0]).join(" · ")}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[11px] text-[#6b7280] uppercase tracking-wide bg-[#1c1c27]/50">
                <th className="py-4 px-5 font-semibold">Instrument</th>
                <th className="py-4 px-5 font-semibold">Side</th>
                <th className="py-4 px-5 font-semibold text-right">Price</th>
                <th className="py-4 px-5 font-semibold text-right">Size</th>
                <th className="py-4 px-5 font-semibold text-right">Est. Value</th>
                <th className="py-4 px-5 font-semibold text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {displayedEvents.map((event) => (
                <tr key={event.key} className="border-b border-[#2d2d3d] last:border-b-0 hover:bg-[#2d2d3d]/30 transition-colors">
                  <td className="py-4 px-5">
                    <span className="text-white font-medium">{event.coin}</span>
                    <span className="text-[#6b7280] text-xs ml-2">{event.instId}</span>
                  </td>
                  <td className="py-4 px-5">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold ${
                        event.posSide === "long"
                          ? "bg-red-400/10 text-red-400"
                          : "bg-[#34d399]/10 text-[#34d399]"
                      }`}
                    >
                      {event.posSide === "long" ? "Long Liquidated" : "Short Liquidated"}
                    </span>
                  </td>
                  <td className="py-4 px-5 text-right text-white">${formatPrice(event.price)}</td>
                  <td className="py-4 px-5 text-right text-[#6b7280]">{formatCoinAmount(event)}</td>
                  <td className="py-4 px-5 text-right text-white font-medium">{formatUsd(event.usdValue)}</td>
                  <td className="py-4 px-5 text-right text-[#6b7280]">{timeAgo(event.ts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-[#2d2d3d] text-[11px] text-[#6b7280]">
          Filled liquidation orders from OKX (last 7 days per pair, most recent first).
          Est. value = size &times; contract multiplier &times; bankruptcy price, using each
          instrument's official contract specs from OKX.
        </div>
      </div>
    </div>
  );
}
