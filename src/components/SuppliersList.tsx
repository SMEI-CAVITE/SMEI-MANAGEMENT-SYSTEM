/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Supplier, User, UserRole, PurchaseOrder } from "../types";
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  X, 
  Phone, 
  MapPin, 
  Contact, 
  Tag, 
  GitMerge, 
  AlertTriangle, 
  ExternalLink, 
  Eye, 
  ToggleLeft, 
  ToggleRight,
  UserCheck,
  Building,
  ArrowRight,
  ShieldAlert
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../lib/api";

interface SuppliersListProps {
  suppliers: Supplier[];
  pos: PurchaseOrder[];
  currentUser: User;
  onAddSupplier: (supplier: Omit<Supplier, "id" | "createdAt"> & { status: "Active" | "Disabled"; created_by: string }) => void;
  onEditSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (id: string) => Promise<{ success: boolean; error?: string }>;
  onRefreshData: () => void;
}

export default function SuppliersList({
  suppliers,
  pos,
  currentUser,
  onAddSupplier,
  onEditSupplier,
  onDeleteSupplier,
  onRefreshData
}: SuppliersListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [attention, setAttention] = useState("");
  const [phone, setPhone] = useState("");
  const [fax, setFax] = useState("");
  const [address, setAddress] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<"Active" | "Disabled">("Active");

  // Interaction States
  const [selectedSupplierForPOs, setSelectedSupplierForPOs] = useState<Supplier | null>(null);
  const [supplierForMerge, setSupplierForMerge] = useState<Supplier | null>(null);
  const [targetMergeId, setTargetMergeId] = useState("");
  const [mergeIsSubmitting, setMergeIsSubmitting] = useState(false);
  const [deleteBlockError, setDeleteBlockError] = useState<{ supplier: Supplier; poCount: number } | null>(null);

  const isViewer = currentUser.role === UserRole.Viewer;
  const isAdmin = currentUser.role === UserRole.Administrator;

  // Filter suppliers
  const filteredSuppliers = suppliers.filter((s) => {
    const term = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(term) ||
      s.id.toLowerCase().includes(term) ||
      s.attention.toLowerCase().includes(term) ||
      s.category.toLowerCase().includes(term) ||
      s.address.toLowerCase().includes(term) ||
      (s.created_by || "").toLowerCase().includes(term)
    );
  });

  const getPOCount = (supplierId: string) => {
    return pos.filter(po => po.supplierId === supplierId).length;
  };

  const [initialValuesSet, setInitialValuesSet] = useState(false);

  useEffect(() => {
    if (isDrawerOpen) {
      const timer = setTimeout(() => {
        setInitialValuesSet(true);
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setInitialValuesSet(false);
      window.smeiHasUnsavedChanges = false;
    }
  }, [isDrawerOpen, editingSupplier]);

  useEffect(() => {
    if (initialValuesSet && isDrawerOpen) {
      const isDirty = 
        name !== (editingSupplier?.name || "") ||
        attention !== (editingSupplier?.attention || "") ||
        category !== (editingSupplier?.category || "") ||
        phone !== (editingSupplier?.phone || "") ||
        fax !== (editingSupplier?.fax || "") ||
        address !== (editingSupplier?.address || "") ||
        status !== (editingSupplier?.status || "Active");
      window.smeiHasUnsavedChanges = isDirty;
    }
  }, [initialValuesSet, isDrawerOpen, name, attention, category, phone, fax, address, status, editingSupplier]);

  useEffect(() => {
    return () => {
      window.smeiHasUnsavedChanges = false;
    };
  }, []);

  const handleCloseDrawer = () => {
    if (window.smeiHasUnsavedChanges) {
      const confirmDiscard = window.confirm("You have unsaved changes. Are you sure you want to discard them and close the supplier drawer?");
      if (!confirmDiscard) return;
    }
    window.smeiHasUnsavedChanges = false;
    setIsDrawerOpen(false);
  };

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setName("");
    setAttention("");
    setPhone("");
    setFax("");
    setAddress("");
    setCategory("");
    setStatus("Active");
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setName(supplier.name);
    setAttention(supplier.attention);
    setPhone(supplier.phone);
    setFax(supplier.fax);
    setAddress(supplier.address);
    setCategory(supplier.category);
    setStatus(supplier.status || "Active");
    setIsDrawerOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSupplier) {
      onEditSupplier({
        ...editingSupplier,
        name,
        attention,
        phone,
        fax,
        address,
        category,
        status
      });
    } else {
      onAddSupplier({
        name,
        attention,
        phone,
        fax,
        address,
        category,
        status,
        created_by: currentUser.fullName || currentUser.username
      });
    }
    window.smeiHasUnsavedChanges = false;
    setIsDrawerOpen(false);
  };

  // Status Toggler
  const handleToggleStatus = async (supplier: Supplier) => {
    if (isViewer) return;
    const newStatus = supplier.status === "Disabled" ? "Active" : "Disabled";
    try {
      await api.updateSupplier(supplier.id, { status: newStatus });
      onRefreshData();
    } catch (err) {
      alert("Failed to update status. Please try again.");
    }
  };

  // Delete Safeguard Trigger
  const handleDeleteAttempt = async (supplier: Supplier) => {
    const linkedCount = getPOCount(supplier.id);
    if (linkedCount > 0) {
      setDeleteBlockError({ supplier, poCount: linkedCount });
      return;
    }

    if (confirm(`Are you sure you want to permanently delete supplier "${supplier.name}"?`)) {
      const res = await onDeleteSupplier(supplier.id);
      if (!res.success) {
        alert(res.error || "Failed to delete supplier.");
      }
    }
  };

  // Merge Submit
  const handleMergeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForMerge || !targetMergeId) return;

    if (!confirm(`Warning: This will merge "${supplierForMerge.name}" into "${suppliers.find(s => s.id === targetMergeId)?.name}".\nAll existing purchase orders will be linked to the target supplier, and "${supplierForMerge.name}" will be deleted. This cannot be undone. Proceed?`)) {
      return;
    }

    setMergeIsSubmitting(true);
    try {
      const res = await api.mergeSuppliers(supplierForMerge.id, targetMergeId);
      alert(`Merge successful! Re-linked ${res.updatedCount} Purchase Orders to the target supplier.`);
      setSupplierForMerge(null);
      setTargetMergeId("");
      onRefreshData();
    } catch (err) {
      alert("Merge operation failed. Please verify records and try again.");
    } finally {
      setMergeIsSubmitting(false);
    }
  };

  return (
    <div id="smei-suppliers" className="p-6 md:p-10 space-y-6 max-w-7xl mx-auto relative font-sans">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight font-display">Supplier Registry Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">Maintain Cavite Zone vendors, toggle active/disabled states, view transactions, or merge duplicates</p>
        </div>

        {!isViewer && (
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-smei-darkred to-smei-crimson text-white font-semibold px-4 py-2.5 rounded-xl shadow-md hover:shadow-lg active:scale-[0.98] transition-all text-sm self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Register Supplier</span>
          </button>
        )}
      </div>

      {/* Search and Metadata Controls */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center gap-4 justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-3 w-4.5 h-4.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by ID, name, attention, creator, category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10.5 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-smei-crimson focus:border-transparent focus:bg-white transition-all"
          />
        </div>
        <div className="text-xs text-gray-500 font-mono">
          Showing <span className="font-bold text-gray-700">{filteredSuppliers.length}</span> of <span className="font-bold text-gray-700">{suppliers.length}</span> registered partners
        </div>
      </div>

      {/* Supplier Registry Directory Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-visible">
          <table id="smei-suppliers-table" className="w-full text-left border-collapse text-xs min-w-[900px]">
            <thead className="sticky top-0 bg-gray-50 z-10 shadow-sm">
              <tr className="text-gray-500 text-[10px] uppercase tracking-wider font-bold border-b border-gray-100">
                <th className="py-3.5 px-6 font-display whitespace-nowrap">Supplier ID</th>
                <th className="py-3.5 px-6 font-display whitespace-nowrap">Supplier Name</th>
                <th className="py-3.5 px-6 font-display whitespace-nowrap">Category</th>
                <th className="py-3.5 px-6 font-display whitespace-nowrap">Created By</th>
                <th className="py-3.5 px-6 font-display text-center whitespace-nowrap">Status</th>
                <th className="py-3.5 px-6 font-display text-center whitespace-nowrap">Total POs</th>
                {!isViewer && <th className="py-3.5 px-6 font-display text-center whitespace-nowrap">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSuppliers.length > 0 ? (
                filteredSuppliers.map((supplier, idx) => {
                  const poCount = getPOCount(supplier.id);
                  const isSupplierActive = (supplier.status || "Active") !== "Disabled";
                  const isSelected = selectedSupplierForPOs?.id === supplier.id;

                  return (
                    <tr 
                      key={supplier.id} 
                      onClick={() => setSelectedSupplierForPOs(supplier)}
                      onDoubleClick={() => handleOpenEdit(supplier)}
                      className={`cursor-pointer transition-all border-b border-gray-50/60 group ${
                        isSelected
                          ? "bg-red-600/20 border-l-4 border-l-smei-crimson font-medium"
                          : idx % 2 === 1
                          ? "bg-gray-50/30 hover:bg-red-600/10"
                          : "bg-white hover:bg-red-600/10"
                      }`}
                      title="Double-click to View/Edit Supplier"
                    >
                      {/* ID */}
                      <td className="py-3.5 px-6 font-mono font-bold">
                        <div className="flex items-center gap-2">
                          {isSelected && (
                            <div className="w-1.5 h-1.5 bg-smei-crimson rounded-full animate-pulse shrink-0" />
                          )}
                          <span className={isSelected ? "text-smei-crimson" : "text-gray-400"}>{supplier.id}</span>
                        </div>
                      </td>
                      
                      {/* Name & Contact */}
                      <td className="py-3.5 px-6">
                        <div className="space-y-0.5">
                          <span className="font-black text-gray-800 text-sm block uppercase tracking-tight">{supplier.name}</span>
                          <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Contact className="w-3 h-3 text-gray-300" />
                            {supplier.attention} | Tel: {supplier.phone}
                          </span>
                        </div>
                      </td>
                      
                      {/* Category */}
                      <td className="py-3.5 px-6">
                        <span className="inline-flex items-center gap-1 bg-red-50 text-smei-crimson px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-red-100/40 uppercase font-mono">
                          <Tag className="w-2.5 h-2.5" />
                          <span>{supplier.category || "General"}</span>
                        </span>
                      </td>

                      {/* Created By */}
                      <td className="py-3.5 px-6">
                        <span className="text-gray-600 font-medium font-sans">
                          {supplier.created_by || "System Seed"}
                        </span>
                      </td>

                      {/* Status Slider Button */}
                      <td className="py-3.5 px-6 text-center">
                        <div className="flex items-center justify-center">
                          {isViewer ? (
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                              isSupplierActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
                            }`}>
                              {supplier.status || "Active"}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleToggleStatus(supplier)}
                              className="focus:outline-none transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                              title={`Click to ${isSupplierActive ? "Disable" : "Activate"}`}
                            >
                              {isSupplierActive ? (
                                <span className="inline-flex items-center gap-1.5 bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1 rounded-xl text-[10px] font-bold border border-green-200">
                                  <ToggleRight className="w-4 h-4 text-green-600 shrink-0" />
                                  <span>ACTIVE</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 text-gray-500 px-3 py-1 rounded-xl text-[10px] font-bold border border-gray-200">
                                  <ToggleLeft className="w-4 h-4 text-gray-400 shrink-0" />
                                  <span>DISABLED</span>
                                </span>
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Total Transactions (PO Count) */}
                      <td className="py-3.5 px-6 text-center">
                        {poCount > 0 ? (
                          <button
                            onClick={() => setSelectedSupplierForPOs(supplier)}
                            className="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-800 hover:text-amber-900 font-bold px-2.5 py-1 rounded-lg border border-amber-200/50 transition-colors font-mono cursor-pointer"
                            title="Click to view linked PO transactions"
                          >
                            <span>{poCount} POs</span>
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-gray-400 font-mono">0</span>
                        )}
                      </td>

                      {/* Action Menu */}
                      {!isViewer && (
                        <td className="py-3.5 px-6">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenEdit(supplier)}
                              className="p-1.5 hover:bg-amber-50 hover:text-amber-700 text-gray-400 hover:text-amber-700 rounded-lg transition-all cursor-pointer"
                              title="Edit Supplier"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            {/* Merge Trigger Button */}
                            <button
                              onClick={() => {
                                setSupplierForMerge(supplier);
                                setTargetMergeId("");
                              }}
                              className="p-1.5 hover:bg-indigo-50 hover:text-indigo-700 text-gray-400 hover:text-indigo-700 rounded-lg transition-all cursor-pointer"
                              title="Merge Supplier (Link POs & Delete)"
                            >
                              <GitMerge className="w-4 h-4" />
                            </button>

                            {(isAdmin || currentUser.role === UserRole.PurchasingStaff) && (
                              <button
                                onClick={() => handleDeleteAttempt(supplier)}
                                className="p-1.5 hover:bg-red-50 hover:text-smei-crimson text-gray-400 hover:text-smei-crimson rounded-lg transition-all cursor-pointer"
                                title="Delete Supplier"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400 font-sans">
                    No suppliers match your search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: View Linked POs breakdown */}
      <AnimatePresence>
        {selectedSupplierForPOs && (() => {
          const supplierPOs = pos.filter(po => po.supplierId === selectedSupplierForPOs.id);
          const totalLinkedAmount = supplierPOs.reduce((sum, p) => sum + p.totalAmount, 0);

          return (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedSupplierForPOs(null)}
                className="fixed inset-0 bg-black z-50"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="fixed inset-0 m-auto max-w-2xl h-fit max-h-[85vh] bg-white rounded-2xl shadow-2xl z-[51] overflow-hidden flex flex-col border border-gray-100"
              >
                {/* Modal Header */}
                <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <div className="flex items-center gap-2.5 text-gray-800">
                    <Building className="w-5 h-5 text-smei-crimson" />
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-tight">{selectedSupplierForPOs.name}</h3>
                      <p className="text-[10px] text-gray-400 font-mono">Linked Purchase Orders Ledger Breakdown</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedSupplierForPOs(null)}
                    className="p-1.5 hover:bg-gray-200 text-gray-400 hover:text-gray-600 rounded-lg transition-all cursor-pointer"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>

                {/* Modal Ledger Content */}
                <div className="p-6 overflow-y-auto space-y-4">
                  <div className="grid grid-cols-2 gap-4 bg-red-50/30 p-4 rounded-xl border border-red-100/20 text-xs font-sans">
                    <div>
                      <span className="text-[9px] text-gray-400 uppercase tracking-wider block">Total PO Count</span>
                      <strong className="text-base text-gray-800 font-mono">{supplierPOs.length} Transactions</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-400 uppercase tracking-wider block">Cumulative Purchase Value</span>
                      <strong className="text-base text-smei-crimson font-mono">PHP {totalLinkedAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </div>
                  </div>

                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse font-sans">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-[10px] uppercase font-bold border-b border-gray-100">
                          <th className="py-2.5 px-4">PO Number</th>
                          <th className="py-2.5 px-4">PO Date</th>
                          <th className="py-2.5 px-4 text-right">Amount</th>
                          <th className="py-2.5 px-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-mono">
                        {supplierPOs.map(po => (
                          <tr key={po.id} className="hover:bg-gray-50/60 text-[11px]">
                            <td className="py-2.5 px-4 font-bold text-gray-800">{po.poNumber}</td>
                            <td className="py-2.5 px-4 text-gray-400">{po.poDate}</td>
                            <td className="py-2.5 px-4 text-right font-semibold text-gray-700">₱ {po.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                            <td className="py-2.5 px-4 text-center">
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-gray-100 text-gray-600 uppercase font-sans">
                                {po.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                  <button
                    onClick={() => setSelectedSupplierForPOs(null)}
                    className="px-4 py-2 bg-slate-800 text-white font-semibold text-xs rounded-xl hover:bg-slate-900 transition-all cursor-pointer"
                  >
                    Close Ledger
                  </button>
                </div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>

      {/* MODAL 2: Merge Supplier Dialogue */}
      <AnimatePresence>
        {supplierForMerge && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setSupplierForMerge(null)}
              className="fixed inset-0 bg-black z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="fixed inset-0 m-auto max-w-md h-fit bg-white rounded-2xl shadow-2xl z-[51] overflow-hidden border border-gray-100"
            >
              <form onSubmit={handleMergeSubmit}>
                <div className="p-5 border-b border-gray-100 bg-indigo-50/40 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-indigo-900">
                    <GitMerge className="w-5 h-5 text-indigo-700" />
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-tight">Merge Duplicate Supplier</h3>
                      <p className="text-[10px] text-indigo-500 font-mono">Consolidating vendor profiles cleanly</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSupplierForMerge(null)}
                    className="p-1.5 hover:bg-indigo-100 text-indigo-400 hover:text-indigo-600 rounded-lg transition-all cursor-pointer"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>

                <div className="p-6 space-y-4 text-xs font-sans">
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-800 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Destructive Operation</span>
                    </div>
                    <p className="text-[10px] leading-relaxed">
                      Merging will migrate all Purchase Orders from the source supplier to the target supplier. The source supplier profile will then be deleted.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {/* Source Supplier details */}
                    <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                      <span className="text-[9px] text-gray-400 font-mono uppercase tracking-wider block">Source Profile (TO BE DELETED)</span>
                      <strong className="text-xs text-gray-800 uppercase block">{supplierForMerge.name}</strong>
                      <span className="text-[10px] text-gray-400 font-mono block">Linked PO count: {getPOCount(supplierForMerge.id)} POs</span>
                    </div>

                    <div className="flex justify-center text-gray-400">
                      <ArrowRight className="w-6 h-6 rotate-90 sm:rotate-0" />
                    </div>

                    {/* Target Supplier Selector */}
                    <div className="space-y-1.5">
                      <label className="block font-bold text-gray-600 uppercase tracking-wide">Target Profile (TO KEEP & MERGE INTO)</label>
                      <select
                        required
                        value={targetMergeId}
                        onChange={(e) => setTargetMergeId(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white"
                      >
                        <option value="">-- Select Target Active Supplier --</option>
                        {suppliers
                          .filter(s => s.id !== supplierForMerge.id)
                          .map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.category || "General"})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setSupplierForMerge(null)}
                    className="px-4 py-2 bg-white border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={mergeIsSubmitting || !targetMergeId}
                    className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    <span>{mergeIsSubmitting ? "Merging..." : "Confirm & Merge"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MODAL 3: Deletion Blocked Warn Safeguard */}
      <AnimatePresence>
        {deleteBlockError && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteBlockError(null)}
              className="fixed inset-0 bg-black z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="fixed inset-0 m-auto max-w-md h-fit bg-white rounded-2xl shadow-2xl z-[51] overflow-hidden border border-red-100"
            >
              <div className="p-5 border-b border-red-50 bg-red-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-red-900">
                  <ShieldAlert className="w-5 h-5 text-smei-crimson" />
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight text-red-900">Deletion Safeguard Active</h3>
                    <p className="text-[10px] text-red-500 font-mono">Protected Profile Constraint</p>
                  </div>
                </div>
                <button
                  onClick={() => setDeleteBlockError(null)}
                  className="p-1.5 hover:bg-red-100 text-red-400 hover:text-red-700 rounded-lg transition-all cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs font-sans leading-relaxed text-gray-600">
                <p>
                  Supplier <strong className="text-gray-900 font-black uppercase">"{deleteBlockError.supplier.name}"</strong> cannot be deleted from the database.
                </p>
                
                <div className="p-3 bg-red-50 border border-red-100/50 rounded-xl flex items-start gap-3 text-[11px] text-red-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-smei-crimson" />
                  <div>
                    <span className="font-bold">Reason:</span> This supplier is linked to <strong className="font-black text-gray-900">{deleteBlockError.poCount} active Purchase Orders</strong>. Purging the profile would break system audit trails.
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="font-bold text-gray-700 block uppercase text-[10px]">What can you do?</span>
                  <ul className="list-disc pl-5 space-y-1.5 text-gray-500 text-[11px]">
                    <li>
                      <strong className="text-gray-700">Disable Supplier Suggestions</strong>: Set status slider to <span className="font-bold text-gray-600">DISABLED</span>. This retains historical transaction audit logs but prevents this supplier from showing up in any future PO suggestions.
                    </li>
                    <li>
                      <strong className="text-gray-700">Merge Supplier</strong>: Merge this supplier into an active target vendor. All {deleteBlockError.poCount} POs will automatically move to the target supplier, and this source profile will be deleted cleanly.
                    </li>
                  </ul>
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2 text-xs">
                <button
                  onClick={() => {
                    const targetSupplier = deleteBlockError.supplier;
                    setDeleteBlockError(null);
                    // Open status toggle
                    handleToggleStatus(targetSupplier);
                  }}
                  className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-all cursor-pointer"
                >
                  Disable Suggestions Instead
                </button>
                <button
                  onClick={() => {
                    const targetSupplier = deleteBlockError.supplier;
                    setDeleteBlockError(null);
                    // Open merge dialoague
                    setSupplierForMerge(targetSupplier);
                    setTargetMergeId("");
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all cursor-pointer shadow-sm"
                >
                  Merge Vendor
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Drawer Register/Edit Form Panel */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseDrawer}
              className="fixed inset-0 bg-black z-40 no-print"
            />
            {/* Slide over */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 max-w-md w-full bg-white shadow-2xl z-45 overflow-y-auto no-print border-l border-gray-100 flex flex-col"
            >
              <form onSubmit={handleSubmit} className="flex flex-col h-full">
                
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-red-950/5 to-transparent">
                  <div>
                    <h3 className="text-base font-bold text-gray-800 tracking-tight font-display uppercase">
                      {editingSupplier ? "Modify Vendor Profile" : "Register CEZ Vendor"}
                    </h3>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">PEZA Cavite Authorized Supplier Form</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseDrawer}
                    className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-lg transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Form Fields */}
                <div className="p-6 space-y-4 flex-1 text-xs">
                  
                  {/* Status Toggle in edit mode */}
                  {editingSupplier && (
                    <div className="space-y-1">
                      <label className="block font-bold text-gray-600 uppercase tracking-wide">Suggestions Status</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as "Active" | "Disabled")}
                        className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-smei-crimson"
                      >
                        <option value="Active">Active (Suggestions Enabled)</option>
                        <option value="Disabled">Disabled (Suggestions Blocked)</option>
                      </select>
                    </div>
                  )}

                  {/* Supplier Name */}
                  <div className="space-y-1">
                    <label className="block font-bold text-gray-600 uppercase tracking-wide">
                      Supplier Partner Name <span className="text-smei-crimson font-bold ml-0.5">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. ABC Cavite Industrial Corporation"
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-smei-crimson"
                    />
                  </div>

                  {/* Contact Person */}
                  <div className="space-y-1">
                    <label className="block font-bold text-gray-600 uppercase tracking-wide">
                      Attention (Primary Contact) <span className="text-smei-crimson font-bold ml-0.5">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={attention}
                      onChange={(e) => setAttention(e.target.value)}
                      placeholder="e.g. Engr. Arthur Santos"
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-smei-crimson"
                    />
                  </div>

                  {/* Category select or text */}
                  <div className="space-y-1">
                    <label className="block font-bold text-gray-600 uppercase tracking-wide">
                      Supplier Category <span className="text-smei-crimson font-bold ml-0.5">*</span>
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      required
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-smei-crimson"
                    >
                      <option value="">-- Choose Category --</option>
                      <option value="Industrial Supply">Industrial Supply</option>
                      <option value="Hardware & Logistics">Hardware & Logistics</option>
                      <option value="Metals & Foundry">Metals & Foundry</option>
                      <option value="Gas & Fuel (VAT Exempt)">Gas & Fuel (VAT Exempt)</option>
                      <option value="Contractor & Services">Contractor & Services</option>
                      <option value="Safety Gear & Uniforms">Safety Gear & Uniforms</option>
                      <option value="Office Equipment & IT">Office Equipment & IT</option>
                    </select>
                  </div>

                  {/* Telephone */}
                  <div className="space-y-1">
                    <label className="block font-bold text-gray-600 uppercase tracking-wide">
                      Telephone Number <span className="text-smei-crimson font-bold ml-0.5">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +63-46-437-1234"
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-smei-crimson"
                    />
                  </div>

                  {/* Fax */}
                  <div className="space-y-1">
                    <label className="block font-bold text-gray-600 uppercase tracking-wide">Fax Number (Optional)</label>
                    <input
                      type="text"
                      value={fax}
                      onChange={(e) => setFax(e.target.value)}
                      placeholder="e.g. +63-46-437-5678"
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-smei-crimson"
                    />
                  </div>

                  {/* Plant Address */}
                  <div className="space-y-1">
                    <label className="block font-bold text-gray-600 uppercase tracking-wide">
                      ADDRESS:
                    </label>
                    <textarea
                      rows={3}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. Block 15, Cavite Export Processing Zone, Rosario, Cavite"
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-smei-crimson resize-none"
                    />
                  </div>

                </div>

                {/* Footer Controls */}
                <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3 text-xs">
                  <button
                    type="button"
                    onClick={handleCloseDrawer}
                    className="px-4 py-2.5 bg-white border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-gradient-to-r from-smei-darkred to-smei-crimson text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    {editingSupplier ? "Save Modifications" : "Confirm Registration"}
                  </button>
                </div>

              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
