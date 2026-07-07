import React from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Coins, Globe, Layers, DollarSign, TrendingUp, PieChart, Sun, Moon, ArrowLeftRight, AlertTriangle, PieChart as PieChartIcon, TrendingUp as TrendingUpIcon, Banknote, Shield, Wallet, Building2, BarChart3, Server } from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/yields", label: "Yields", icon: Coins },
  { path: "/chains", label: "Chains", icon: Globe },
  { path: "/protocols", label: "Protocols", icon: Layers },
  { path: "/stablecoins", label: "Stablecoins", icon: DollarSign },
  { path: "/dex-volumes", label: "DEX Volumes", icon: TrendingUp },
  { path: "/fees-revenue", label: "Fees & Revenue", icon: PieChart },
  { path: "/bridges", label: "Bridges", icon: ArrowLeftRight },
  { path: "/liquidations", label: "Liquidations", icon: AlertTriangle },
  { path: "/options", label: "Options", icon: PieChartIcon },
  { path: "/derivatives", label: "Derivatives", icon: TrendingUpIcon },
  { path: "/raises", label: "Fundraising", icon: Banknote },
  { path: "/hacks", label: "Hacks", icon: Shield },
  { path: "/treasuries", label: "Treasuries", icon: Wallet },
  { path: "/etf", label: "ETFs", icon: Building2 },
  { path: "/markets", label: "Markets", icon: BarChart3 },
  { path: "/on-chain", label: "On-Chain", icon: Server },
];

export default function Layout() {
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="flex min-h-screen bg-[#1c1c27]">
      {/* Left Sidebar */}
      <aside className="w-[220px] fixed left-0 top-0 h-full border-r border-[#2d2d3d] bg-[#1c1c27] flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-[#2d2d3d] flex items-center justify-between">
          <h1 className="text-xl font-bold text-white tracking-tight">CapitalView</h1>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-[#22222f] transition-colors"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun size={18} className="text-[#6b7280]" /> : <Moon size={18} className="text-[#6b7280]" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-6 py-3 text-sm transition-all border-l-2 ${
                  isActive
                    ? "border-[#a97bd1] bg-[#22222f]/50 text-white"
                    : "border-transparent text-[#6b7280] hover:text-white hover:bg-[#22222f]/30"
                }`}
              >
                <Icon size={18} className={isActive ? "text-[#a97bd1]" : ""} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-[220px] p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}