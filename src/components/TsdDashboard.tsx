import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import SystemMonitoringModule from "./SystemMonitoringModule";
import { 
  LayoutDashboard, 
  Key, 
  FileText, 
  Layers, 
  TrendingUp, 
  Clock, 
  Activity, 
  ArrowRight,
  ShieldCheck,
  Truck,
  AlertTriangle,
  Flame,
  Calendar
} from "lucide-react";

interface TsdDashboardProps {
  onNavigate: (tab: string) => void;
}

export default function TsdDashboard({ onNavigate }: TsdDashboardProps) {
  const [currentLiveTime, setCurrentLiveTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentLiveTime(now.toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const stats = [
    { label: "Active Tracking Codes", value: "42", desc: "Generated in last 30 days", icon: Key, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/20" },
    { label: "Weighing Operations Today", value: "14 Trucks", desc: "Active loading/unloading", icon: Truck, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/20" },
    { label: "Cataloged Waste Classes", value: "38 Types", desc: "DENR-EMB standardized", icon: Flame, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/20" },
    { label: "Overall Tonnage (MT)", value: "185.4 t", desc: "Compliance rating 99.6%", icon: TrendingUp, color: "text-green-500", bg: "bg-green-50 dark:bg-green-950/20" }
  ];

  const launchpadItems = [
    {
      title: "Control No. Generator",
      desc: "Generate and validate unique regulatory tracking codes for hazardous waste manifests.",
      icon: Key,
      tab: "control-no",
      color: "border-l-blue-500",
      iconColor: "text-blue-500",
      badge: "Tracking"
    },
    {
      title: "Unloading / Loading Weighing Logs",
      desc: "Log incoming/outgoing truck scale tare, gross weights, and raw material cargo types.",
      icon: Truck,
      tab: "unloading-loading",
      color: "border-l-amber-500",
      iconColor: "text-amber-500",
      badge: "Scale Operations"
    },
    {
      title: "Hazardous Waste Catalog",
      desc: "Browse regulatory sub-types, DENR waste codes, and core hazard categories.",
      icon: Flame,
      tab: "hazardous-waste",
      color: "border-l-red-500",
      iconColor: "text-red-500",
      badge: "Catalog"
    },
    {
      title: "Waste Movement Ledger",
      desc: "Track internal material flows, storage locations, and active physical recycling loops.",
      icon: Layers,
      tab: "waste-movement",
      color: "border-l-indigo-500",
      iconColor: "text-indigo-500",
      badge: "Internal Logs"
    },
    {
      title: "Compliance Timestamp Timeline",
      desc: "Verify critical step delays, processing timers, and checklist validation times.",
      icon: Clock,
      tab: "timestamp",
      color: "border-l-emerald-500",
      iconColor: "text-emerald-500",
      badge: "Audits & SLA"
    },
    {
      title: "Hazardous Waste Manifest Summary",
      desc: "Query, filter, and reconcile submitted physical manifests and dispatch reports.",
      icon: FileText,
      tab: "manifest-summary",
      color: "border-l-teal-500",
      iconColor: "text-teal-500",
      badge: "Reports"
    }
  ];

  return (
    <div id="tsd-dashboard" className="relative p-6 md:p-10 space-y-8 max-w-7xl mx-auto overflow-hidden">
      {/* 1. System Resource & Storage Monitoring Section */}
      <SystemMonitoringModule />

      {/* Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm relative z-10">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight font-display">
            TSD Control Center Overview
          </h2>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
            Hazardous Waste Compliance, Logistics Monitoring, and Manifest Reconciliation System.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-neutral-400 font-mono bg-gray-50 dark:bg-neutral-800 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-neutral-700 self-start md:self-auto">
          <Calendar className="w-4 h-4 text-smei-crimson dark:text-rose-400 animate-pulse" />
          <span className="uppercase font-bold text-gray-400">MONITORING TIME:</span>
          <span className="font-semibold text-gray-600 dark:text-neutral-300">{currentLiveTime || "Loading..."}</span>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, idx) => (
          <motion.div
            key={idx}
            whileHover={{ y: -3 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm flex items-center justify-between"
          >
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">{stat.label}</p>
              <h3 className="text-3xl font-black text-gray-800 dark:text-white font-mono">{stat.value}</h3>
              <p className="text-[10px] text-gray-500 dark:text-neutral-400">{stat.desc}</p>
            </div>
            <div className={`${stat.bg} p-3 rounded-lg shrink-0`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Alert Banner / Status Board */}
      <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-900/30 rounded-2xl p-5 flex items-start gap-4">
        <div className="bg-amber-100 dark:bg-amber-950/50 p-2 rounded-lg text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider font-mono">
            System Operations Normal • DENR Compliance Active
          </h4>
          <p className="text-xs text-amber-700/80 dark:text-amber-400/70 leading-relaxed">
            All physical incoming and outgoing manifest logs are synced with the digital CEZ (Cavite Export Zone) environmental tracking loop. Active permits have been audited and verified for the current cycle.
          </p>
        </div>
      </div>

      {/* Launchpad Section Header */}
      <div className="space-y-1">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white uppercase tracking-wider font-mono">
          TSD Modules Launchpad
        </h3>
        <p className="text-xs text-gray-500 dark:text-neutral-400">
          Select any compliance workspace below to audit, log, or generate manifests.
        </p>
      </div>

      {/* Launchpad Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {launchpadItems.map((item, idx) => (
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
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between text-xs font-mono font-bold text-gray-400 dark:text-neutral-500 group-hover:text-red-500 dark:group-hover:text-rose-400 transition-colors">
              <span>Open Module</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.div>
        ))}
      </div>

    </div>
  );
}
