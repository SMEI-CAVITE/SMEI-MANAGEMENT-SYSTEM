/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import { PurchaseOrder, Supplier, User } from "../types";
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell
} from "recharts";
import { 
  Building2, 
  TrendingUp, 
  DollarSign, 
  Users, 
  UserX, 
  Clock, 
  Crown,
  CalendarDays
} from "lucide-react";

interface SupplierAnalyticsDashboardProps {
  pos: PurchaseOrder[];
  suppliers: Supplier[];
  currentUser: User;
}

export default function SupplierAnalyticsDashboard({ pos, suppliers, currentUser }: SupplierAnalyticsDashboardProps) {
  
  // Calculate summary metrics
  const metrics = useMemo(() => {
    const totalSuppliers = suppliers.length;
    const activeSuppliers = suppliers.filter(s => s.status !== "Disabled").length;
    const disabledSuppliers = suppliers.filter(s => s.status === "Disabled").length;
    
    // Total PO Purchases
    const totalPurchases = pos.reduce((sum, po) => sum + (po.totalAmount || 0), 0);

    // Group purchases by Supplier ID to find Top Supplier
    const supplierPurchases: Record<string, { name: string; amount: number }> = {};
    pos.forEach(po => {
      if (!supplierPurchases[po.supplierId]) {
        supplierPurchases[po.supplierId] = { name: po.supplierName, amount: 0 };
      }
      supplierPurchases[po.supplierId].amount += po.totalAmount || 0;
    });

    let topSupplierName = "N/A";
    let topSupplierAmount = 0;
    
    Object.values(supplierPurchases).forEach(item => {
      if (item.amount > topSupplierAmount) {
        topSupplierAmount = item.amount;
        topSupplierName = item.name;
      }
    });

    // Most Recent Supplier
    let mostRecentSupplierName = "N/A";
    let mostRecentDate = "";
    
    suppliers.forEach(s => {
      if (!mostRecentDate || s.createdAt > mostRecentDate) {
        mostRecentDate = s.createdAt;
        mostRecentSupplierName = s.name;
      }
    });

    return {
      totalSuppliers,
      activeSuppliers,
      disabledSuppliers,
      totalPurchases,
      topSupplierName,
      topSupplierAmount,
      mostRecentSupplierName,
      mostRecentDate
    };
  }, [pos, suppliers]);

  // Data for Top 10 Suppliers Chart
  const topSuppliersData = useMemo(() => {
    const dataMap: Record<string, number> = {};
    pos.forEach(po => {
      dataMap[po.supplierName] = (dataMap[po.supplierName] || 0) + (po.totalAmount || 0);
    });

    return Object.entries(dataMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [pos]);

  // Data for Monthly Purchases per Supplier (Top 4 Suppliers + Others)
  const monthlyPurchasesData = useMemo(() => {
    // Get top 4 suppliers
    const topSupplierNames = topSuppliersData.slice(0, 4).map(s => s.name);
    
    const monthlyMap: Record<string, Record<string, number>> = {};
    
    pos.forEach(po => {
      if (!po.poDate) return;
      // Extract Year-Month
      const date = new Date(po.poDate);
      const year = date.getFullYear();
      const monthStr = date.toLocaleString("en-US", { month: "short" });
      const monthKey = `${year}-${monthStr}`;

      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = {
          "Others": 0
        };
        topSupplierNames.forEach(name => {
          monthlyMap[monthKey][name] = 0;
        });
      }

      if (topSupplierNames.includes(po.supplierName)) {
        monthlyMap[monthKey][po.supplierName] += po.totalAmount || 0;
      } else {
        monthlyMap[monthKey]["Others"] += po.totalAmount || 0;
      }
    });

    // Convert map to chronological array
    return Object.entries(monthlyMap)
      .map(([month, values]) => ({
        month,
        ...values
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [pos, topSuppliersData]);

  // Data for Supplier Transaction Trends
  const transactionTrendData = useMemo(() => {
    const trendMap: Record<string, { count: number; total: number }> = {};
    
    pos.forEach(po => {
      if (!po.poDate) return;
      const date = new Date(po.poDate);
      const year = date.getFullYear();
      const monthStr = date.toLocaleString("en-US", { month: "short" });
      const monthKey = `${year}-${monthStr}`;

      if (!trendMap[monthKey]) {
        trendMap[monthKey] = { count: 0, total: 0 };
      }
      trendMap[monthKey].count += 1;
      trendMap[monthKey].total += po.totalAmount || 0;
    });

    return Object.entries(trendMap)
      .map(([month, data]) => ({
        month,
        orders: data.count,
        volume: data.total
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [pos]);

  // Custom Formatter for Currency Tooltip
  const formatCurrency = (val: number) => {
    return `₱ ${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const COLORS = ["#B22222", "#E57373", "#45B6FE", "#3F51B5", "#009688", "#FF9800", "#9C27B0", "#607D8B", "#4CAF50", "#E91E63"];

  return (
    <div id="smei-supplier-analytics" className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 tracking-tight font-display">Supplier Analytics Dashboard</h2>
        <p className="text-sm text-gray-500 mt-0.5">Strategic supplier profiles, purchase concentrations, and vendor interaction trends</p>
      </div>

      {/* 1. Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Total Suppliers */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="p-3.5 bg-red-50 text-smei-crimson rounded-xl">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-mono block uppercase">Total Suppliers</span>
            <span className="text-2xl font-black text-gray-800 font-mono">{metrics.totalSuppliers}</span>
            <span className="text-[10px] text-gray-500 mt-0.5 block">Registered partners</span>
          </div>
        </div>

        {/* Active Suppliers */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-mono block uppercase">Active Suppliers</span>
            <span className="text-2xl font-black text-emerald-600 font-mono">{metrics.activeSuppliers}</span>
            <span className="text-[10px] text-emerald-500 mt-0.5 block">Approved suggestions</span>
          </div>
        </div>

        {/* Disabled Suppliers */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="p-3.5 bg-gray-50 text-gray-400 rounded-xl">
            <UserX className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-mono block uppercase">Disabled Suppliers</span>
            <span className="text-2xl font-black text-gray-500 font-mono">{metrics.disabledSuppliers}</span>
            <span className="text-[10px] text-gray-400 mt-0.5 block">accidental/restricted profiles</span>
          </div>
        </div>

        {/* Total Purchases Volume */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow col-span-1 sm:col-span-2 lg:col-span-1">
          <div className="p-3.5 bg-amber-50 text-amber-600 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-gray-400 font-mono block uppercase">Total Purchases Volume</span>
            <span className="text-lg font-black text-amber-600 font-mono truncate block">
              ₱ {metrics.totalPurchases.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
            <span className="text-[10px] text-amber-500 mt-0.5 block">cumulative order value</span>
          </div>
        </div>

      </div>

      {/* Secondary Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Top Supplier Card */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl border border-slate-950/20 shadow-md flex items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider font-mono">
              <Crown className="w-3 h-3" />
              <span>Highest Purchase Volume</span>
            </div>
            <h3 className="text-lg font-black tracking-tight uppercase truncate max-w-sm font-sans" title={metrics.topSupplierName}>
              {metrics.topSupplierName}
            </h3>
            <p className="text-xs text-slate-300">
              Total Order Concentration: <strong className="text-white font-mono">{formatCurrency(metrics.topSupplierAmount)}</strong>
            </p>
          </div>
          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-amber-400 hidden sm:block">
            <Crown className="w-8 h-8" />
          </div>
        </div>

        {/* Most Recent Supplier Card */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 bg-red-50 text-smei-crimson px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider font-mono border border-red-100/40">
              <Clock className="w-3 h-3" />
              <span>Newly Registered Partner</span>
            </div>
            <h3 className="text-lg font-black tracking-tight text-gray-800 uppercase truncate max-w-sm font-sans" title={metrics.mostRecentSupplierName}>
              {metrics.mostRecentSupplierName}
            </h3>
            <p className="text-xs text-gray-500">
              Registered On: <strong className="text-gray-700 font-mono">{metrics.mostRecentDate || "N/A"}</strong>
            </p>
          </div>
          <div className="p-4 bg-red-50 text-smei-crimson rounded-2xl hidden sm:block">
            <CalendarDays className="w-8 h-8" />
          </div>
        </div>

      </div>

      {/* 2. Charts Container */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top 10 Suppliers by Purchase Volume */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-gray-800 font-display uppercase tracking-wider">Top 10 Suppliers by Total Order Amount</h3>
            <p className="text-xs text-gray-400">Concentration of purchasing power in PHP</p>
          </div>
          <div className="h-80 w-full text-xs">
            {topSuppliersData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topSuppliersData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} tickLine={false} />
                  <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} tickFormatter={(v) => `₱${v / 1000}k`} />
                  <Tooltip formatter={(value: any) => [formatCurrency(Number(value)), "Purchases"]} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={45}>
                    {topSuppliersData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 font-sans">
                No purchases data available for visualization.
              </div>
            )}
          </div>
        </div>

        {/* Monthly Purchases per Supplier (Top 4 + Others) */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-gray-800 font-display uppercase tracking-wider">Monthly Purchases per Supplier</h3>
            <p className="text-xs text-gray-400">Chronological vendor volume distributions</p>
          </div>
          <div className="h-80 w-full text-xs">
            {monthlyPurchasesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyPurchasesData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="month" stroke="#9ca3af" fontSize={10} tickLine={false} />
                  <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} tickFormatter={(v) => `₱${v / 1000}k`} />
                  <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                  <Legend verticalAlign="bottom" height={36} />
                  {Object.keys(monthlyPurchasesData[0] || {})
                    .filter(key => key !== "month")
                    .map((supplierName, idx) => (
                      <Bar 
                        key={supplierName} 
                        dataKey={supplierName} 
                        stackId="a" 
                        fill={COLORS[idx % COLORS.length]} 
                      />
                    ))
                  }
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 font-sans">
                No monthly transactions recorded.
              </div>
            )}
          </div>
        </div>

        {/* Supplier Transaction Trend (Total Orders Count & Purchase Volume Over Time) */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4 lg:col-span-2">
          <div>
            <h3 className="text-sm font-bold text-gray-800 font-display uppercase tracking-wider">Supplier Transaction & Order Frequency Trend</h3>
            <p className="text-xs text-gray-400">Evaluating purchase velocities and monthly transaction frequencies</p>
          </div>
          <div className="h-80 w-full text-xs">
            {transactionTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={transactionTrendData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#B22222" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#B22222" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" stroke="#9ca3af" fontSize={10} tickLine={false} />
                  <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="volume" stroke="#B22222" strokeWidth={2.5} fillOpacity={1} fill="url(#colorVolume)" name="Order Amount (PHP)" />
                  <Line type="monotone" dataKey="orders" stroke="#FF9800" strokeWidth={2} name="Total POs Count" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 font-sans">
                No transaction trend data.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
