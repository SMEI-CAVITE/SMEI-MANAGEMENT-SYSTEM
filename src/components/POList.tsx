/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { PurchaseOrder, Supplier, User, UserRole } from "../types";
import { Search, Plus, Filter, Calendar, FileText, ArrowUpDown, Trash2, Edit3, Eye, Printer, FileSpreadsheet, Download } from "lucide-react";
import { ExcelTemplateDownloadButton, exportPOToExcel } from "./ExcelIO";
import { exportPOToWord, exportPOToXLSM } from "../utils/wordExport";
import { TableSkeleton } from "./ui/Skeleton";
import { ExportExcelButton, ExportWordButton, ExportPdfButton } from "./SharedButtons";
import DeleteConfirmationModal from "./DeleteConfirmationModal";

interface POListProps {
  pos: PurchaseOrder[];
  suppliers: Supplier[];
  currentUser: User;
  onSelectPO: (po: PurchaseOrder) => void;
  onAddNewPO: () => void;
  onDeletePO: (id: string) => void;
  onImportPOs: (imported: PurchaseOrder[]) => void;
  initialStatusFilter?: string;
}

// Memoized PO Row
const PORow = React.memo(({
  po,
  index,
  selectedPOId,
  statusColors,
  isAdmin,
  isStaff,
  setSelectedPOId,
  onSelectPO,
  onDeletePO
}: {
  po: PurchaseOrder;
  index: number;
  selectedPOId: string | null;
  statusColors: Record<string, string>;
  isAdmin: boolean;
  isStaff: boolean;
  setSelectedPOId: (id: string) => void;
  onSelectPO: (po: PurchaseOrder) => void;
  onDeletePO: (po: PurchaseOrder) => void;
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (po: PurchaseOrder) => {
    setIsExporting(true);
    await exportPOToWord(po);
    setIsExporting(false);
  };

  return (
    <tr
      key={po.id}
      onClick={() => setSelectedPOId(po.id)}
      onDoubleClick={() => onSelectPO(po)}
      className={`cursor-pointer transition-all group ${
        selectedPOId === po.id
          ? "bg-red-600/20 border-l-4 border-l-smei-crimson font-medium"
          : index % 2 === 1
          ? "bg-gray-50/45 hover:bg-red-600/10"
          : "bg-white hover:bg-red-600/10"
      }`}
      title="Double-click to View/Edit PO"
    >
      <td className="py-4 px-6 font-mono font-bold text-smei-darkred">
        <div className="flex items-center gap-2">
          {selectedPOId === po.id && (
            <div className="w-1.5 h-1.5 bg-smei-crimson rounded-full animate-pulse shrink-0" />
          )}
          <span>{po.poNumber}</span>
        </div>
      </td>
      <td className="py-4 px-6 font-medium text-gray-800 max-w-xs truncate" title={po.supplierName}>
        {po.supplierName}
      </td>
      <td className="py-4 px-6">
        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono font-semibold uppercase tracking-wide text-[10px]">
          {po.category}
        </span>
      </td>
      <td className="py-4 px-6 text-gray-500 font-mono">{po.poDate}</td>
      <td className="py-4 px-6 text-right font-mono font-bold text-gray-800">
        {new Intl.NumberFormat("en-PH", {
          style: "currency",
          currency: "PHP",
          minimumFractionDigits: 2
        }).format(po.totalAmount)}
      </td>
      <td className="py-4 px-6">
        <span className={`inline-flex px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border ${statusColors[po.status] || "bg-gray-100"}`}>
          {po.status}
        </span>
      </td>
      <td className="py-4 px-6 text-gray-600 font-medium">{po.preparedBy}</td>
      <td className="py-4 px-6 text-center" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-1.5">
          <button
            onClick={() => onSelectPO(po)}
            className="p-1.5 hover:bg-red-50 hover:text-smei-crimson text-gray-400 hover:text-smei-crimson rounded-lg transition-all"
            title="View / Edit PO Form"
          >
            <Eye className="w-4 h-4" />
          </button>

          <button
            onClick={() => exportPOToXLSM(po)}
            className="p-1.5 hover:bg-green-50 hover:text-green-600 text-gray-400 hover:text-green-600 rounded-lg transition-all"
            title="Export Single PO to Excel (.XLSM)"
          >
            <FileSpreadsheet className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleExport(po)}
            disabled={isExporting}
            className="p-1.5 hover:bg-blue-50 hover:text-[#2B579A] text-gray-400 hover:text-[#2B579A] rounded-lg transition-all disabled:opacity-50"
            title="Export Single PO to Word (.docx)"
          >
            <FileText className="w-4 h-4" />
          </button>
          
          {(isAdmin || (isStaff && po.status === "Draft")) && (
            <button
              onClick={() => onDeletePO(po)}
              className="p-1.5 hover:bg-red-50 hover:text-smei-crimson text-gray-400 hover:text-smei-crimson rounded-lg transition-all"
              title="Delete PO"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});

export default function POList({
  pos,
  suppliers,
  currentUser,
  onSelectPO,
  onAddNewPO,
  onDeletePO,
  onImportPOs,
  initialStatusFilter = "All"
}: POListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedPOId, setSelectedPOId] = useState<string | null>(pos.length > 0 ? pos[pos.length - 1].id : null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    setStatusFilter(initialStatusFilter);
  }, [initialStatusFilter]);

  useEffect(() => {
    if (pos.length > 0 && !selectedPOId) {
      setSelectedPOId(pos[pos.length - 1].id);
    }
  }, [pos, selectedPOId]);

  const [poToDelete, setPoToDelete] = useState<PurchaseOrder | null>(null);

  const isViewer = currentUser.role === UserRole.Viewer;
  const isStaff = currentUser.role === UserRole.PurchasingStaff;
  const isAdmin = currentUser.role === UserRole.Administrator;

  // Filter purchase orders
  const filteredPOs = useMemo(() => {
    return [...pos]
      .reverse() // Latest first
      .filter((po) => {
        // 1. Search filter
        const term = searchQuery.toLowerCase();
        const matchesSearch =
          po.poNumber.toLowerCase().includes(term) ||
          po.supplierName.toLowerCase().includes(term) ||
          po.category.toLowerCase().includes(term) ||
          po.preparedBy.toLowerCase().includes(term) ||
          (po.approvedBy && po.approvedBy.toLowerCase().includes(term));

        // 2. Status filter
        const matchesStatus = statusFilter === "All" || po.status === statusFilter;

        // 3. Date Range filters
        let matchesDate = true;
        if (dateFrom) {
          matchesDate = matchesDate && po.poDate >= dateFrom;
        }
        if (dateTo) {
          matchesDate = matchesDate && po.poDate <= dateTo;
        }

        return matchesSearch && matchesStatus && matchesDate;
      });
  }, [pos, searchQuery, statusFilter, dateFrom, dateTo]);

  const statusColors: Record<string, string> = {
    Draft: "bg-gray-100 text-gray-700 border-gray-200",
    "Pending Review": "bg-amber-50 text-amber-700 border-amber-200",
    "Pending Approval": "bg-yellow-50 text-yellow-700 border-yellow-200",
    Approved: "bg-green-50 text-green-700 border-green-200",
    Rejected: "bg-red-50 text-red-700 border-red-200",
    Cancelled: "bg-orange-50 text-orange-700 border-orange-200",
    Closed: "bg-blue-50 text-blue-700 border-blue-200",
  };

  const handleExportExcel = async () => {
    const targetPO = pos.find((p) => p.id === selectedPOId);
    if (targetPO) {
      await exportPOToXLSM(targetPO);
    } else {
      alert("Please select a purchase order first.");
    }
  };

  const handleExportAll = async () => {
    const targetPO = pos.find((p) => p.id === selectedPOId);
    if (targetPO) {
      setIsExporting(true);
      await exportPOToWord(targetPO);
      setIsExporting(false);
    }
  };

  const handleTriggerPDFExport = async () => {
    const targetPO = pos.find((p) => p.id === selectedPOId);
    if (targetPO) {
      try {
        const { printDocument } = await import("../utils/printDocument");
        await printDocument("po", targetPO);
      } catch (err: any) {
        alert("Failed to print: " + (err.message || err));
      }
    } else {
      alert("Please select a purchase order first.");
    }
  };

  return (
    <>
      <div id="smei-po-list" className="p-4 md:p-6 space-y-4 max-w-[130rem] mx-auto w-full">
      {/* Upper Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 tracking-tight font-display">Purchase Orders Directory</h2>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5">Create, revise, and generate compliance-validated Cavite EPZA procurement sheets</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full md:w-auto md:justify-end">
          {selectedPOId && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase font-mono tracking-wider">Selected:</span>
              <span className="text-[11px] font-bold font-mono text-smei-crimson bg-red-50 border border-red-200 px-2.5 py-1 rounded-md">
                {pos.find((p) => p.id === selectedPOId)?.poNumber || ""}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <ExportExcelButton
              onClick={handleExportExcel}
              disabled={!selectedPOId}
            />
            <ExportWordButton
              onClick={handleExportAll}
              disabled={!selectedPOId || isExporting}
              label={isExporting ? "Generating..." : "Export Word"}
            />
            <ExportPdfButton
              onClick={handleTriggerPDFExport}
              disabled={!selectedPOId}
            />
            {!isViewer && (
              <button
                onClick={onAddNewPO}
                className="bg-smei-crimson hover:bg-smei-darkred text-white text-sm font-semibold h-[38px] px-4 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all hover:scale-[1.02] active:scale-95 whitespace-nowrap flex-shrink-0 w-full sm:w-auto cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create PO</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Full Width Layout for PO Grid */}
      <div className="w-full flex flex-col gap-4 h-[calc(100vh-170px)] min-h-[650px]">
        
        {/* Advanced Searching & Filters Board (Compressed) */}
        <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {/* Search Term */}
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Search Keywords</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="PO#, supplier..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-7.5 pr-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent focus:bg-white transition-all text-gray-700"
                  />
                </div>
              </div>

              {/* Workflow Status Filter */}
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Status</label>
                <div className="relative">
                  <Filter className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full pl-7.5 pr-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent focus:bg-white transition-all text-gray-700"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Draft">Draft</option>
                    <option value="Pending Review">Pending Review</option>
                    <option value="Pending Approval">Pending Approval</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>

              {/* Date From */}
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Date From</label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full pl-7.5 pr-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent focus:bg-white transition-all text-gray-700 font-mono"
                  />
                </div>
              </div>

              {/* Date To */}
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Date To</label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full pl-7.5 pr-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent focus:bg-white transition-all text-gray-700 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* List table */}
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table id="smei-po-table" className="w-full text-left border-collapse min-w-[600px]">
                <thead className="sticky top-0 bg-gray-50 z-10 shadow-sm">
                  <tr className="text-gray-500 text-xs uppercase tracking-wider font-semibold border-b border-gray-100">
                    <th className="py-3.5 px-6 font-display whitespace-nowrap">PO Number</th>
                    <th className="py-3.5 px-6 font-display whitespace-nowrap">Supplier</th>
                    <th className="py-3.5 px-6 font-display whitespace-nowrap">Purchase Category</th>
                    <th className="py-3.5 px-6 font-display whitespace-nowrap">Creation Date</th>
                    <th className="py-3.5 px-6 font-display text-right whitespace-nowrap">Gross Total Amount</th>
                    <th className="py-3.5 px-6 font-display whitespace-nowrap">Workflow Status</th>
                    <th className="py-3.5 px-6 font-display whitespace-nowrap">Prepared By</th>
                    <th className="py-3.5 px-6 font-display text-center whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {isExporting ? (
                    <TableSkeleton rows={5} columns={8} />
                  ) : filteredPOs.length > 0 ? (
                    filteredPOs.map((po, index) => (
                      <PORow
                        key={po.id}
                        po={po}
                        index={index}
                        selectedPOId={selectedPOId}
                        statusColors={statusColors}
                        isAdmin={isAdmin}
                        isStaff={isStaff}
                        setSelectedPOId={setSelectedPOId}
                        onSelectPO={onSelectPO}
                        onDeletePO={(targetPo) => setPoToDelete(targetPo)}
                      />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-400 font-sans">
                        No purchase orders match your filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <DeleteConfirmationModal
        isOpen={poToDelete !== null}
        onClose={() => setPoToDelete(null)}
        onConfirm={() => {
          if (poToDelete) {
            onDeletePO(poToDelete.id);
          }
        }}
        title="Delete Purchase Order"
        message={`Are you sure you want to delete purchase order ${poToDelete?.poNumber}? This action is irreversible.`}
        recordIdentifier={poToDelete?.poNumber}
      />
    </>
  );
}
