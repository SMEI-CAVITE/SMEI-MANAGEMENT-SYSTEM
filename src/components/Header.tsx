/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { User, UserRole } from "../types";
import { LogOut, Bell, Shield, User as UserIcon, Settings, Menu, KeyRound, UserCheck, Check, Sun, Moon, ArrowLeftRight } from "lucide-react";
import smeiLogo from "../assets/images/smei_logo_1782431389924.jpg";
import { useTheme } from "./ThemeProvider";
import { motion, AnimatePresence } from "motion/react";

interface HeaderProps {
  currentUser: User | null;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
  currentTab: string;
  unreadCount: number;
  onOpenNotifications: () => void;
  onOpenProfile: (activeSection: "profile" | "settings" | "password") => void;
  onToggleSidebar?: () => void;
  onSwitchSystem?: () => void;
  activeSystem?: "po" | "tsd" | null;
}

export default function Header({
  currentUser,
  onLogout,
  onNavigate,
  currentTab,
  unreadCount,
  onOpenNotifications,
  onOpenProfile,
  onToggleSidebar,
  onSwitchSystem,
  activeSystem
}: HeaderProps) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
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

  // Translate currentTab to human-readable page name
  const getPageTitle = () => {
    switch (currentTab) {
      case "dashboard":
        return "Dashboard Overview";
      case "control-no":
        return "TSD Tracking Code Generator";
      case "unloading-loading":
        return "Unloading & Loading Terminal Weighing Logs";
      case "hazardous-waste":
        return "Hazardous Waste Catalog";
      case "waste-movement":
        return "Internal Material Loop & Waste Movement Ledger";
      case "timestamp":
        return "Compliance Timestamp Timeline Tracker";
      case "manifest-summary":
        return "Hazardous Waste Manifest Summary Ledger";
      case "po-list":
        return "Purchase Orders Directory";
      case "po-form":
        return "Purchase Order Workspace";
      case "suppliers":
        return "Suppliers Directory";
      case "supplier-report":
        return "Supplier Summary Report";
      case "supplier-analytics":
        return "Supplier Analytics Dashboard";
      case "pis":
        return "Payment Instruction Slips";
      case "rfs":
        return "Requests For Supply";
      case "rfs-approval":
        return "RFS Approval Workspace";
      case "canvass":
        return "Canvass Sheets Directory";
      case "users":
        return "User Management";
      case "roles":
        return "Role & Privilege Settings";
      case "audit-logs":
        return "Audit Trail Logs";
      default:
        return "Procurement Portal";
    }
  };

  const handleProfileClick = (section: "profile" | "settings" | "password") => {
    onOpenProfile(section);
    setIsProfileMenuOpen(false);
  };

  return (
    <header id="smei-app-header" className="w-full flex flex-col no-print bg-white border-b border-gray-200 dark:bg-neutral-950 dark:border-neutral-900 transition-colors duration-300">
      {/* Top Operations & Profile Bar */}
      <div className="py-2.5 px-4 md:px-10 flex items-center justify-between border-b border-gray-100 dark:border-neutral-900/50 gap-2 sm:gap-4">
        {/* Left Side: Page Context (No branding duplicate, branding is in sidebar) */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button 
            onClick={onToggleSidebar} 
            className="lg:hidden w-11 h-11 flex items-center justify-center -ml-2 text-gray-500 hover:text-[#B22222] hover:bg-gray-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900 rounded-lg transition-colors focus:outline-none shrink-0 cursor-pointer"
            aria-label="Toggle Navigation Sidebar"
          >
            <Menu className="w-5 h-5 pointer-events-none" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm md:text-base font-bold text-gray-800 dark:text-white tracking-wide font-display uppercase truncate max-w-[120px] sm:max-w-[250px] md:max-w-none">
              {getPageTitle()}
            </h1>
          </div>
        </div>

        {/* Right Side: Notification, Settings, Profile, Logout */}
        {currentUser && (
          <div className="flex items-center gap-1.5 sm:gap-3 md:gap-4 shrink-0">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="w-11 h-11 md:w-9 md:h-9 flex items-center justify-center text-gray-500 hover:text-[#B22222] hover:bg-gray-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900 rounded-lg transition-colors focus:outline-none relative overflow-hidden shrink-0 cursor-pointer"
              title={theme === 'light' ? "Switch to Dark Mode" : "Switch to Light Mode"}
              aria-label="Toggle dark/light theme"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={theme}
                  initial={{ y: -20, opacity: 0, rotate: -90 }}
                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                  exit={{ y: 20, opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="absolute pointer-events-none flex items-center justify-center"
                >
                  {theme === 'light' ? <Moon className="w-5 h-5 pointer-events-none" /> : <Sun className="w-5 h-5 pointer-events-none" />}
                </motion.div>
              </AnimatePresence>
            </button>

            {/* Notification Bell */}
            <button 
              onClick={onOpenNotifications}
              className="relative w-11 h-11 md:w-9 md:h-9 flex items-center justify-center text-gray-500 hover:text-[#B22222] hover:bg-gray-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900 rounded-lg transition-colors focus:outline-none shrink-0 cursor-pointer"
              title="View Alerts"
              aria-label="View notifications"
            >
              <Bell className="w-5 h-5 pointer-events-none" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 md:top-1.5 md:right-1.5 bg-[#B22222] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-white dark:border-neutral-950 animate-pulse pointer-events-none">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Settings Button */}
            <button 
              className="w-11 h-11 md:w-9 md:h-9 flex items-center justify-center text-gray-500 hover:text-[#B22222] hover:bg-gray-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900 rounded-lg transition-colors focus:outline-none hidden sm:flex shrink-0 cursor-pointer"
              title="System Settings"
              aria-label="System settings"
              onClick={() => {
                if (currentUser.role === UserRole.Administrator) {
                  onNavigate("roles"); // Admin Settings goes to roles matrix
                } else {
                  alert("Settings configuration is restricted to System Administrators.");
                }
              }}
            >
              <Settings className="w-5 h-5 pointer-events-none" />
            </button>

            {/* Switch System Portal Button */}
            {onSwitchSystem && (
              <button
                className="w-11 h-11 md:w-9 md:h-9 text-gray-500 hover:text-[#B22222] hover:bg-gray-100 dark:text-[#B22222] dark:hover:text-white dark:hover:bg-neutral-900 rounded-lg transition-colors focus:outline-none hidden sm:flex items-center justify-center shrink-0 cursor-pointer"
                title="Switch System Portal"
                aria-label="Switch system portal"
                onClick={onSwitchSystem}
              >
                <ArrowLeftRight className="w-5 h-5 text-amber-600 dark:text-amber-400 pointer-events-none" />
              </button>
            )}

            <div className="h-6 w-px bg-gray-200 dark:bg-neutral-800" />

            {/* User Profile Card Dropdown Container */}
            <div className="relative shrink-0">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2 p-1 hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-lg transition-all focus:outline-none text-left cursor-pointer"
                title="User Menu"
                aria-label="User menu"
                aria-expanded={isProfileMenuOpen}
                aria-haspopup="true"
              >
                <div className="w-9 h-9 rounded bg-gray-50 border border-gray-200 dark:bg-neutral-950 dark:border-neutral-850 overflow-hidden flex items-center justify-center shadow-inner pointer-events-none">
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.fullName}
                      className="w-full h-full object-cover pointer-events-none"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <UserIcon className="w-4 h-4 text-gray-600 dark:text-neutral-400 pointer-events-none" />
                  )}
                </div>
                <div className="text-left hidden sm:block pointer-events-none">
                  <p className="text-xs font-bold text-gray-800 dark:text-white truncate max-w-[140px] pointer-events-none">
                    {currentUser.fullName}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5 pointer-events-none">
                    <Shield className="w-2.5 h-2.5 text-[#B22222] pointer-events-none" />
                    <span className="text-[9px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-mono pointer-events-none">
                      {currentUser.role}
                    </span>
                  </div>
                </div>
              </button>

              {/* Profile Dropdown Popover */}
              {isProfileMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsProfileMenuOpen(false)} 
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 dark:bg-neutral-900 dark:border-neutral-800 rounded shadow-2xl py-1.5 z-20 text-xs text-gray-700 dark:text-neutral-300 animate-fadeIn">
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-neutral-850 bg-gray-50 dark:bg-neutral-950/80 rounded-t">
                      <p className="font-bold text-gray-800 dark:text-white truncate">{currentUser.fullName}</p>
                      <p className="text-[10px] text-gray-500 dark:text-neutral-400 font-mono truncate">{currentUser.email}</p>
                    </div>

                    <button
                      onClick={() => handleProfileClick("profile")}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-neutral-800 flex items-center gap-2 text-gray-700 dark:text-neutral-300 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4 text-gray-400 dark:text-neutral-500 pointer-events-none" />
                      <span>My Profile</span>
                    </button>

                    <button
                      onClick={() => handleProfileClick("settings")}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-neutral-800 flex items-center gap-2 text-gray-700 dark:text-neutral-300 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-gray-400 dark:text-neutral-500 pointer-events-none" />
                      <span>Account Settings</span>
                    </button>

                    <button
                      onClick={() => handleProfileClick("password")}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-neutral-800 flex items-center gap-2 text-gray-700 dark:text-neutral-300 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4 text-gray-400 dark:text-neutral-500 pointer-events-none" />
                      <span>Change Password</span>
                    </button>

                    <div className="border-t border-gray-100 dark:border-neutral-800 my-1.5" />

                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-500 pointer-events-none" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="h-6 w-px bg-gray-200 dark:bg-neutral-800 hidden sm:block" />

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="w-11 h-11 md:w-9 md:h-9 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-lg text-gray-500 dark:text-neutral-400 hover:text-[#B22222] transition-all focus:outline-none hidden sm:flex shrink-0 cursor-pointer"
              title="Logout from System"
              aria-label="Sign out"
            >
              <LogOut className="w-5 h-5 pointer-events-none" />
            </button>
          </div>
        )}
      </div>      {/* Navigation and System Operations Bar */}
      {currentUser && (
        <div className="lg:hidden bg-gray-50 border-t border-gray-200 dark:bg-neutral-950 dark:border-neutral-900 px-6 md:px-10 py-2 overflow-x-auto scrollbar-none flex items-center justify-between gap-2">
          <nav className="flex flex-nowrap items-center gap-1 md:gap-2 whitespace-nowrap">
            {activeSystem === "tsd" ? (
              <>
                <button
                  onClick={() => onNavigate("dashboard")}
                  className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all duration-200 ${
                    currentTab === "dashboard"
                      ? "bg-[#B22222] text-white shadow-[0_2px_8px_rgba(178,34,34,0.3)] scale-[1.03]"
                      : "text-gray-600 hover:text-[#B22222] hover:bg-red-50 hover:scale-[1.04] active:scale-95 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900"
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => onNavigate("control-no")}
                  className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all duration-200 ${
                    currentTab === "control-no"
                      ? "bg-[#B22222] text-white shadow-[0_2px_8px_rgba(178,34,34,0.3)] scale-[1.03]"
                      : "text-gray-600 hover:text-[#B22222] hover:bg-red-50 hover:scale-[1.04] active:scale-95 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900"
                  }`}
                >
                  Control No
                </button>
                <button
                  onClick={() => onNavigate("unloading-loading")}
                  className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all duration-200 ${
                    currentTab === "unloading-loading"
                      ? "bg-[#B22222] text-white shadow-[0_2px_8px_rgba(178,34,34,0.3)] scale-[1.03]"
                      : "text-gray-600 hover:text-[#B22222] hover:bg-red-50 hover:scale-[1.04] active:scale-95 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900"
                  }`}
                >
                  Unload/Load
                </button>
                <button
                  onClick={() => onNavigate("hazardous-waste")}
                  className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all duration-200 ${
                    currentTab === "hazardous-waste"
                      ? "bg-[#B22222] text-white shadow-[0_2px_8px_rgba(178,34,34,0.3)] scale-[1.03]"
                      : "text-gray-600 hover:text-[#B22222] hover:bg-red-50 hover:scale-[1.04] active:scale-95 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900"
                  }`}
                >
                  Haz Waste
                </button>
                <button
                  onClick={() => onNavigate("waste-movement")}
                  className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all duration-200 ${
                    currentTab === "waste-movement"
                      ? "bg-[#B22222] text-white shadow-[0_2px_8px_rgba(178,34,34,0.3)] scale-[1.03]"
                      : "text-gray-600 hover:text-[#B22222] hover:bg-red-50 hover:scale-[1.04] active:scale-95 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900"
                  }`}
                >
                  Movement
                </button>
                <button
                  onClick={() => onNavigate("timestamp")}
                  className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all duration-200 ${
                    currentTab === "timestamp"
                      ? "bg-[#B22222] text-white shadow-[0_2px_8px_rgba(178,34,34,0.3)] scale-[1.03]"
                      : "text-gray-600 hover:text-[#B22222] hover:bg-red-50 hover:scale-[1.04] active:scale-95 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900"
                  }`}
                >
                  Timestamp
                </button>
                <button
                  onClick={() => onNavigate("manifest-summary")}
                  className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all duration-200 ${
                    currentTab === "manifest-summary"
                      ? "bg-[#B22222] text-white shadow-[0_2px_8px_rgba(178,34,34,0.3)] scale-[1.03]"
                      : "text-gray-600 hover:text-[#B22222] hover:bg-red-50 hover:scale-[1.04] active:scale-95 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900"
                  }`}
                >
                  Manifest Sum
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onNavigate("dashboard")}
                  className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all duration-200 ${
                    currentTab === "dashboard"
                      ? "bg-[#B22222] text-white shadow-[0_2px_8px_rgba(178,34,34,0.3)] scale-[1.03]"
                      : "text-gray-600 hover:text-[#B22222] hover:bg-red-50 hover:scale-[1.04] active:scale-95 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900"
                  }`}
                >
                  Dashboard
                </button>
                
                <button
                  onClick={() => onNavigate("po-list")}
                  className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all duration-200 ${
                    currentTab === "po-list" || currentTab === "po-form"
                      ? "bg-[#B22222] text-white shadow-[0_2px_8px_rgba(178,34,34,0.3)] scale-[1.03]"
                      : "text-gray-600 hover:text-[#B22222] hover:bg-red-50 hover:scale-[1.04] active:scale-95 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900"
                  }`}
                >
                  Purchase Orders
                </button>

                <button
                  onClick={() => onNavigate("suppliers")}
                  className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all duration-200 ${
                    currentTab === "suppliers"
                      ? "bg-[#B22222] text-white shadow-[0_2px_8px_rgba(178,34,34,0.3)] scale-[1.03]"
                      : "text-gray-600 hover:text-[#B22222] hover:bg-red-50 hover:scale-[1.04] active:scale-95 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900"
                  }`}
                >
                  Suppliers
                </button>

                <button
                  onClick={() => onNavigate("pis")}
                  className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all duration-200 ${
                    currentTab === "pis"
                      ? "bg-[#B22222] text-white shadow-[0_2px_8px_rgba(178,34,34,0.3)] scale-[1.03]"
                      : "text-gray-600 hover:text-[#B22222] hover:bg-red-50 hover:scale-[1.04] active:scale-95 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900"
                  }`}
                >
                  PIS
                </button>

                <button
                  onClick={() => onNavigate("rfs")}
                  className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all duration-200 ${
                    currentTab === "rfs"
                      ? "bg-[#B22222] text-white shadow-[0_2px_8px_rgba(178,34,34,0.3)] scale-[1.03]"
                      : "text-gray-600 hover:text-[#B22222] hover:bg-red-50 hover:scale-[1.04] active:scale-95 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900"
                  }`}
                >
                  RFS
                </button>

                <button
                  onClick={() => onNavigate("canvass")}
                  className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all duration-200 ${
                    currentTab === "canvass"
                      ? "bg-[#B22222] text-white shadow-[0_2px_8px_rgba(178,34,34,0.3)] scale-[1.03]"
                      : "text-gray-600 hover:text-[#B22222] hover:bg-red-50 hover:scale-[1.04] active:scale-95 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900"
                  }`}
                >
                  Canvass
                </button>

                {(currentUser.role === UserRole.Administrator || currentUser.role === UserRole.PurchasingStaff) && (
                  <button
                    onClick={() => onNavigate("rfs-approval")}
                    className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all duration-200 ${
                      currentTab === "rfs-approval"
                        ? "bg-[#B22222] text-white shadow-[0_2px_8px_rgba(178,34,34,0.3)] scale-[1.03]"
                        : "text-gray-600 hover:text-[#B22222] hover:bg-red-50 hover:scale-[1.04] active:scale-95 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900"
                    }`}
                  >
                    RFS Approval
                  </button>
                )}
              </>
            )}

            {currentUser.role === UserRole.Administrator && (
              <>
                <button
                  onClick={() => onNavigate("users")}
                  className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all duration-200 ${
                    currentTab === "users"
                      ? "bg-[#B22222] text-white shadow-[0_2px_8px_rgba(178,34,34,0.3)] scale-[1.03]"
                      : "text-gray-600 hover:text-[#B22222] hover:bg-red-50 hover:scale-[1.04] active:scale-95 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900"
                  }`}
                >
                  Users
                </button>
                <button
                  onClick={() => onNavigate("roles")}
                  className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all duration-200 ${
                    currentTab === "roles"
                      ? "bg-[#B22222] text-white shadow-[0_2px_8px_rgba(178,34,34,0.3)] scale-[1.03]"
                      : "text-gray-600 hover:text-[#B22222] hover:bg-red-50 hover:scale-[1.04] active:scale-95 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900"
                  }`}
                >
                  Roles
                </button>
                <button
                  onClick={() => onNavigate("audit-logs")}
                  className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all duration-200 ${
                    currentTab === "audit-logs"
                      ? "bg-[#B22222] text-white shadow-[0_2px_8px_rgba(178,34,34,0.3)] scale-[1.03]"
                      : "text-gray-600 hover:text-[#B22222] hover:bg-red-50 hover:scale-[1.04] active:scale-95 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900"
                  }`}
                >
                  Audit Trail
                </button>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

// Beautiful print-only header layout using our high-quality generated logo
export function PrintHeader() {
  const logoSrc = smeiLogo;

  return (
    <div className="hidden print:flex flex-col items-center justify-center text-center border-b-2 border-black pb-4 mb-6">
      <div className="flex items-center gap-4">
        <div className="smei-logo-container p-1 rounded-lg shrink-0 bg-white">
          <img
            src={logoSrc}
            alt="SMEI Logo"
            className="w-16 h-16 object-contain smei-logo-img"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="text-left">
          <h1 className="text-xl font-bold uppercase tracking-wider font-display">
            Southcoast Metal Enterprise, Inc.
          </h1>
          <p className="text-xs text-gray-600">
            Block 8A, Phase 1, East Avenue, Cavite Economic Zone, Rosario, Cavite, Philippines
          </p>
          <p className="text-xs text-gray-600">
            Tel No: +63-46-437-1234 / Fax: +63-46-437-5678
          </p>
        </div>
      </div>
      <h2 className="text-lg font-bold uppercase tracking-widest mt-3 text-gray-800 border-t border-gray-400 pt-2 w-full">
        Purchase Order Document
      </h2>
    </div>
  );
}
