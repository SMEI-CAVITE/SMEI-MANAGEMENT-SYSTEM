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

  const [pinChallengeSystem, setPinChallengeSystem] = React.useState<"po" | "tsd" | null>(null);
  const [pinInput, setPinInput] = React.useState("");
  const [pinError, setPinError] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Focus input when challenge opens
  React.useEffect(() => {
    if (pinChallengeSystem && inputRef.current) {
      inputRef.current.focus();
    }
  }, [pinChallengeSystem]);

  const handleSystemClick = (system: "po" | "tsd") => {
    // Admins always bypass security
    if (currentUser.role === UserRole.Administrator) {
      onSelectSystem(system);
      return;
    }

    // Check if portal security PIN is enabled
    const savedSetting = localStorage.getItem("smei_portal_security_config");
    let isPortalSecurityEnabled = false;

    if (savedSetting !== null) {
      try {
        const parsedSetting = JSON.parse(savedSetting);
        isPortalSecurityEnabled = !!parsedSetting.enabled;
      } catch (e) {
        isPortalSecurityEnabled = false;
      }
    }

    if (!isPortalSecurityEnabled) {
      onSelectSystem(system);
      return;
    }

    // Check if already unlocked in session
    const isUnlocked = sessionStorage.getItem("smei_portal_unlocked") === "true";
    if (isUnlocked) {
      onSelectSystem(system);
      return;
    }

    // Trigger PIN challenge
    setPinChallengeSystem(system);
    setPinInput("");
    setPinError("");
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const savedSetting = localStorage.getItem("smei_portal_security_config");
    let requiredPin = "1111";
    if (savedSetting !== null) {
      try {
        const parsed = JSON.parse(savedSetting);
        if (pinChallengeSystem === "po") {
          requiredPin = parsed.poPinCode || parsed.pinCode || "1111";
        } else if (pinChallengeSystem === "tsd") {
          requiredPin = parsed.tsdPinCode || parsed.pinCode || "1111";
        }
      } catch (err) {}
    }

    if (pinInput === requiredPin) {
      sessionStorage.setItem("smei_portal_unlocked", "true");
      const system = pinChallengeSystem;
      setPinChallengeSystem(null);
      if (system) {
        onSelectSystem(system);
      }
    } else {
      setPinError(`Invalid PIN code for ${pinChallengeSystem === "po" ? "Purchase Order" : "TSD Compliance"} Portal. Please try again.`);
      setPinInput("");
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
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
            © 2026 Southcoast Metal Enterprise, Inc. • Compliance Secure Access Gate
          </p>
        </div>

      </div>

      {/* Enterprise Control Portal Security PIN Modal */}
      {pinChallengeSystem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl bg-slate-900/40 dark:bg-black/60 transition-all duration-300">
          <div 
            className="bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-2xl max-w-sm w-full text-center space-y-6 transform animate-scaleIn relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              onClick={() => setPinChallengeSystem(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-lg"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Lock Header Circle */}
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-500 shadow-inner">
                <Shield className="w-6 h-6 animate-pulse" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-white font-sans flex items-center justify-center gap-1.5">
                <Shield className="w-4 h-4 text-amber-500" />
                Portal Access Protection
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                Administrative credentials required. Enter the portal protection PIN to authorize access to the <span className="font-bold text-slate-700 dark:text-slate-300">{pinChallengeSystem === "po" ? "Purchase Orders System" : "TSD Compliance Portal"}</span>.
              </p>
            </div>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div className="space-y-2">
                <input
                  ref={inputRef}
                  type="password"
                  required
                  pattern="[0-9]*"
                  inputMode="numeric"
                  placeholder="••••"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value.replace(/\D/g, ""));
                    setPinError("");
                  }}
                  className="w-full text-center tracking-[1.5em] font-mono font-bold text-xl px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-slate-800 dark:text-white placeholder-slate-300 dark:placeholder-slate-600"
                />
                
                {pinError ? (
                  <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold animate-bounce">
                    {pinError}
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    Click inside & enter the numeric portal PIN
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white rounded-xl shadow-lg font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] cursor-pointer"
              >
                Verify Credentials
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
