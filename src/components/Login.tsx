/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import { LogIn, Shield, Eye, EyeOff, Lock, User as UserIcon } from "lucide-react";
import smeiLogo from "../assets/images/smei_logo_1782431389924.jpg";
import { User } from "../types";
import { api } from "../lib/api";

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("ADMIN");
  const [departmentOthers, setDepartmentOthers] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [logoError, setLogoError] = useState(false);

  // Secure Generated Logo Path
  const logoSrc = smeiLogo;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setIsLoading(true);
    try {
      const response = await api.login(username.trim(), password);
      onLoginSuccess(response.user);
    } catch (err: any) {
      setError(err.message || "Failed to authenticate. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    
    const finalDepartment = department === "OTHERS" ? departmentOthers : department;
    if (department === "OTHERS" && !departmentOthers.trim()) {
      setError("Please specify your department.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.registerPublicUser({
        username: username.trim(),
        password,
        fullName: fullName.trim(),
        department: finalDepartment
      });
      setSuccessMsg(response.message || "Registration successful. Please wait for an administrator to approve your account.");
      setIsRegistering(false);
      setPassword(""); // Clear password
    } catch (err: any) {
      setError(err.message || "Failed to register.");
    } finally {
      setIsLoading(false);
    }
  };
return (
    <div id="smei-login-container" className="min-h-screen bg-gray-50 flex items-center justify-center p-4 sm:p-6 md:p-10">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col md:flex-row"
      >
        {/* Left Panel: Brand / Corporate Info */}
        <div className="bg-gradient-to-br from-smei-darkred via-smei-crimson to-red-950 p-8 md:p-12 text-white flex flex-col justify-between md:w-5/12">
          <div className="space-y-4">
            <div className="smei-logo-container inline-flex bg-white p-3 rounded-2xl shadow-lg border border-red-800">
              {!logoError ? (
                <img
                  src={logoSrc}
                  alt="SMEI logo"
                  className="smei-logo-img w-16 h-16 object-contain"
                  referrerPolicy="no-referrer"
                  onError={() => {
                    console.error("SMEI logo failed to load on Login. Using fallback.");
                    setLogoError(true);
                  }}
                />
              ) : (
                <div className="w-16 h-16 flex items-center justify-center bg-red-100 rounded text-smei-crimson font-black text-xl font-display">
                  SMEI
                </div>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold font-display tracking-wide uppercase">SMEI</h2>
              <p className="text-sm font-semibold tracking-wider uppercase text-red-200 mt-1">
                Southcoast Metal Enterprise, Inc.
              </p>
              <div className="flex items-center gap-2 mt-4 bg-black/20 backdrop-blur-sm py-1.5 px-3 rounded-lg w-fit border border-emerald-500/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] font-mono font-medium tracking-wider text-emerald-400 uppercase">
                  SMEI - CAVITE, PH
                </span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-red-300 font-mono border-t border-red-800/60 pt-4 mt-auto">
            Authorized Personnel Only • POMS v3.2.0 (Durable DB)
          </div>
        </div>

        {/* Right Panel: Login/Register Form */}
        <div className="p-8 md:p-12 flex-1 flex flex-col justify-center bg-white h-[600px] overflow-y-auto">
          <div>
            <div className="mb-6 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-bold text-gray-800 font-display">
                  {isRegistering ? "Create Account" : "System Portal Login"}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {isRegistering ? "Register for POMS access" : "Please enter your credentials to access POMS dashboard"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setIsRegistering(!isRegistering); setError(""); setSuccessMsg(""); }}
                className="text-xs font-semibold text-smei-crimson hover:text-red-700 underline"
              >
                {isRegistering ? "Back to Login" : "Register"}
              </button>
            </div>

            {error && (
              <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl flex items-start gap-2 animate-shake">
                <Shield className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            {successMsg && (
              <div className="mb-5 bg-green-50 border border-green-200 text-green-700 text-xs px-4 py-3 rounded-xl flex items-start gap-2">
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
              {isRegistering && (
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter full name"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-sans focus:outline-none focus:ring-2 focus:ring-smei-crimson focus:border-transparent focus:bg-white transition-all"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-3.5 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-sans focus:outline-none focus:ring-2 focus:ring-smei-crimson focus:border-transparent focus:bg-white transition-all"
                  />
                </div>
              </div>

              {isRegistering && (
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                    Department
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-sans focus:outline-none focus:ring-2 focus:ring-smei-crimson focus:border-transparent focus:bg-white transition-all"
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="TECHNICAL">TECHNICAL</option>
                    <option value="ACCOUNTING">ACCOUNTING</option>
                    <option value="OM SALES">OM SALES</option>
                    <option value="SALES">SALES</option>
                    <option value="OTHERS">OTHERS</option>
                  </select>
                  {department === "OTHERS" && (
                    <input
                      type="text"
                      required
                      value={departmentOthers}
                      onChange={(e) => setDepartmentOthers(e.target.value)}
                      placeholder="Specify department"
                      className="w-full mt-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-sans focus:outline-none focus:ring-2 focus:ring-smei-crimson focus:border-transparent focus:bg-white transition-all"
                    />
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-11 pr-11 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-sans focus:outline-none focus:ring-2 focus:ring-smei-crimson focus:border-transparent focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-smei-darkred to-smei-crimson text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-red-900/10 hover:shadow-red-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>{isRegistering ? "Register Account" : "Access System Securely"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
          <div className="mt-8 border-t border-gray-100 pt-6">
            <p className="text-[11px] text-gray-400 leading-normal text-center">
              Protected by military-grade encryption and secure access controls. Unauthorized connection attempts will be logged and reported to Security <strong className="font-bold">Operations</strong>.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
