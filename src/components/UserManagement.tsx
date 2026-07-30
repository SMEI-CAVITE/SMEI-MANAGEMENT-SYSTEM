/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { User, UserRole } from "../types";
import { api } from "../lib/api";
import { getAppUrl } from "../config/env";
import { motion } from "motion/react";
import { 
  UserPlus, 
  Edit2, 
  Key, 
  UserCheck, 
  UserX, 
  Lock, 
  Unlock, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  RefreshCw,
  Link,
  Copy,
  Mail,
  QrCode,
  Trash2,
  Eye,
  EyeOff,
  ShieldCheck
} from "lucide-react";
import SecurityPINModal from "./SecurityPINModal";
import { SecurityService } from "../services/securityService";

interface UserManagementProps {
  currentUser?: User | null;
}

export default function UserManagement({ currentUser }: UserManagementProps = {}) {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [rolesList, setRolesList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [activeUser, setActiveUser] = useState<User | null>(currentUser || null);

  useEffect(() => {
    if (currentUser) {
      setActiveUser(currentUser);
    } else {
      api.getCurrentUser().then((res) => setActiveUser(res.user)).catch(() => {});
    }
  }, [currentUser]);

  const isAdmin = activeUser?.role === UserRole.Administrator || activeUser?.role === "Administrator";

  const defaultRolesList = ["Purchasing Staff", "Department Head", "Accounting Staff", "Director", "Viewer", "Administrator"];
  const getDisplayRoles = () => {
    if (rolesList && rolesList.length > 0) {
      // Return distinct sorted names
      return Array.from(new Set(rolesList.map(r => r.name)));
    }
    return defaultRolesList;
  };

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isGenerateLinkOpen, setIsGenerateLinkOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Link generation states
  const [linkConfig, setLinkConfig] = useState({
    role: "Purchasing Staff",
    department: "Purchasing",
    expiresIn: "24h",
    isOneTime: true
  });
  const [generatedLink, setGeneratedLink] = useState("");
  const [showQR, setShowQR] = useState(false);

  // Form states
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    fullName: "",
    email: "",
    employeeId: "",
    role: "Purchasing Staff",
    department: "Purchasing"
  });
  const [editFormData, setEditFormData] = useState({
    fullName: "",
    email: "",
    role: "",
    department: "",
    status: "" as "Active" | "Disabled" | "Locked"
  });
  const [newPassword, setNewPassword] = useState("");

  // Password Reveal & PIN Verification States
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [userForReveal, setUserForReveal] = useState<User | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [revealedPasswordData, setRevealedPasswordData] = useState<{
    username: string;
    fullName: string;
    employeeId?: string;
    password?: string;
    isFirebase?: boolean;
  } | null>(null);
  const [isMasked, setIsMasked] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  const handleInitiateReveal = (user: User) => {
    if (!isAdmin) return;
    setUserForReveal(user);
    const pinStatus = SecurityService.isPINRequired("User Accounts", activeUser);
    if (pinStatus.required) {
      setIsPinModalOpen(true);
    } else {
      executeRevealPassword(user);
    }
  };

  const executeRevealPassword = async (targetUser: User) => {
    setError("");
    try {
      const res = await api.revealPassword(targetUser.id);
      setRevealedPasswordData({
        username: targetUser.username,
        fullName: targetUser.fullName,
        employeeId: targetUser.employeeId,
        password: res.password || "Password unavailable",
        isFirebase: res.isFirebase
      });
      setIsMasked(true);
      setIsCopied(false);
      setIsPasswordModalOpen(true);
    } catch (err: any) {
      setError(err.message || "Failed to reveal user password");
    }
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await api.getUsers();
      setUsers(data);
      const depts = await api.getDepartments();
      setDepartments(depts);
      try {
        const fetchedRoles = await api.getRoles();
        setRolesList(fetchedRoles);
      } catch (roleErr) {
        console.warn("Failed to load roles in UserManagement, using defaults:", roleErr);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setFormErrors({});

    const newErrors: Record<string, string> = {};
    if (!formData.employeeId) newErrors.employeeId = "Employee ID is required.";
    if (!formData.username) newErrors.username = "Username is required.";
    if (!formData.password) newErrors.password = "Password is required.";
    if (!formData.fullName) newErrors.fullName = "Full Name is required.";
    if (!formData.email) newErrors.email = "Email Address is required.";

    let formattedEmpId = formData.employeeId.trim();
    if (formattedEmpId && !formattedEmpId.startsWith("SMEI-EMPLOYEE-")) {
      const digits = formattedEmpId.replace(/\D/g, '');
      formattedEmpId = `SMEI-EMPLOYEE-${digits.padStart(3, '0')}`;
    }

    if (users.some(u => u.employeeId && u.employeeId.toLowerCase() === formattedEmpId.toLowerCase())) {
      newErrors.employeeId = `Employee ID ${formattedEmpId} already exists.`;
    }

    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      return;
    }

    try {
      await api.createUser({
        employeeId: formattedEmpId,
        username: formData.username,
        password: formData.password,
        fullName: formData.fullName,
        email: formData.email,
        role: formData.role as UserRole,
        department: formData.department
      });
      setSuccess(`User ${formData.username} created successfully with ID ${formattedEmpId}!`);
      setIsCreateOpen(false);
      setFormData({
        username: "",
        password: "",
        fullName: "",
        email: "",
        employeeId: "",
        role: "Purchasing Staff",
        department: "Purchasing"
      });
      fetchUsers();
    } catch (err: any) {
      setError(err.message || "Failed to create user");
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setError("");
    setSuccess("");
    setFormErrors({});

    const newErrors: Record<string, string> = {};
    if (!editFormData.fullName) newErrors.fullName = "Full Name is required.";
    if (!editFormData.email) newErrors.email = "Email Address is required.";

    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      return;
    }

    try {
      await api.updateUser(selectedUser.id, {
        fullName: editFormData.fullName,
        email: editFormData.email,
        role: editFormData.role as UserRole,
        department: editFormData.department,
        status: editFormData.status
      });
      setSuccess(`User profile for ${selectedUser.username} updated successfully!`);
      setIsEditOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || "Failed to update user");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setError("");
    setSuccess("");

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    try {
      await api.resetPassword(selectedUser.id, newPassword);
      setSuccess(`Password reset successfully for ${selectedUser.username}!`);
      setIsResetOpen(false);
      setNewPassword("");
      setSelectedUser(null);
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    }
  };

  const toggleUserStatus = async (user: User, currentStatus: string) => {
    setError("");
    setSuccess("");
    const newStatus = currentStatus === "Active" ? "Disabled" : "Active";
    
    try {
      await api.updateUser(user.id, { status: newStatus });
      setSuccess(`User ${user.username} is now ${newStatus}.`);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || "Failed to change user status");
    }
  };

  const handleUnlockUser = async (user: User) => {
    setError("");
    setSuccess("");
    try {
      await api.updateUser(user.id, { status: "Active" });
      setSuccess(`User ${user.username} unlocked successfully!`);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || "Failed to unlock user");
    }
  };

  const openCreateModal = async () => {
    try {
      const res = await api.getNextEmployeeId();
      setFormData(prev => ({ ...prev, employeeId: res.nextEmployeeId }));
    } catch (err) {
      let maxId = 0;
      users.forEach(u => {
        if (u.employeeId) {
          const match = u.employeeId.match(/\d+/);
          if (match) {
            const idNum = parseInt(match[0], 10);
            if (!isNaN(idNum) && idNum > maxId) maxId = idNum;
          }
        }
      });
      setFormData(prev => ({ ...prev, employeeId: `SMEI-EMPLOYEE-${String(maxId + 1).padStart(3, '0')}` }));
    }
    setIsCreateOpen(true);
  };

  const handleDeleteUser = async (user: User) => {
    if (!window.confirm(`Are you sure you want to permanently delete user account "${user.username}" (${user.employeeId || user.id})?\n\nNote: The employee ID "${user.employeeId}" will NOT be reused for future accounts.`)) {
      return;
    }
    setError("");
    setSuccess("");
    try {
      await api.deleteUser(user.id);
      setSuccess(`Account ${user.username} deleted successfully.`);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || "Failed to delete user account.");
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    // Get status from list (with safety default)
    const statusVal = (user as any).status || "Active";
    setEditFormData({
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      department: user.department,
      status: statusVal
    });
    setIsEditOpen(true);
  };

  const openResetModal = (user: User) => {
    setSelectedUser(user);
    setNewPassword("");
    setIsResetOpen(true);
  };

  const handleGenerateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const data = await api.generateInvitation({
        role: linkConfig.role,
        department: linkConfig.department,
        expiresIn: linkConfig.expiresIn,
        isOneTime: linkConfig.isOneTime
      });
      const origin = getAppUrl();
      const link = `${origin}/register?token=${data.token}`;
      setGeneratedLink(link);
      setSuccess("Employee secure registration link generated successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to generate invitation link.");
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    setSuccess("Employee access link copied successfully.");
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      u.department.toLowerCase().includes(q)
    );
  });

  return (
    <div id="user-management-module" className="space-y-6">
      {/* Module Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold font-display text-gray-800 uppercase tracking-wide">
            User Accounts Registry
          </h2>
          <p className="text-sm text-gray-500">
            Administrate portal roles, unlock accounts, and reset employee credentials.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchUsers}
            className="p-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all"
            title="Refresh Registry"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsGenerateLinkOpen(true)}
            className="p-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all flex items-center gap-2 shadow-sm"
          >
            <Link className="w-5 h-5 text-gray-500" />
            <span className="hidden sm:inline">Generate Link</span>
          </button>
          <button
            onClick={openCreateModal}
            className="bg-gradient-to-r from-smei-darkred to-smei-crimson text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-red-900/10 hover:shadow-red-900/20 active:scale-[0.98] transition-all flex items-center gap-2"
          >
            <UserPlus className="w-5 h-5" />
            <span>Create Account</span>
          </button>
        </div>
      </div>

      {/* Alert Messaging */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl flex items-center gap-2 animate-shake">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Search Header */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-sans focus:outline-none focus:ring-2 focus:ring-smei-crimson focus:border-transparent focus:bg-white transition-all"
          />
        </div>
        <div className="text-xs text-gray-400 font-mono">
          Total Registered Users: {filteredUsers.length}
        </div>
      </div>

      {/* Users Data Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <span className="w-10 h-10 border-4 border-smei-crimson/30 border-t-smei-crimson rounded-full animate-spin" />
          <p className="text-xs text-gray-500 font-mono">Fetching employee profiles...</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs font-bold uppercase tracking-wider">
                  <th className="p-4">Employee ID</th>
                  <th className="p-4">Full Name</th>
                  <th className="p-4">Username</th>
                  <th className="p-4">Email Address</th>
                  <th className="p-4">Department</th>
                  <th className="p-4">System Role</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-gray-400">
                      No accounts matched your search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const statusVal = (user as any).status || "Active";
                    return (
                      <tr key={user.id} className="hover:bg-gray-50/50 transition-all">
                        <td className="p-4 font-mono font-bold text-gray-500">
                          {user.employeeId || "SMEI-EMPLOYEE-001"}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={user.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100"}
                              alt={user.fullName}
                              className="w-8 h-8 rounded-full object-cover border border-gray-200"
                              referrerPolicy="no-referrer"
                            />
                            <span className="font-semibold text-gray-800">{user.fullName}</span>
                          </div>
                        </td>
                        <td className="p-4 text-gray-600 font-mono">{user.username}</td>
                        <td className="p-4 text-gray-600">{user.email}</td>
                        <td className="p-4 text-gray-600">{user.department}</td>
                        <td className="p-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-smei-crimson border border-red-100 font-display">
                            {user.role}
                          </span>
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                              statusVal === "Active"
                                ? "bg-green-50 text-green-700 border border-green-100"
                                : statusVal === "Pending"
                                ? "bg-blue-50 text-blue-700 border border-blue-100"
                                : statusVal === "Locked"
                                ? "bg-yellow-50 text-yellow-700 border border-yellow-100"
                                : "bg-gray-50 text-gray-700 border border-gray-100"
                            }`}
                          >
                            {statusVal}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {statusVal === "Pending" ? (
                              <>
                                <button
                                  onClick={async () => {
                                    try {
                                      await api.updateUser(user.id, { status: "Active" });
                                      setSuccess();
                                      fetchUsers();
                                    } catch(err: any) { setError(err.message); }
                                  }}
                                  className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded hover:bg-green-200 uppercase"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      await api.updateUser(user.id, { status: "Disabled" });
                                      setSuccess();
                                      fetchUsers();
                                    } catch(err: any) { setError(err.message); }
                                  }}
                                  className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded hover:bg-red-200 uppercase"
                                >
                                  Reject
                                </button>
                              </>
                            ) : (
                              <>
                                {statusVal === "Locked" && (
                                  <button
                                    onClick={() => handleUnlockUser(user)}
                                    className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-all"
                                    title="Unlock Account"
                                  >
                                    <Unlock className="w-4 h-4" />
                                  </button>
                                )}
                                {isAdmin && (
                                  <button
                                    onClick={() => handleInitiateReveal(user)}
                                    className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                                    title="Reveal Password (Administrator Only)"
                                  >
                                    <Eye className="w-4 h-4 text-slate-600 hover:text-slate-900" />
                                  </button>
                                )}
                                <button
                                  onClick={() => openEditModal(user)}
                                  className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                                  title="Edit Profile"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => openResetModal(user)}
                                  className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                                  title="Reset Password"
                                >
                                  <Key className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => toggleUserStatus(user, statusVal)}
                                  className={`p-1.5 rounded-lg transition-all ${
                                    statusVal === "Active"
                                      ? "text-orange-600 hover:bg-orange-50"
                                      : "text-green-600 hover:bg-green-50"
                                  }`}
                                  title={statusVal === "Active" ? "Disable Account" : "Activate Account"}
                                >
                                  {statusVal === "Active" ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(user)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                  title="Delete Account Permanently"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div></td></tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-2xl w-full max-w-lg overflow-hidden"
          >
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-smei-crimson" />
                <span>Register New Employee Account</span>
              </h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.employeeId}
                    onChange={(e) => {
                      setFormData({ ...formData, employeeId: e.target.value });
                      if (formErrors.employeeId) setFormErrors(prev => ({ ...prev, employeeId: "" }));
                    }}
                    className={`w-full px-3.5 py-2 border ${formErrors.employeeId ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'} rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-smei-crimson`}
                  />
                  {formErrors.employeeId && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-red-600">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{formErrors.employeeId}</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => {
                      setFormData({ ...formData, username: e.target.value });
                      if (formErrors.username) setFormErrors(prev => ({ ...prev, username: "" }));
                    }}
                    placeholder="e.g. j.smith"
                    className={`w-full px-3.5 py-2 border ${formErrors.username ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'} rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-smei-crimson`}
                  />
                  {formErrors.username && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-red-600">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{formErrors.username}</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                    Initial Password
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => {
                      setFormData({ ...formData, password: e.target.value });
                      if (formErrors.password) setFormErrors(prev => ({ ...prev, password: "" }));
                    }}
                    placeholder="••••••••"
                    className={`w-full px-3.5 py-2 border ${formErrors.password ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'} rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-smei-crimson`}
                  />
                  {formErrors.password && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-red-600">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{formErrors.password}</span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => {
                    setFormData({ ...formData, fullName: e.target.value });
                    if (formErrors.fullName) setFormErrors(prev => ({ ...prev, fullName: "" }));
                  }}
                  placeholder="e.g. Jane Smith"
                  className={`w-full px-3.5 py-2 border ${formErrors.fullName ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'} rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-smei-crimson`}
                />
                {formErrors.fullName && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{formErrors.fullName}</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (formErrors.email) setFormErrors(prev => ({ ...prev, email: "" }));
                  }}
                  placeholder="e.g. j.smith@southcoastmetal.com"
                  className={`w-full px-3.5 py-2 border ${formErrors.email ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'} rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-smei-crimson`}
                />
                {formErrors.email && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{formErrors.email}</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                    System Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-smei-crimson"
                  >
                    {getDisplayRoles().map((rName) => (
                      <option key={rName} value={rName}>{rName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                    Assigned Department
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-smei-crimson"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-smei-crimson text-white font-semibold rounded-xl text-sm hover:bg-red-700"
                >
                  Register Account
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {isEditOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-2xl w-full max-w-lg overflow-hidden"
          >
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-smei-crimson" />
                <span>Modify Account Details ({selectedUser.username})</span>
              </h3>
              <button onClick={() => { setIsEditOpen(false); setSelectedUser(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.fullName}
                  onChange={(e) => {
                    setEditFormData({ ...editFormData, fullName: e.target.value });
                    if (formErrors.fullName) setFormErrors(prev => ({ ...prev, fullName: "" }));
                  }}
                  className={`w-full px-3.5 py-2 border ${formErrors.fullName ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'} rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-smei-crimson`}
                />
                {formErrors.fullName && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{formErrors.fullName}</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={editFormData.email}
                  onChange={(e) => {
                    setEditFormData({ ...editFormData, email: e.target.value });
                    if (formErrors.email) setFormErrors(prev => ({ ...prev, email: "" }));
                  }}
                  className={`w-full px-3.5 py-2 border ${formErrors.email ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'} rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-smei-crimson`}
                />
                {formErrors.email && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{formErrors.email}</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                    System Role
                  </label>
                  <select
                    value={editFormData.role}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-smei-crimson"
                  >
                    {getDisplayRoles().map((rName) => (
                      <option key={rName} value={rName}>{rName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                    Assigned Department
                  </label>
                  <select
                    value={editFormData.department}
                    onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-smei-crimson"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Account Access Status
                </label>
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as any })}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-smei-crimson"
                >
                  <option value="Active">Active</option>
                  <option value="Disabled">Disabled</option>
                  <option value="Locked">Locked (Failed Attempts)</option>
                </select>
              </div>
              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setIsEditOpen(false); setSelectedUser(null); }}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-smei-crimson text-white font-semibold rounded-xl text-sm hover:bg-red-700"
                >
                  Save Modifications
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {isResetOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2">
                <Key className="w-5 h-5 text-smei-crimson" />
                <span>Reset Credentials ({selectedUser.username})</span>
              </h3>
              <button onClick={() => { setIsResetOpen(false); setSelectedUser(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Enter New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-smei-crimson"
                />
              </div>
              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setIsResetOpen(false); setSelectedUser(null); }}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-smei-crimson text-white font-semibold rounded-xl text-sm hover:bg-red-700"
                >
                  Apply Password Reset
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* GENERATE ACCESS LINK MODAL */}
      {isGenerateLinkOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-2xl w-full max-w-[700px] max-h-[80vh] flex flex-col overflow-hidden relative"
          >
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0 sticky top-0 z-10">
              <h3 className="text-base font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2">
                <Link className="w-5 h-5 text-smei-crimson" />
                <span>Generate Employee Access Link</span>
              </h3>
              <button onClick={() => { setIsGenerateLinkOpen(false); setGeneratedLink(""); setShowQR(false); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              <form id="generate-link-form" onSubmit={handleGenerateLink} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                      Assigned Role
                    </label>
                    <select
                      value={linkConfig.role}
                      onChange={(e) => setLinkConfig({ ...linkConfig, role: e.target.value })}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-smei-crimson appearance-none cursor-pointer"
                    >
                      {getDisplayRoles().map((rName) => (
                        <option key={rName} value={rName}>{rName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                      Department Assignment
                    </label>
                    <select
                      value={linkConfig.department}
                      onChange={(e) => setLinkConfig({ ...linkConfig, department: e.target.value })}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-smei-crimson appearance-none cursor-pointer"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                      Expiration Time
                    </label>
                    <select
                      value={linkConfig.expiresIn}
                      onChange={(e) => setLinkConfig({ ...linkConfig, expiresIn: e.target.value })}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-smei-crimson appearance-none cursor-pointer"
                    >
                      <option value="24h">24 Hours</option>
                      <option value="7d">7 Days</option>
                      <option value="never">Never Expire</option>
                    </select>
                  </div>
                  <div className="flex items-center pt-5 sm:pt-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={linkConfig.isOneTime}
                        onChange={(e) => setLinkConfig({ ...linkConfig, isOneTime: e.target.checked })}
                        className="rounded text-smei-crimson focus:ring-smei-crimson w-4 h-4 cursor-pointer"
                      />
                      <span className="text-sm font-semibold text-gray-700">One-Time Use Link</span>
                    </label>
                  </div>
                </div>

              {!generatedLink && (
                <div className="pt-4 flex justify-end gap-2">
                  {/* Keep empty as it's moved to footer */}
                </div>
              )}
              {generatedLink && (
                <div className="pt-4 space-y-4 border-t border-gray-100 animate-fade-in">
                  <div>
                    <label className="block text-xs font-bold text-smei-crimson uppercase tracking-wider mb-1.5">
                      Invitation URL Ready
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={generatedLink}
                        className="flex-1 px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 font-mono focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="px-4 py-2 bg-gray-800 text-white font-semibold rounded-xl text-sm hover:bg-gray-900 flex items-center gap-2 transition-all"
                      >
                        <Copy className="w-4 h-4" />
                        <span>Copy</span>
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowQR(!showQR)}
                      className="flex-1 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2 transition-all"
                    >
                      <QrCode className="w-4 h-4 text-gray-500" />
                      <span>{showQR ? "Hide QR Code" : "Show QR Code"}</span>
                    </button>
                    <a
                      href={`mailto:?subject=SMEI Portal Access Invitation&body=You have been invited to join the SMEI Purchase Order Management System.%0D%0A%0D%0ARegister here: ${generatedLink}`}
                      className="flex-1 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2 transition-all"
                    >
                      <Mail className="w-4 h-4 text-gray-500" />
                      <span>Email Invite</span>
                    </a>
                  </div>
                  
                  {showQR && (
                    <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-xl border border-gray-200 animate-fade-in mt-4">
                      {/* Placeholder for actual QR code rendering, for now we simulate it */}
                      <div className="w-48 h-48 bg-white border-2 border-gray-300 rounded p-2 flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 opacity-10 flex flex-wrap" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23000000\' fill-opacity=\'1\' fill-rule=\'evenodd\'%3E%3Ccircle cx=\'3\' cy=\'3\' r=\'3\'/%3E%3Ccircle cx=\'13\' cy=\'13\' r=\'3\'/%3E%3C/g%3E%3C/svg%3E")'}}></div>
                        <QrCode className="w-24 h-24 text-gray-800" />
                      </div>
                      <span className="text-xs text-gray-500 mt-3 font-mono font-bold tracking-widest uppercase">Scan to Register</span>
                    </div>
                  )}
                </div>
              )}
              </form>
            </div>

            {/* Sticky Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 shrink-0 sticky bottom-0 z-10 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setIsGenerateLinkOpen(false); setGeneratedLink(""); setShowQR(false); }}
                className="px-4 py-2 border border-gray-200 bg-white rounded-xl text-sm text-gray-600 hover:bg-gray-100 font-semibold"
              >
                Close
              </button>
              {!generatedLink && (
                <button
                  type="submit"
                  form="generate-link-form"
                  className="px-4 py-2 bg-smei-crimson text-white font-semibold rounded-xl text-sm hover:bg-red-700 flex items-center gap-2"
                >
                  <Link className="w-4 h-4" />
                  <span>Generate Link</span>
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* SECURITY PIN VERIFICATION MODAL FOR PASSWORD REVEAL */}
      {isPinModalOpen && (
        <SecurityPINModal
          moduleName="User Accounts"
          currentUser={activeUser || undefined}
          onSuccess={() => {
            setIsPinModalOpen(false);
            if (userForReveal) {
              executeRevealPassword(userForReveal);
            }
          }}
          onClose={() => {
            setIsPinModalOpen(false);
            setUserForReveal(null);
          }}
        />
      )}

      {/* PASSWORD REVEAL VISIBILITY MODAL */}
      {isPasswordModalOpen && revealedPasswordData && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-md bg-slate-900/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-50 dark:bg-red-950/40 rounded-xl text-smei-crimson dark:text-red-500">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-white">
                    Password Visibility
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Administrator Credentials Access
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsPasswordModalOpen(false);
                  setRevealedPasswordData(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl space-y-2 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase">User Account</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  {revealedPasswordData.employeeId || "N/A"}
                </span>
              </div>
              <div className="text-sm font-bold text-slate-800 dark:text-white">
                {revealedPasswordData.fullName}
              </div>
              <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                @{revealedPasswordData.username}
              </div>
            </div>

            {revealedPasswordData.isFirebase ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-amber-800 dark:text-amber-300 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wide">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Password Unavailable</span>
                </div>
                <p className="text-xs leading-relaxed">
                  This user account is authenticated via Firebase Authentication. Passwords managed through Firebase Auth are non-retrievable and encrypted server-side.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Account Password
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={isMasked ? "password" : "text"}
                      readOnly
                      value={revealedPasswordData.password || "Password unavailable"}
                      className="w-full px-4 py-3 font-mono font-bold text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setIsMasked(!isMasked)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                      title={isMasked ? "Show Password" : "Hide Password"}
                    >
                      {isMasked ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                  {revealedPasswordData.password && revealedPasswordData.password !== "Password unavailable" && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(revealedPasswordData.password || "");
                        setIsCopied(true);
                        setTimeout(() => setIsCopied(false), 2000);
                      }}
                      className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-center shrink-0"
                      title="Copy Password"
                    >
                      {isCopied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                <span>Audited Event Logged</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPasswordModalOpen(false);
                  setRevealedPasswordData(null);
                }}
                className="px-4 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
