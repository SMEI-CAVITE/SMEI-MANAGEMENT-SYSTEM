import React from "react";
import { motion } from "motion/react";
import { 
  ClipboardCheck, 
  Truck, 
  LogOut, 
  Sun, 
  Moon, 
  ArrowRight, 
  Building2,
  Shield,
  User as UserIcon,
  Lock,
  ShieldAlert,
  X
} from "lucide-react";
import { User, UserRole } from "../types";
import { useTheme } from "./ThemeProvider";
import smeiLogo from "../assets/images/smei_logo_1782431389924.jpg";
import EnterprisePortalBackground from "./EnterprisePortalBackground";

interface SystemSelectorProps {
  currentUser: User;
  onSelectSystem: (system: "po" | "tsd") => void;
  onLogout: () => void;
}

export default function SystemSelector({ currentUser, onSelectSystem, onLogout }: SystemSelectorProps) {
  const { theme, toggleTheme } = useTheme();

  const handleSystemClick = (system: "po" | "tsd") => {
    onSelectSystem(system);
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] flex flex-col items-center justify-center p-4 md:p-8 transition-colors duration-300 relative overflow-hidden">
      {/* Animated NeatGradient Background */}
      <EnterprisePortalBackground />

      {/* Subtle overlay layer for accessibility / readability */}
      <div className="absolute inset-0 bg-neutral-50/60 dark:bg-[#0a0a0a]/75 backdrop-blur-[40px] z-0 pointer-events-none" />

      {/* Top Controls */}
      <div className="absolute top-6 right-6 z-10 flex items-center gap-3">
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors shadow-sm cursor-pointer"
          title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
        >
          {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>

        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-neutral-500 hover:text-red-600 dark:text-neutral-400 dark:hover:text-red-400 font-mono text-xs font-bold transition-colors shadow-sm cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>LOG OUT</span>
        </button>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-4xl z-10 space-y-8">
        
        {/* Branding & Greeting Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="w-16 h-16 bg-smei-crimson dark:bg-[#B22222] rounded-2xl flex items-center justify-center shadow-lg border border-red-200 dark:border-[#d32f2f]/30"
            >
              <span className="text-white font-mono font-black text-2xl tracking-tighter">SMEI</span>
            </motion.div>
          </div>

          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-mono uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
              Southcoast Metal Enterprise, Inc.
            </h1>
            <p className="text-3xl md:text-4xl font-black text-neutral-900 dark:text-white tracking-tight font-display">
              Enterprise Control Portal
            </p>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 text-smei-crimson dark:text-rose-400 text-sm font-medium"
          >
            <UserIcon className="w-4 h-4" />
            <span>Welcome, <strong>{currentUser.fullName}</strong></span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-red-100 dark:bg-red-950 text-red-700 dark:text-rose-300 font-bold border border-red-200 dark:border-red-900/50">
              {currentUser.role}
            </span>
          </motion.div>
        </div>

        {/* Modules Selection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          
          {/* Card 1: Purchase Order System */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            whileHover={{ y: -5, scale: 1.01 }}
            className="bg-white dark:bg-neutral-900 rounded-3xl border border-gray-100 dark:border-neutral-800 p-8 shadow-sm hover:shadow-xl hover:border-red-200 dark:hover:border-red-950 transition-all duration-300 flex flex-col justify-between group cursor-pointer relative overflow-hidden"
            onClick={() => handleSystemClick("po")}
          >
            {/* Background pattern accent */}
            <div className="absolute right-0 top-0 w-32 h-32 bg-red-500/[0.02] dark:bg-red-500/[0.03] rounded-full blur-xl translate-x-12 -translate-y-12 group-hover:bg-red-500/[0.05] transition-all" />

            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 text-smei-crimson dark:text-rose-400 border border-red-100 dark:border-red-900/20">
                  <ClipboardCheck className="w-8 h-8" />
                </div>
                <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-red-500 bg-red-100/50 dark:bg-red-950/50 dark:text-rose-400 px-2.5 py-1 rounded-full border border-red-100 dark:border-red-900/30">
                  POMS
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black text-neutral-900 dark:text-white font-display tracking-tight group-hover:text-smei-crimson dark:group-hover:text-rose-400 transition-colors">
                  Purchase Orders
                </h3>
                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 tracking-wide uppercase font-mono">
                  Procurement & Supply Chain
                </p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed pt-2">
                  Access the core Purchasing Management System. Draft purchase orders, evaluate suppliers, manage payment instruction slips, review RFS queues, and generate corporate financial document exports.
                </p>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between text-smei-crimson dark:text-rose-400 font-mono text-xs font-bold uppercase tracking-wider group-hover:translate-x-1 transition-transform">
              <span>Enter Purchase Orders System</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </motion.div>

          {/* Card 2: Transport Storage Disposal System */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            whileHover={{ y: -5, scale: 1.01 }}
            className="bg-white dark:bg-neutral-900 rounded-3xl border border-gray-100 dark:border-neutral-800 p-8 shadow-sm hover:shadow-xl hover:border-red-200 dark:hover:border-red-950 transition-all duration-300 flex flex-col justify-between group cursor-pointer relative overflow-hidden"
            onClick={() => handleSystemClick("tsd")}
          >
            {/* Background pattern accent */}
            <div className="absolute right-0 top-0 w-32 h-32 bg-amber-500/[0.02] dark:bg-amber-500/[0.03] rounded-full blur-xl translate-x-12 -translate-y-12 group-hover:bg-amber-500/[0.05] transition-all" />

            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/20">
                  <Truck className="w-8 h-8" />
                </div>
                <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-amber-600 bg-amber-100/50 dark:bg-amber-950/50 dark:text-amber-400 px-2.5 py-1 rounded-full border border-amber-100 dark:border-amber-900/30">
                  TSD Compliance
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black text-neutral-900 dark:text-white font-display tracking-tight group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  Transport Storage Disposal
                </h3>
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-500 tracking-wide uppercase font-mono">
                  Environmental Logistics
                </p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed pt-2">
                  Access the TSD Monitoring workspace. Track tracking code generator sequences, verify terminal unloading/loading logs, check the hazardous waste catalog, log internal loops, and audit compliance timestamps.
                </p>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between text-amber-600 dark:text-amber-400 font-mono text-xs font-bold uppercase tracking-wider group-hover:translate-x-1 transition-transform">
              <span>Enter TSD Monitoring System</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </motion.div>

        </div>

        {/* Footer info */}
        <div className="text-center pt-4">
          <p className="text-[10px] font-mono tracking-widest text-neutral-400 uppercase">
            © 2026 SMEI Management System Developed by <span className="animate-pulse font-bold text-neutral-300 dark:text-neutral-200">Paul Joseph Salgado</span>
          </p>
        </div>

      </div>
    </div>
  );
}
