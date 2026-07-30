/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { PurchaseOrder, Supplier, User, UserRole } from "../types";
import { motion } from "motion/react";
import { LineChart, Line, BarChart, Bar, Legend, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { FileText, ClipboardCheck, TrendingUp, Users, ArrowRight, Eye, RefreshCw, Calendar, CreditCard, Package, GitCompare, UserCheck } from "lucide-react";
import { api } from "../lib/api";
import SystemMonitoringModule from "./SystemMonitoringModule";

interface DashboardProps {
  pos: PurchaseOrder[];
  suppliers: Supplier[];
  currentUser: User;
  onNavigateToPOList: () => void;
  onNavigateToSuppliers: () => void;
  onSelectPO: (po: PurchaseOrder) => void;
  onNavigate: (tab: string) => void;
}

interface RecentActivityItem {
  id: string;
  docNumber: string;
  module: string;
  status: string;
  dateTime: string;
  user: string;
  rawItem: {
    type: string;
    data: any;
  };
}

export default function Dashboard({
  pos,
  suppliers,
  currentUser,
  onNavigateToPOList,
  onNavigateToSuppliers,
  onSelectPO,
  onNavigate
}: DashboardProps) {
  const [currentLiveTime, setCurrentLiveTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formattedDate = now.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
      });
      const formattedTime = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      });
      setCurrentLiveTime(`${formattedDate} • ${formattedTime}`);
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const [activities, setActivities] = useState<RecentActivityItem[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);

  useEffect(() => {
    const fetchAllActivities = async () => {
      try {
        const [rfsData, pisData, canvassData] = await Promise.all([
          api.getRFS().catch(() => []),
          api.getPIS().catch(() => []),
          api.getCanvass().catch(() => [])
        ]);

        const merged: RecentActivityItem[] = [];

        // 1. Add POs
        pos.forEach(po => {
          merged.push({
            id: `po-${po.id}`,
            docNumber: po.poNumber,
            module: "Purchase Order (PO)",
            status: po.status,
            dateTime: po.createdAt || po.updatedAt || po.poDate,
            user: po.created_by || po.preparedBy || "System",
            rawItem: { type: "po-all", data: po }
          });
        });

        // 2. Add RFS
        rfsData.forEach(rfs => {
          merged.push({
            id: `rfs-${rfs.id}`,
            docNumber: rfs.rfsNumber,
            module: "Request for Service (RFS)",
            status: rfs.status,
            dateTime: rfs.createdAt || rfs.updatedAt || rfs.dateRequested,
            user: rfs.created_by || rfs.requestedBy || "System",
            rawItem: { type: "rfs", data: rfs }
          });
        });

        // 3. Add PIS
        pisData.forEach(pis => {
          merged.push({
            id: `pis-${pis.id}`,
            docNumber: pis.pisNumber,
            module: "Purchase Inspection Slip (PIS)",
            status: pis.status,
            dateTime: pis.createdAt || pis.updatedAt || pis.scheduleDate,
            user: pis.created_by || pis.requestedBy || "System",
            rawItem: { type: "pis", data: pis }
          });
        });

        // 4. Add Canvass Sheet
        canvassData.forEach(canv => {
          merged.push({
            id: `canv-${canv.id}`,
            docNumber: canv.canvassNumber,
            module: "Canvass Sheet",
            status: canv.approvedBy ? "Approved" : "Pending",
            dateTime: canv.createdAt || canv.updatedAt || canv.canvassDate,
            user: canv.created_by || canv.requestedBy || "System",
            rawItem: { type: "canvass", data: canv }
          });
        });

        // Sort by dateTime descending
        merged.sort((a, b) => {
          const dateA = new Date(a.dateTime).getTime();
          const dateB = new Date(b.dateTime).getTime();
          if (isNaN(dateA)) return 1;
          if (isNaN(dateB)) return -1;
          return dateB - dateA;
        });

        setActivities(merged.slice(0, 8)); // Display top 8
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        if (errMsg.includes("Session expired") || errMsg.includes("unauthorized") || errMsg.includes("token")) {
          console.warn("Activities fetch unauthorized or session expired (handled globally):", errMsg);
        } else {
          console.error("Error fetching activities:", errMsg);
        }
      } finally {
        setLoadingActivities(false);
      }
    };

    fetchAllActivities();
  }, [pos]);

  const formatActivityDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // 1. Calculations
  const totalPOs = pos.length;
  
  // Pending actions - count POs that need action based on current role
  const pendingApprovalsCount = pos.filter(po => {
    if (currentUser.role === UserRole.DepartmentHead) {
      return po.status === "Pending Review";
    }
    if (currentUser.role === UserRole.AccountingStaff) {
      // In our flow: Pending Review gets signed by Dept Head -> status: Pending Approval?
      // Wait, let's check: "Accounting Staff: Verify PO, Review VAT/EWT, Generate Reports"
      // Let's assume after Department Head approves, it goes to "Pending Review" or custom "Pending Verification" which accounting handles, then "Pending Approval" which Director handles.
      // Let's treat "Pending Review" (waiting Dept Head), "Pending Approval" (waiting Director) or let's check general Pending.
      // Let's make sure if Accounting Staff, they look for "Pending Review" that was checked, or any pending.
      // Let's count all pending POs (Pending Review, Pending Approval) for generic display, or role-specific:
      return po.status === "Pending Review" && po.checkedBy; // checked but not verified yet
    }
    if (currentUser.role === UserRole.Director) {
      return po.status === "Pending Approval";
    }
    return po.status === "Pending Review" || po.status === "Pending Approval";
  }).length;

  const approvedCount = pos.filter(po => po.status === "Approved").length;
  const suppliersCount = suppliers.length;

  // Total Procurement Volume (Sum of all approved POs)
  const totalSpent = pos
    .filter(po => po.status === "Approved")
    .reduce((sum, po) => sum + po.totalAmount, 0);

  // 2. Prepare Chart Data for Recharts
  // Monthly purchases (aggregating PO amounts by month)
  const monthsMap: Record<string, { month: string; amount: number; vat: number; count: number }> = {};
  
  // Last 6 months structure
  const last6Months = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthName = d.toLocaleString("default", { month: "short" });
    const yearStr = d.getFullYear();
    return `${monthName} ${yearStr}`;
  }).reverse();

  last6Months.forEach(m => {
    monthsMap[m] = { month: m, amount: 0, vat: 0, count: 0 };
  });

  pos.forEach(po => {
    const poDate = new Date(po.poDate);
    const monthName = poDate.toLocaleString("default", { month: "short" });
    const yearStr = poDate.getFullYear();
    const key = `${monthName} ${yearStr}`;
    
    if (monthsMap[key]) {
      monthsMap[key].amount += po.totalAmount;
      monthsMap[key].vat += po.vat12;
      monthsMap[key].count += 1;
    } else {
      // If outside last 6 months, we can add it or ignore
      monthsMap[key] = { month: key, amount: po.totalAmount, vat: po.vat12, count: 1 };
    }
  });

  const barChartData = Object.values(monthsMap).slice(-6); // Keep last 6 months

  // Top Suppliers Chart Data (By approved PO totals)
  const supplierTotals: Record<string, { totalAmount: number; count: number }> = {};
  pos.filter(po => po.status === "Approved").forEach(po => {
    if (!supplierTotals[po.supplierName]) {
      supplierTotals[po.supplierName] = { totalAmount: 0, count: 0 };
    }
    supplierTotals[po.supplierName].totalAmount += po.totalAmount;
    supplierTotals[po.supplierName].count += 1;
  });

  const topSuppliersData = Object.entries(supplierTotals)
    .map(([name, data]) => ({ name, value: data.totalAmount, count: data.count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10); // top 10

  // Fill in placeholders if empty
  if (topSuppliersData.length === 0) {
    suppliers.slice(0, 3).forEach(s => {
      topSuppliersData.push({ name: s.name, value: 0, count: 0 });
    });
  }

  const COLORS = ["#8B0000", "#B22222", "#E57373", "#F28B82", "#FFCDD2"];

  // Format currency helpers
  const formatPHP = (val: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2
    }).format(val);
  };

  return (
    <div id="smei-dashboard" className="relative p-6 md:p-10 space-y-8 max-w-7xl mx-auto overflow-hidden">
      {/* 1. System Resource & Storage Monitoring Section */}
      <SystemMonitoringModule />

      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm relative z-10">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight font-display">
            Purchase Order Summary Monitoring System Dashboard
          </h2>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
            Logged in as <span className="font-semibold text-smei-crimson dark:text-rose-400">{currentUser.fullName}</span> ({currentUser.role}). Welcome to the control center.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-neutral-400 font-mono bg-gray-50 dark:bg-neutral-800 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-neutral-700 self-start md:self-auto">
          <Calendar className="w-4 h-4 text-smei-crimson dark:text-rose-400 animate-pulse" />
          <span className="uppercase font-bold text-gray-400">LIVE SESSION:</span>
          <span className="font-semibold text-gray-600 dark:text-neutral-300">{currentLiveTime || "Loading..."}</span>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 relative z-10">
        {/* Metric 1 */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="bg-white dark:bg-neutral-900 p-6 rounded-xl border-l-4 border-l-smei-darkred dark:border-l-[#B22222] border-y border-r border-y-gray-200 border-r-gray-200 dark:border-y-neutral-800 dark:border-r-neutral-800 shadow-sm flex items-center justify-between cursor-pointer"
          onClick={onNavigateToPOList}
        >
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Total Purchase Orders</p>
            <h3 className="text-3xl font-black text-gray-800 dark:text-white font-mono">{totalPOs}</h3>
            <p className="text-[10px] text-gray-500 dark:text-neutral-400 flex items-center gap-1">
              <span>View purchase order records</span>
              <ArrowRight className="w-3 h-3 text-smei-crimson dark:text-rose-400" />
            </p>
          </div>
          <div className="bg-red-50 dark:bg-neutral-800 p-3 rounded-lg border border-red-100 dark:border-neutral-700 shrink-0">
            <FileText className="w-5 h-5 text-smei-crimson dark:text-rose-400" />
          </div>
        </motion.div>

        {/* Metric 2 */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="bg-white dark:bg-neutral-900 p-6 rounded-xl border-l-4 border-l-yellow-600 border-y border-r border-y-gray-200 border-r-gray-200 dark:border-y-neutral-800 dark:border-r-neutral-800 shadow-sm flex items-center justify-between cursor-pointer"
          onClick={onNavigateToPOList}
        >
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Awaiting My Action</p>
            <h3 className={`text-3xl font-black font-mono ${pendingApprovalsCount > 0 ? "text-yellow-600 dark:text-yellow-500 animate-pulse" : "text-gray-800 dark:text-white"}`}>
              {pendingApprovalsCount}
            </h3>
            <p className="text-[10px] text-gray-500 dark:text-neutral-400">Based on authorization level</p>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-100 dark:border-yellow-900/50 shrink-0">
            <ClipboardCheck className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
          </div>
        </motion.div>

        {/* Metric 3 */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="bg-white dark:bg-neutral-900 p-6 rounded-xl border-l-4 border-l-green-600 border-y border-r border-y-gray-200 border-r-gray-200 dark:border-y-neutral-800 dark:border-r-neutral-800 shadow-sm flex items-center justify-between cursor-pointer"
          onClick={onNavigateToPOList}
        >
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Approved POs</p>
            <h3 className="text-3xl font-black text-green-600 dark:text-green-500 font-mono">{approvedCount}</h3>
            <p className="text-[10px] text-gray-500 dark:text-neutral-400">Authorized & ready for conforme</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-100 dark:border-green-900/50 shrink-0">
            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-500" />
          </div>
        </motion.div>

        {/* Metric 4 */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="bg-white dark:bg-neutral-900 p-6 rounded-xl border-l-4 border-l-blue-600 border-y border-r border-y-gray-200 border-r-gray-200 dark:border-y-neutral-800 dark:border-r-neutral-800 shadow-sm flex items-center justify-between cursor-pointer"
          onClick={onNavigateToSuppliers}
        >
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Active Suppliers</p>
            <h3 className="text-3xl font-black text-gray-800 dark:text-white font-mono">{suppliersCount}</h3>
            <p className="text-[10px] text-gray-500 dark:text-neutral-400">Verified CEZ industrial partners</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-900/50 shrink-0">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-500" />
          </div>
        </motion.div>
      </div>

      {/* Financial Spent Summary Panel */}
      <div className="bg-gradient-to-r from-smei-darkred to-smei-crimson text-white rounded-2xl p-6 shadow-lg shadow-red-950/15 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-red-100">Total Authorized Procurement</p>
          <p className="text-3xl md:text-4xl font-extrabold font-mono tracking-tight">{formatPHP(totalSpent)}</p>
          <p className="text-xs text-red-200">Excluding EWT taxes withheld and pending drafts</p>
        </div>
        <div className="text-xs font-mono bg-white/10 px-4 py-3 rounded-xl border border-white/10 self-stretch md:self-auto flex flex-col justify-center gap-1">
          <div>VAT Exempted: {formatPHP(pos.filter(po => po.status === "Approved" && po.category.includes("Exempt")).reduce((sum, p) => sum + p.totalAmount, 0))}</div>
          <div>Zero Rated: {formatPHP(pos.filter(po => po.status === "Approved" && po.category.includes("Zero")).reduce((sum, p) => sum + p.totalAmount, 0))}</div>
          <div>12% Vatable: {formatPHP(pos.filter(po => po.status === "Approved" && po.category.includes("Vatable")).reduce((sum, p) => sum + p.totalAmount, 0))}</div>
        </div>
      </div>

      {/* PO Modules Launchpad */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white uppercase tracking-wider font-mono">
            PO Modules Launchpad
          </h3>
          <p className="text-xs text-gray-500 dark:text-neutral-400">
            Select any procurement, sourcing, or compliance workspace below.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              title: "Procurement Approval Hub",
              desc: "Unified document-specific approval portal for PO, PIS, RFS, and Canvass Sheets.",
              icon: UserCheck,
              tab: "procurement-approval",
              color: "border-l-rose-600",
              iconColor: "text-rose-600",
              badge: "Central Approval"
            },
            {
              title: "Purchase Order Registry",
              desc: "Create, view, manage, and process procurement contracts and purchase order worksheets.",
              icon: FileText,
              tab: "po-all",
              color: "border-l-red-500",
              iconColor: "text-red-500",
              badge: "Procurement"
            },
            {
              title: "Payment Instruction Slip (PIS)",
              desc: "Verify invoicing details, bank specifications, and payment processing requests.",
              icon: CreditCard,
              tab: "pis",
              color: "border-l-amber-500",
              iconColor: "text-amber-500",
              badge: "Finance"
            },
            {
              title: "Request for Supply (RFS)",
              desc: "Log warehouse supply requirements, active requests, and item specifications.",
              icon: Package,
              tab: "rfs",
              color: "border-l-blue-500",
              iconColor: "text-blue-500",
              badge: "Inventory"
            },
            {
              title: "Canvass Sheet Module",
              desc: "Compare supplier bidding details, active canvassing sheets, and quotation comparisons.",
              icon: GitCompare,
              tab: "canvass",
              color: "border-l-purple-500",
              iconColor: "text-purple-500",
              badge: "Sourcing"
            },
            {
              title: "Supplier Registry",
              desc: "Maintain profiles, tax certificates, and verified contacts of EPZA industrial partners.",
              icon: Users,
              tab: "suppliers",
              color: "border-l-indigo-500",
              iconColor: "text-indigo-500",
              badge: "Suppliers"
            }
          ].map((item, idx) => (
            <motion.div
              key={idx}
              whileHover={{ y: -4, scale: 1.01 }}
              className={`bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 border-l-4 ${item.color} p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer`}
              onClick={() => onNavigate(item.tab)}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 group-hover:bg-neutral-100 dark:group-hover:bg-neutral-800 transition-colors">
                    <item.icon className={`w-6 h-6 ${item.iconColor}`} />
                  </div>
                  <span className="text-[9px] font-mono font-bold tracking-widest uppercase bg-gray-50 dark:bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded border border-gray-100 dark:border-neutral-700">
                    {item.badge}
                  </span>
                </div>

                <div className="space-y-1">
                  <h4 className="text-base font-bold text-gray-800 dark:text-white group-hover:text-red-500 dark:group-hover:text-rose-400 transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-neutral-400 leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between text-xs font-mono font-bold text-gray-400 dark:text-neutral-500 group-hover:text-red-500 dark:group-hover:text-rose-400 transition-colors">
                  <span>Open Module</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Analytical Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Trend Chart */}
        <div className="bg-white dark:bg-neutral-900 p-5 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm lg:col-span-2 flex flex-col justify-between h-[400px]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white font-display">Procurement Volume Trend</h3>
              <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">Aggregate monthly transaction values in PHP</p>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-mono text-gray-400">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Auto-refreshing</span>
            </div>
          </div>

          <div className="flex-1 w-full relative min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={barChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" className="dark:stroke-neutral-800/40" />
                <XAxis dataKey="month" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `₱${v / 1000}k`} tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value: any) => [formatPHP(Number(value)), "Procurement Amount"]}
                  contentStyle={{ background: "#1f2937", border: "none", borderRadius: "8px", color: "#fff" }}
                />
                <Line type="monotone" dataKey="amount" stroke="#B22222" strokeWidth={3} dot={{ r: 4, fill: "#B22222", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Suppliers Donut Chart */}
        <div className="bg-white dark:bg-neutral-900 p-5 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between overflow-hidden h-[400px]">
          <div className="mb-4 shrink-0">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white font-display">Top Suppliers by Procurement Amount</h3>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">Comparison of suppliers based on total procurement value.</p>
          </div>

          <div className="flex-1 w-full overflow-y-auto pr-2 relative min-h-0">
            {topSuppliersData.length > 0 && topSuppliersData[0].value > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(280, topSuppliersData.length * 40)}>
                <BarChart data={topSuppliersData} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" className="dark:stroke-neutral-800/40" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: any, name: any, props: any) => [formatPHP(Number(value)), `Total Procurement Amount (Count: ${props.payload.count})`]}
                    cursor={{fill: 'transparent'}}
                    contentStyle={{ background: "#1f2937", border: "none", borderRadius: "8px", color: "#fff" }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={30}>
                    {topSuppliersData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-xs text-gray-400 font-sans p-6 border-2 border-dashed border-gray-100 dark:border-neutral-800/40 rounded-xl h-full flex flex-col items-center justify-center">
                No supplier procurement data available.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity & Transactions Panel */}
      <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white font-display">Recent Activity & Transactions</h3>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">Most recently created or updated procurement operation records</p>
          </div>
          <button
            onClick={onNavigateToPOList}
            className="text-xs font-bold text-smei-crimson dark:text-rose-400 hover:text-smei-darkred dark:hover:text-rose-300 flex items-center gap-1 transition-all"
          >
            <span>See all records</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table id="smei-recent-transactions-table" className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400 text-xs uppercase tracking-wider font-semibold border-b border-gray-100 dark:border-neutral-800">
                <th className="py-3.5 px-4 font-display">Document Number</th>
                <th className="py-3.5 px-4 font-display">Module</th>
                <th className="py-3.5 px-4 font-display">Status</th>
                <th className="py-3.5 px-4 font-display">Date / Time</th>
                <th className="py-3.5 px-4 font-display">User</th>
                <th className="py-3.5 px-4 font-display text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-800 text-xs">
              {loadingActivities ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-gray-500 font-sans">
                     Loading recent operations logs...
                  </td>
                </tr>
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-gray-500 font-sans">
                    No recent activities recorded.
                  </td>
                </tr>
              ) : (
                activities.map((activity, index) => {
                  const statusColors: Record<string, string> = {
                    Draft: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700",
                    "Pending Review": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-500 dark:border-amber-900/50",
                    "Pending Approval": "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-500 dark:border-yellow-900/50",
                    Approved: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-500 dark:border-green-900/50",
                    Completed: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-500 dark:border-green-900/50",
                    Complete: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-500 dark:border-green-900/50",
                    "On Time": "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-500 dark:border-green-900/50",
                    Incomplete: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-500 dark:border-orange-900/50",
                    Pending: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-500 dark:border-yellow-900/50",
                    Released: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-500 dark:border-blue-900/50",
                    Rejected: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-500 dark:border-red-900/50",
                    Cancelled: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-500 dark:border-orange-900/50",
                    Closed: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-500 dark:border-blue-900/50",
                  };

                  return (
                    <tr
                      key={activity.id}
                      onClick={() => {
                        if (activity.rawItem.type === "po-all") {
                          onSelectPO(activity.rawItem.data);
                        } else {
                          onNavigate(activity.rawItem.type);
                        }
                      }}
                      className={`hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition-colors cursor-pointer ${
                        index % 2 === 1 ? "bg-gray-50/20 dark:bg-neutral-800/10" : "bg-white/40 dark:bg-transparent"
                      }`}
                      title={activity.rawItem.type === "po-all" ? "Click to View/Edit PO" : `Click to open ${activity.module}`}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-smei-darkred dark:text-rose-400">
                        {activity.docNumber || "N/A"}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-gray-800 dark:text-white">
                        {activity.module}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColors[activity.status] || "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-300"}`}>
                          {activity.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-gray-500 dark:text-neutral-400">
                        {formatActivityDate(activity.dateTime)}
                      </td>
                      <td className="py-3.5 px-4 text-gray-700 dark:text-neutral-300 truncate max-w-[150px]">
                        {activity.user}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activity.rawItem.type === "po-all") {
                              onSelectPO(activity.rawItem.data);
                            } else {
                              onNavigate(activity.rawItem.type);
                            }
                          }}
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-rose-900/20 hover:text-smei-crimson dark:hover:text-rose-400 text-gray-400 dark:text-neutral-500 rounded-lg transition-all"
                          title="Open Module"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
