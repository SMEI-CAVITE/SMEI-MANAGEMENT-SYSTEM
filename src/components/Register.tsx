import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Shield, UserPlus, Lock, User as UserIcon, Mail } from "lucide-react";
import { api } from "../lib/api";

export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [assignedRole, setAssignedRole] = useState("");
  const [assignedDepartment, setAssignedDepartment] = useState("");
  
  // URL Params
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get("token");

  useEffect(() => {
    const verifyInvitation = async () => {
      if (!token) {
        setIsVerifying(false);
        return;
      }
      try {
        const invite = await api.getInvitation(token);
        setAssignedRole(invite.role);
        setAssignedDepartment(invite.department);
      } catch (err: any) {
        setError(err.message || "This invitation link is invalid or has expired.");
      } finally {
        setIsVerifying(false);
      }
    };
    verifyInvitation();
  }, [token]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      setIsLoading(false);
      return;
    }

    try {
      // Register user and perform automatic login
      const response = await api.registerUser({
        token: token || "",
        username,
        password,
        fullName,
      });
      setSuccess(true);
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to register. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <Shield className="w-16 h-16 text-smei-crimson mx-auto mb-4 animate-pulse" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Verifying Invitation Link</h2>
          <p className="text-sm text-gray-500">Contacting security node, please wait...</p>
        </div>
      </div>
    );
  }

  if (!token || error.includes("invalid") || error.includes("expired") || error.includes("invitation")) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Invalid Invitation Link</h2>
          <p className="text-sm text-gray-500 mb-6">{error || "This registration link is invalid or has expired."}</p>
          <button
            onClick={() => window.location.href = "/"}
            className="px-6 py-2 bg-gray-800 text-white font-semibold rounded-xl text-sm hover:bg-gray-900"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-8 h-8 text-green-600 animate-bounce" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Registration Successful</h2>
          <p className="text-sm text-gray-500 mb-6 font-medium text-green-600">Setting up secure session and redirecting you to portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100"
      >
        <div className="bg-gradient-to-br from-smei-darkred to-smei-crimson p-6 text-white text-center">
          <h2 className="text-xl font-bold font-display uppercase tracking-wide">Employee Registration</h2>
          <p className="text-xs text-red-200 mt-1">Complete your account setup to access POMS</p>
        </div>

        <div className="p-6">
          <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm">
            <div className="flex justify-between mb-2">
              <span className="text-gray-500 font-semibold text-xs uppercase">Assigned Role:</span>
              <span className="font-bold text-gray-800">{assignedRole}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-semibold text-xs uppercase">Department:</span>
              <span className="font-bold text-gray-800">{assignedDepartment}</span>
            </div>
          </div>

          {error && (
            <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl flex items-start gap-2 animate-shake">
              <Shield className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Full Name</label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-3.5 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-smei-crimson"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Username</label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-3.5 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="johndoe"
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-smei-crimson"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-smei-crimson"
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-smei-crimson text-white font-semibold py-3 px-4 rounded-xl shadow-lg hover:bg-red-700 transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? "Registering..." : "Complete Registration"}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
