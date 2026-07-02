import React from "react";
import { Info } from "lucide-react";

export default function Liquidations() {
  return (
    <div className="space-y-6">
      <div className="bg-[#22222f] border border-[#2d2d3d] rounded-xl p-12 text-center shadow-lg">
        <div className="flex items-center justify-center mb-4">
          <Info size={48} className="text-[#a97bd1]" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Coming Soon</h2>
        <p className="text-[#6b7280] text-sm max-w-md mx-auto">
          Liquidations data is not available on the free DeFiLlama API. 
          We're working on integrating alternative data sources and will bring this feature soon.
        </p>
      </div>
    </div>
  );
}