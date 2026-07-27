/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Shield, Check, Save, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

interface RoleRecord {
  id: string;
  name: string;
  permissions: string[];
}

export default function RoleManagement() {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Role Creation states
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [isCreatingRole, setIsCreatingRole] = useState(false);

  // Dynamic Module Security PIN protection states
  interface PinProtectionRule {
    id: string;
    moduleName: string;
    actionName: string;
    pinCode: string;
    isEnabled: boolean;
  }

  const [modulePins, setModulePins] = useState<PinProtectionRule[]>([]);
  const [showAddPinRule, setShowAddPinRule] = useState(false);
  const [newPinModuleName, setNewPinModuleName] = useState("Purchase Order");
  const [newPinCode, setNewPinCode] = useState("");

  const [isGlobalPinEnabled, setIsGlobalPinEnabled] = useState<boolean>(() => {
    const savedSetting = localStorage.getItem("smei_security_config");
    if (savedSetting !== null) {
      try {
        return JSON.parse(savedSetting).enabled;
      } catch (e) {
        return false;
      }
    }
    return false;
  });

  const handleToggleGlobalPin = () => {
    const newValue = !isGlobalPinEnabled;
    setIsGlobalPinEnabled(newValue);
    localStorage.setItem("smei_security_config", JSON.stringify({ enabled: newValue }));
  };

  const [isPortalPinEnabled, setIsPortalPinEnabled] = useState<boolean>(() => {
    const savedSetting = localStorage.getItem("smei_portal_security_config");
    if (savedSetting !== null) {
      try {
        return JSON.parse(savedSetting).enabled;
      } catch (e) {
        return false;
      }
    }
    return false;
  });

  const [poPortalPinCode, setPoPortalPinCode] = useState<string>(() => {
    const savedSetting = localStorage.getItem("smei_portal_security_config");
    if (savedSetting !== null) {
      try {
        const parsed = JSON.parse(savedSetting);
        return parsed.poPinCode || parsed.pinCode || "1111";
      } catch (e) {
        return "1111";
      }
    }
    return "1111";
  });

  const [tsdPortalPinCode, setTsdPortalPinCode] = useState<string>(() => {
    const savedSetting = localStorage.getItem("smei_portal_security_config");
    if (savedSetting !== null) {
      try {
        const parsed = JSON.parse(savedSetting);
        return parsed.tsdPinCode || parsed.pinCode || "1111";
      } catch (e) {
        return "1111";
      }
    }
    return "1111";
  });

  // Modal PIN Editor state to prevent uncontrolled instant-edit
  const [editingPinType, setEditingPinType] = useState<"po" | "tsd" | "module" | null>(null);
  const [editingModuleRuleId, setEditingModuleRuleId] = useState<string | null>(null);
  const [tempNewPin, setTempNewPin] = useState("");
  const [tempConfirmPin, setTempConfirmPin] = useState("");
  const [pinEditError, setPinEditError] = useState("");

  const handleTogglePortalPin = () => {
    const newValue = !isPortalPinEnabled;
    setIsPortalPinEnabled(newValue);
    localStorage.setItem("smei_portal_security_config", JSON.stringify({
      enabled: newValue,
      poPinCode: poPortalPinCode,
      tsdPinCode: tsdPortalPinCode
    }));
  };

  const closePinEditor = () => {
    setEditingPinType(null);
    setEditingModuleRuleId(null);
    setTempNewPin("");
    setTempConfirmPin("");
    setPinEditError("");
  };

  const saveEditedPin = () => {
    if (!tempNewPin) {
      setPinEditError("PIN code cannot be empty.");
      return;
    }
    if (tempNewPin.length < 4) {
      setPinEditError("PIN code must be at least 4 digits.");
      return;
    }
    if (tempNewPin !== tempConfirmPin) {
      setPinEditError("New PIN and Confirm New PIN do not match.");
      return;
    }

    if (editingPinType === "po") {
      setPoPortalPinCode(tempNewPin);
      localStorage.setItem("smei_portal_security_config", JSON.stringify({
        enabled: isPortalPinEnabled,
        poPinCode: tempNewPin,
        tsdPinCode: tsdPortalPinCode
      }));
      setSuccess("PO Portal PIN code updated successfully!");
    } else if (editingPinType === "tsd") {
      setTsdPortalPinCode(tempNewPin);
      localStorage.setItem("smei_portal_security_config", JSON.stringify({
        enabled: isPortalPinEnabled,
        poPinCode: poPortalPinCode,
        tsdPinCode: tempNewPin
      }));
      setSuccess("TSD Portal PIN code updated successfully!");
    } else if (editingPinType === "module" && editingModuleRuleId) {
      const updated = modulePins.map((rule) => {
        if (rule.id === editingModuleRuleId) {
          return { ...rule, pinCode: tempNewPin };
        }
        return rule;
      });
      saveModulePins(updated);
      setSuccess("Module security PIN code updated successfully!");
    }

    setTimeout(() => setSuccess(""), 4000);
    closePinEditor();
  };

  // Load and initialize dynamic security PIN rules
  useEffect(() => {
    const defaultRules = [
      { id: "po_status_change", moduleName: "Purchase Order", actionName: "Access Purchase Orders", pinCode: "1234", isEnabled: true },
      { id: "rfs_approval", moduleName: "Request For Supply", actionName: "Access Request For Supply", pinCode: "5678", isEnabled: true },
      { id: "rfs_approval_gate", moduleName: "Request For Supply (RFS) Approval", actionName: "Access Request For Supply (RFS) Approval", pinCode: "7777", isEnabled: true },
      { id: "pis_access", moduleName: "Payment Instruction Slip", actionName: "Access Payment Instruction Slip", pinCode: "4321", isEnabled: true },
      { id: "canvass_access", moduleName: "Canvass Sheet", actionName: "Access Canvass Sheets", pinCode: "9999", isEnabled: true }
    ];

    const saved = localStorage.getItem("smei_module_pins");
    if (saved) {
      try {
        let loaded = JSON.parse(saved);
        // Ensure "Request For Supply (RFS) Approval" rule is present
        const hasRfsApproval = loaded.some((r: any) => r.moduleName === "Request For Supply (RFS) Approval" || r.id === "rfs_approval_gate");
        if (!hasRfsApproval) {
          loaded.push({ id: "rfs_approval_gate", moduleName: "Request For Supply (RFS) Approval", actionName: "Access Request For Supply (RFS) Approval", pinCode: "7777", isEnabled: true });
          localStorage.setItem("smei_module_pins", JSON.stringify(loaded));
        }
        setModulePins(loaded);
      } catch (e) {
        console.error("Failed to parse saved module pins", e);
        setModulePins(defaultRules);
        localStorage.setItem("smei_module_pins", JSON.stringify(defaultRules));
      }
    } else {
      setModulePins(defaultRules);
      localStorage.setItem("smei_module_pins", JSON.stringify(defaultRules));
    }
  }, []);

  const saveModulePins = (updatedRules: PinProtectionRule[]) => {
    setModulePins(updatedRules);
    localStorage.setItem("smei_module_pins", JSON.stringify(updatedRules));
  };

  const handleAddPinRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPinCode.trim()) {
      setError("Please enter a security PIN code.");
      return;
    }

    const newRule: PinProtectionRule = {
      id: "rule_" + Date.now(),
      moduleName: newPinModuleName,
      actionName: `Access ${newPinModuleName}`,
      pinCode: newPinCode.trim(),
      isEnabled: true,
    };

    const updated = [...modulePins, newRule];
    saveModulePins(updated);
    setNewPinCode("");
    setShowAddPinRule(false);
    setSuccess(`Security PIN rule for ${newPinModuleName} added successfully!`);
    setTimeout(() => setSuccess(""), 4000);
  };

  const handleDeletePinRule = (id: string) => {
    if (confirm("Are you sure you want to delete this PIN protection rule?")) {
      const updated = modulePins.filter((rule) => rule.id !== id);
      saveModulePins(updated);
      setSuccess("Security PIN rule deleted successfully.");
      setTimeout(() => setSuccess(""), 4000);
    }
  };

  const handleTogglePinRule = (id: string) => {
    const updated = modulePins.map((rule) => {
      if (rule.id === id) {
        return { ...rule, isEnabled: !rule.isEnabled };
      }
      return rule;
    });
    saveModulePins(updated);
  };

  const handleUpdatePinCode = (id: string, newCode: string) => {
    const updated = modulePins.map((rule) => {
      if (rule.id === id) {
        return { ...rule, pinCode: newCode };
      }
      return rule;
    });
    saveModulePins(updated);
  };

  const AVAILABLE_PERMISSIONS = [
    { key: "view_dashboard", label: "View Dashboard", desc: "Access the role-customized KPI summary counters" },
    { key: "view_all_pos", label: "View All POs", desc: "View all purchase orders in the entire system" },
    { key: "view_dept_pos", label: "View Dept POs Only", desc: "Restrict PO view list strictly to user's department" },
    { key: "create_po", label: "Create PO", desc: "Draft new purchase orders with suppliers" },
    { key: "edit_own_po", label: "Edit Own PO", desc: "Modify only POs created by the user" },
    { key: "submit_po", label: "Submit PO", desc: "Submit Drafts into the review workflow" },
    { key: "review_po", label: "Review PO", desc: "Sign off on submitted items as Checker/Dept Head" },
    { key: "verify_po", label: "Verify VAT/EWT", desc: "Validate computations, tax rates, and ledger codes" },
    { key: "final_approve_po", label: "Final Approve PO", desc: "Issue legal digital authorization & final signature" },
    { key: "view_suppliers", label: "View Suppliers", desc: "Browse corporate supplier directories" },
    { key: "manage_suppliers", label: "Manage Suppliers", desc: "Create, edit or remove partner supplier records" },
    { key: "view_audit_logs", label: "View Audit Logs", desc: "Query immutable administrative log grids" },
    { key: "import_excel", label: "Import Excel", desc: "Upload batch contracts from spreadsheets" },
    { key: "export_excel", label: "Export Excel/PDF", desc: "Download validated compliance files" },
    { key: "manage_users", label: "Manage Accounts", desc: "Full administrative CRUD on employee users" },
    { key: "manage_roles", label: "Manage Roles", desc: "Modify fine-grained RBAC permission matrix" },
    { key: "approve_rfs", label: "Approve RFS", desc: "Access the RFS Approval queue to authorize Supply Delivery Status & Due Date" }
  ];

  const fetchRoles = async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await api.getRoles();
      setRoles(data);
    } catch (err: any) {
      setError(err.message || "Failed to load roles matrix");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    setError("");
    setSuccess("");
    setIsCreatingRole(true);
    try {
      // @ts-ignore
      await api.createRole(newRoleName.trim(), []);
      setSuccess(`New role "${newRoleName.trim()}" created successfully!`);
      setNewRoleName("");
      setIsAddingRole(false);
      fetchRoles();
    } catch (err: any) {
      setError(err.message || "Failed to create new role");
    } finally {
      setIsCreatingRole(false);
    }
  };

  const handlePermissionToggle = (roleId: string, permissionKey: string) => {
    setRoles((prev) =>
      prev.map((r) => {
        if (r.id !== roleId) return r;
        
        // Prevent editing Admin permissions to avoid lockout
        if (r.name === "Administrator") return r;

        const exists = r.permissions.includes(permissionKey);
        const newPermissions = exists
          ? r.permissions.filter((p) => p !== permissionKey)
          : [...r.permissions, permissionKey];
        
        return { ...r, permissions: newPermissions };
      })
    );
  };

  const saveRolePermissions = async (role: RoleRecord) => {
    setError("");
    setSuccess("");
    setIsSaving(role.id);

    try {
      await api.updateRolePermissions(role.id, role.permissions);
      setSuccess(`Permissions updated successfully for ${role.name}!`);
      fetchRoles();
    } catch (err: any) {
      setError(err.message || `Failed to update permissions for ${role.name}`);
    } finally {
      setIsSaving(null);
    }
  };

  return (
    <div id="role-management-module" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold font-display text-gray-800 uppercase tracking-wide">
            SECURITY
          </h2>
          <p className="text-sm text-gray-500">
            Configure fine-grained system permissions and security profiles across corporate levels.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsAddingRole(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-800 hover:to-red-700 text-white rounded-xl shadow-md font-semibold text-sm transition-all active:scale-[0.98] flex items-center gap-2"
          >
            <span>+ Create New Role</span>
          </button>
          <button
            onClick={fetchRoles}
            className="p-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all flex items-center gap-2 text-sm font-semibold"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh Matrix</span>
          </button>
        </div>
      </div>

      {/* Create Role Modal */}
      {isAddingRole && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-md w-full overflow-hidden animate-scaleIn">
            <div className="p-6 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 font-display text-base tracking-wide uppercase">
                Create New Role
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddingRole(false);
                  setNewRoleName("");
                }}
                className="text-gray-400 hover:text-gray-600 font-bold transition-all text-sm px-2 py-1"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateRole}>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Role Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="e.g. Impex/Purchasing Staff"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 text-sm font-semibold"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingRole(false);
                    setNewRoleName("");
                  }}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-100 transition-all font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingRole}
                  className="px-4 py-2 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-800 hover:to-red-700 text-white rounded-lg shadow font-semibold flex items-center gap-2"
                >
                  {isCreatingRole ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : null}
                  <span>Save Role</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Messaging */}
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

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <span className="w-10 h-10 border-4 border-smei-crimson/30 border-t-smei-crimson rounded-full animate-spin" />
          <p className="text-xs text-gray-500 font-mono">Loading access lists...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {roles.map((role) => (
            <div key={role.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="bg-gray-50/70 p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-2.5">
                  <Shield className="w-5 h-5 text-smei-crimson" />
                  <span className="font-bold text-gray-800 font-display text-base tracking-wide uppercase">
                    {role.name}
                  </span>
                  {role.name === "Administrator" && (
                    <span className="text-[10px] font-bold uppercase bg-red-100 text-smei-crimson px-2 py-0.5 rounded-full">
                      Immutable Full Access
                    </span>
                  )}
                </div>
                {role.name !== "Administrator" && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => saveRolePermissions(role)}
                      disabled={isSaving === role.id}
                      className="bg-gradient-to-r from-smei-darkred to-smei-crimson text-white font-semibold py-2 px-3.5 rounded-xl shadow-lg shadow-red-900/10 hover:shadow-red-900/20 active:scale-[0.98] transition-all flex items-center gap-2 text-xs"
                    >
                      {isSaving === role.id ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      <span>Apply Privilege Updates</span>
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm("Are you sure you want to delete this role?")) {
                          try {
                            await api.deleteRole(role.id);
                            setRoles(roles.filter(r => r.id !== role.id));
                            setSuccess("Role deleted successfully");
                            setTimeout(() => setSuccess(""), 3000);
                          } catch (err: any) {
                            setError(err.message || "Failed to delete role");
                            setTimeout(() => setError(""), 5000);
                          }
                        }
                      }}
                      className="bg-red-50 text-red-600 hover:bg-red-100 font-semibold py-2 px-3.5 rounded-xl transition-all flex items-center gap-2 text-xs"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              {/* Permissions List Grid */}
              <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {AVAILABLE_PERMISSIONS.map((perm) => {
                  const hasPermission = role.permissions.includes(perm.key);
                  const isAdminRole = role.name === "Administrator";
                  
                  return (
                    <div
                      key={perm.key}
                      onClick={() => !isAdminRole && handlePermissionToggle(role.id, perm.key)}
                      className={`p-3.5 rounded-xl border transition-all text-left flex gap-3 ${
                        isAdminRole
                          ? "border-red-100 bg-red-50/20 cursor-default"
                          : hasPermission
                          ? "border-smei-crimson bg-red-50/10 hover:bg-red-50/20 cursor-pointer"
                          : "border-gray-200 hover:border-gray-300 cursor-pointer"
                      }`}
                    >
                      <div className="mt-0.5">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                            isAdminRole || hasPermission
                              ? "bg-smei-crimson border-smei-crimson text-white"
                              : "border-gray-300 bg-white"
                          }`}
                        >
                          {(isAdminRole || hasPermission) && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-gray-800">{perm.label}</p>
                        <p className="text-[10px] text-gray-400 leading-normal">{perm.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Enterprise Control Portal Security PIN Protection Container */}
      <div id="enterprise-portal-pin-section" className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mt-8">
        <div className="bg-gray-50/70 p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-bold text-gray-800 font-display text-base tracking-wide uppercase flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
              Enterprise Control Portal Security PIN Protection
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Enforce a secure, independent PIN gate challenge when users select portals (POMS / TSD) from the main selector.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold uppercase ${isPortalPinEnabled ? "text-amber-600 dark:text-amber-400" : "text-gray-400 dark:text-gray-500"}`}>
              {isPortalPinEnabled ? "Enforced" : "Disabled"}
            </span>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPortalPinEnabled}
                onChange={handleTogglePortalPin}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 dark:bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Purchase Order PIN Config */}
            <div className="p-4 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Purchase Order (PO) PIN</p>
                <p className="text-sm font-mono font-bold text-gray-800 dark:text-gray-200 mt-1">•••• (Configured)</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingPinType("po");
                  setTempNewPin("");
                  setTempConfirmPin("");
                  setPinEditError("");
                }}
                className="px-3.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                Change PIN
              </button>
            </div>

            {/* TSD Compliance PIN Config */}
            <div className="p-4 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">TSD Compliance PIN</p>
                <p className="text-sm font-mono font-bold text-gray-800 dark:text-gray-200 mt-1">•••• (Configured)</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingPinType("tsd");
                  setTempNewPin("");
                  setTempConfirmPin("");
                  setPinEditError("");
                }}
                className="px-3.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                Change PIN
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Module Security PIN Protection Container */}
      <div id="module-pin-protection-section" className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mt-8">
        <div className="bg-gray-50/70 p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-bold text-gray-800 font-display text-base tracking-wide uppercase flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse" />
              Module Security PIN Protection
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Set, update, or add administrative PIN authorization bounds for secure actions in different modules.
            </p>
          </div>
          <button
            onClick={() => {
              const activePortal = localStorage.getItem("smei_active_system") || "po";
              setNewPinModuleName(activePortal === "tsd" ? "Control No" : "Purchase Order");
              setShowAddPinRule(true);
            }}
            className="px-3.5 py-1.5 bg-gray-800 hover:bg-gray-900 text-white rounded-lg shadow font-semibold text-xs transition-all active:scale-[0.98]"
          >
            + Add PIN Rule
          </button>
        </div>

        {/* PIN rules list */}
        <div className="p-6">
          {/* Module Security PIN Protection Master Override Toggle */}
          <div className="p-4 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl flex items-center justify-between mb-6">
            <div>
              <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm">Module PIN Protection Master Override</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                Enable or disable administrative PIN gate protection globally for all configured system modules.
              </p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className={`text-xs font-bold uppercase ${isGlobalPinEnabled ? "text-red-600 dark:text-red-400" : "text-gray-400 dark:text-gray-500"}`}>
                {isGlobalPinEnabled ? "Enforced" : "Disabled"}
              </span>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isGlobalPinEnabled}
                  onChange={handleToggleGlobalPin}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>
          </div>

          {modulePins.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-xl">
              <p className="text-sm text-gray-400">No custom module PIN protection bounds defined.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-400 uppercase tracking-wider text-[10px] font-bold">
                    <th className="py-3 px-4">Module</th>
                    <th className="py-3 px-4">Protected Action</th>
                    <th className="py-3 px-4">Access PIN Code</th>
                    <th className="py-3 px-4">Requirement State</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {modulePins.map((rule) => (
                    <tr key={rule.id} className="hover:bg-gray-50/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 bg-red-50 text-smei-crimson text-[10px] rounded font-bold uppercase">
                          {rule.moduleName}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-gray-700">{rule.actionName}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="bg-gray-100 dark:bg-slate-800 px-2.5 py-1 rounded font-mono font-bold text-gray-800 dark:text-gray-200">
                            {rule.pinCode}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPinType("module");
                              setEditingModuleRuleId(rule.id);
                              setTempNewPin("");
                              setTempConfirmPin("");
                              setPinEditError("");
                            }}
                            className="text-[10px] font-bold uppercase tracking-wider text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 underline cursor-pointer"
                          >
                            Change
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={rule.isEnabled}
                            onChange={() => handleTogglePinRule(rule.id)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-red-600"></div>
                          <span className="ml-2 text-[10px] uppercase font-bold text-gray-500">
                            {rule.isEnabled ? "Enforced" : "Bypassed"}
                          </span>
                        </label>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {rule.id !== "po_status_change" && rule.id !== "rfs_approval" && rule.id !== "rfs_approval_gate" && rule.id !== "canvass_access" && rule.id !== "pis_access" ? (
                          <button
                            onClick={() => handleDeletePinRule(rule.id)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete Rule"
                          >
                            ✕
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-300 font-bold uppercase select-none">System Default</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Pin Protection Rule Modal */}
      {showAddPinRule && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-md w-full overflow-hidden animate-scaleIn">
            <div className="p-6 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 font-display text-base tracking-wide uppercase">
                Add Dynamic Security PIN Rule
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddPinRule(false);
                  setNewPinCode("");
                }}
                className="text-gray-400 hover:text-gray-600 font-bold transition-all text-sm px-2 py-1"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddPinRule}>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Select Target Module
                  </label>
                  <select
                    value={newPinModuleName}
                    onChange={(e) => setNewPinModuleName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 text-sm font-semibold"
                  >
                    {(localStorage.getItem("smei_active_system") || "po") === "tsd" ? (
                      <>
                        <option value="Control No">Control No.</option>
                        <option value="Unloading/Loading">Unloading/Loading</option>
                        <option value="Hazardous Waste">Hazardous Waste</option>
                        <option value="Waste Movement">Waste Movement</option>
                        <option value="Timestamp">Timestamp</option>
                        <option value="Manifest Summary">Manifest Summary</option>
                      </>
                    ) : (
                      <>
                        <option value="Purchase Order">Purchase Order (PO)</option>
                        <option value="Request For Supply">Request For Supply (RFS)</option>
                        <option value="Request For Supply (RFS) Approval">Request For Supply (RFS) Approval</option>
                        <option value="Payment Instruction Slip">Payment Instruction Slip (PIS)</option>
                        <option value="Canvass Sheet">Canvass Sheet (Canvass)</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Administrative PIN Code
                  </label>
                  <input
                    type="text"
                    required
                    value={newPinCode}
                    onChange={(e) => setNewPinCode(e.target.value)}
                    placeholder="e.g. 1122"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 text-sm font-semibold font-mono"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddPinRule(false);
                    setNewPinCode("");
                  }}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-100 transition-all font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-800 hover:to-red-700 text-white rounded-lg shadow font-semibold"
                >
                  Enable PIN Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Secure PIN Confirmation / Edit Modal Container */}
      {editingPinType && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 rounded-2xl shadow-xl max-w-sm w-full overflow-hidden animate-scaleIn">
            <div className="p-5 border-b border-neutral-100 dark:border-slate-800/80 bg-neutral-50 dark:bg-slate-950/40 flex items-center justify-between">
              <h3 className="font-bold text-neutral-800 dark:text-neutral-200 text-sm tracking-wide uppercase">
                {editingPinType === "po" && "Change PO Portal PIN"}
                {editingPinType === "tsd" && "Change TSD Portal PIN"}
                {editingPinType === "module" && "Change Module PIN"}
              </h3>
              <button
                type="button"
                onClick={closePinEditor}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 font-bold transition-all text-xs"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {pinEditError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 text-rose-600 dark:text-rose-400 border border-red-200 dark:border-red-900/30 rounded-xl text-xs font-semibold">
                  {pinEditError}
                </div>
              )}
              
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-neutral-500 dark:text-slate-400 uppercase tracking-wider">
                  New PIN Code
                </label>
                <input
                  type="password"
                  value={tempNewPin}
                  onChange={(e) => setTempNewPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="Enter numeric PIN"
                  maxLength={6}
                  className="w-full px-3.5 py-2 border border-neutral-200 dark:border-slate-800 bg-neutral-50 dark:bg-slate-950 text-neutral-800 dark:text-neutral-200 rounded-xl font-mono text-center text-lg font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-neutral-500 dark:text-slate-400 uppercase tracking-wider">
                  Confirm New PIN Code
                </label>
                <input
                  type="password"
                  value={tempConfirmPin}
                  onChange={(e) => setTempConfirmPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="Re-enter numeric PIN"
                  maxLength={6}
                  className="w-full px-3.5 py-2 border border-neutral-200 dark:border-slate-800 bg-neutral-50 dark:bg-slate-950 text-neutral-800 dark:text-neutral-200 rounded-xl font-mono text-center text-lg font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="p-5 border-t border-neutral-100 dark:border-slate-800/80 bg-neutral-50 dark:bg-slate-950/40 flex justify-end gap-3 text-xs">
              <button
                type="button"
                onClick={closePinEditor}
                className="px-4 py-2 border border-neutral-200 dark:border-slate-800 rounded-xl text-neutral-600 dark:text-slate-300 hover:bg-neutral-100 dark:hover:bg-slate-800 transition-all font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEditedPin}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl shadow-md font-bold transition-all"
              >
                Confirm Change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
