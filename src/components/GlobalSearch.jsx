import React, { useState, useMemo, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { useProtocols } from "@/lib/ProtocolsContext";
import { Link } from "react-router-dom";

export default function GlobalSearch() {
  const { protocols } = useProtocols();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const results = useMemo(() => {
    if (!query.trim() || !protocols) return [];
    const searchLower = query.toLowerCase().trim();
    
    // Search protocols
    const protocolResults = protocols
      .filter((p) => p.name?.toLowerCase().includes(searchLower))
      .slice(0, 8)
      .map((p) => ({
        type: "protocol",
        name: p.name,
        category: p.category,
        tvl: p.tvl,
        slug: p.slug,
      }));

    return protocolResults;
  }, [query, protocols]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = () => {
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div className="relative max-w-xl" ref={wrapperRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280]" size={18} />
        <input
          type="text"
          placeholder="Search protocols, chains, tokens..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full pl-10 pr-10 py-3 bg-[#22222f] border border-[#2d2d3d] rounded-lg text-sm text-white placeholder-[#6b7280] focus:outline-none focus:border-[#a97bd1] transition-colors"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280] hover:text-white"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#22222f] border border-[#2d2d3d] rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
          {results.map((result, index) => (
            <Link
              key={`${result.type}-${result.name}-${index}`}
              to={`/protocols`}
              onClick={handleSelect}
              className="flex items-center justify-between px-4 py-3 hover:bg-[#2d2d3d]/50 transition-colors border-b border-[#2d2d3d] last:border-b-0"
            >
              <div>
                <div className="text-sm font-medium text-white">{result.name}</div>
                <div className="text-xs text-[#6b7280]">{result.category || "Protocol"}</div>
              </div>
              <div className="text-xs text-[#6b7280]">
                {result.tvl !== null && result.tvl !== undefined
                  ? `$${(result.tvl / 1e9).toFixed(2)}B`
                  : "N/A"}
              </div>
            </Link>
          ))}
        </div>
      )}

      {isOpen && query && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#22222f] border border-[#2d2d3d] rounded-lg shadow-xl z-50 px-4 py-3 text-sm text-[#6b7280]">
          No protocols found
        </div>
      )}
    </div>
  );
}