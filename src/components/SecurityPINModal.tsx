import React, { useState, useEffect, useRef } from "react";
import { Lock, ShieldAlert, ArrowRight, X } from "lucide-react";
import { User } from "../types";
import { SecurityService } from "../services/securityService";

interface SecurityPINModalProps {
  moduleName: string;
  currentUser?: User;
  onSuccess: () => void;
  onClose: () => void;
}

export default function SecurityPINModal({ moduleName, currentUser, onSuccess, onClose }: SecurityPINModalProps) {
  const [pinInput, setPinInput] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput) return;

    const res = SecurityService.verifyAndUnlock(moduleName, pinInput, currentUser);
    if (res.success) {
      onSuccess();
    } else {
      setError(res.error || "Invalid Administrative PIN code. Please try again.");
      setPinInput("");
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  const resolvedName = SecurityService.resolveModuleName(moduleName);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-xl bg-slate-900/40 dark:bg-black/60 transition-all duration-300">
      <div 
        className="bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-2xl max-w-sm w-full text-center space-y-6 transform animate-scaleIn relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-lg"
          title="Cancel"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Lock Header Circle */}
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center text-smei-crimson dark:text-red-500 shadow-inner">
            <Lock className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        <div className="space-y-1.5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-white font-sans flex items-center justify-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-red-500" />
            Security Verification
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
            Administrative credentials required. Enter the PIN to authorize access to the <span className="font-bold text-slate-700 dark:text-slate-300">{resolvedName}</span> module.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
                setError("");
              }}
              className="w-full text-center tracking-[1.5em] font-mono font-bold text-xl px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 focus:bg-white dark:focus:bg-slate-800 transition-all text-slate-800 dark:text-white placeholder-slate-300 dark:placeholder-slate-600"
            />
            
            {error ? (
              <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold">
                {error}
              </p>
            ) : (
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Click inside & enter your numeric PIN
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-800 hover:to-red-700 text-white rounded-xl shadow-lg font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] cursor-pointer"
          >
            Verify Credentials
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
