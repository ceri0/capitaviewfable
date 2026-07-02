import React, { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";

export default function FearGreedIndex() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchFearGreed() {
      try {
        setLoading(true);
        const res = await fetch("https://api.alternative.me/fng/?limit=7");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = await res.json();
        if (result.status === "success" && result.data) {
          setData(result.data);
        }
      } catch (err) {
        console.error("Fear & Greed API error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchFearGreed();
  }, []);

  if (loading) {
    return (
      <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-6 shadow-lg">
        <div className="h-40 bg-[#2d2d3d] rounded animate-pulse"></div>
      </div>
    );
  }

  if (error || !data || data.length === 0) {
    return null;
  }

  const today = data[0];
  const score = parseInt(today.value, 10);
  const classification = today.value_classification;
  
  const getGaugeColor = (score) => {
    if (score <= 25) return "#f87171"; // Extreme Fear - Red
    if (score <= 45) return "#fb923c"; // Fear - Orange
    if (score <= 55) return "#facc15"; // Neutral - Yellow
    if (score <= 75) return "#4ade80"; // Greed - Light Green
    return "#22c55e"; // Extreme Greed - Green
  };

  const getGaugeLabel = (score) => {
    if (score <= 25) return "Extreme Fear";
    if (score <= 45) return "Fear";
    if (score <= 55) return "Neutral";
    if (score <= 75) return "Greed";
    return "Extreme Greed";
  };

  const historyData = data.map((item, index) => ({
    name: new Date(item.timestamp * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    value: parseInt(item.value, 10),
  })).reverse();

  const gaugeColor = getGaugeColor(score);
  const gaugeLabel = getGaugeLabel(score);

  return (
    <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide">Fear & Greed Index</h2>
      </div>
      
      <div className="flex items-center gap-8">
        {/* Gauge */}
        <div className="flex-shrink-0">
          <div className="relative w-32 h-32">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {/* Background arc */}
              <path
                d="M 10 50 A 40 40 0 1 1 90 50"
                fill="none"
                stroke="#2d2d3d"
                strokeWidth="12"
                strokeLinecap="round"
              />
              {/* Value arc */}
              <path
                d="M 10 50 A 40 40 0 1 1 90 50"
                fill="none"
                stroke={gaugeColor}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${(score / 100) * 251.2} 251.2`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-3xl font-bold text-white">{score}</div>
              <div className="text-[10px] text-[#6b7280] uppercase">Score</div>
            </div>
          </div>
        </div>

        {/* Label */}
        <div className="flex-1">
          <div className="text-lg font-bold text-white mb-1">{gaugeLabel}</div>
          <div className="text-xs text-[#6b7280] mb-4">
            Market sentiment indicator based on social media, volatility, and market data
          </div>
          <div className="flex gap-1 text-[10px]">
            <span className="px-2 py-1 rounded bg-[#f87171]/20 text-[#f87171]">0-25</span>
            <span className="px-2 py-1 rounded bg-[#fb923c]/20 text-[#fb923c]">26-45</span>
            <span className="px-2 py-1 rounded bg-[#facc15]/20 text-[#facc15]">46-55</span>
            <span className="px-2 py-1 rounded bg-[#4ade80]/20 text-[#4ade80]">56-75</span>
            <span className="px-2 py-1 rounded bg-[#22c55e]/20 text-[#22c55e]">76-100</span>
          </div>
        </div>

        {/* 7-day history chart */}
        <div className="flex-1 h-24">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={historyData}>
              <XAxis dataKey="name" stroke="#6b7280" fontSize={9} tickLine={false} axisLine={false} />
              <YAxis stroke="#6b7280" fontSize={9} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#22222f",
                  border: "1px solid #2d2d3d",
                  fontSize: "11px",
                  borderRadius: "6px",
                }}
                formatter={(value) => [value, "Index"]}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {historyData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getGaugeColor(entry.value)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}