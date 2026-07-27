/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { PurchaseOrder, Supplier, User, POItem } from "../types";
import { 
  FileSpreadsheet, 
  Printer, 
  Search, 
  Calendar, 
  SlidersHorizontal, 
  ArrowUpDown, 
  ChevronDown, 
  ChevronRight,
  Filter,
  RefreshCw,
  Building2,
  FileText
} from "lucide-react";
import { exportReportToWord } from "../utils/wordExportReport";

interface SupplierSummaryReportProps {
  pos: PurchaseOrder[];
  suppliers: Supplier[];
  currentUser: User;
}

interface FlattenedItem {
  id: string; // combined unique id
  poId: string;
  poRef: string;
  poDate: string;
  supplierId: string;
  supplierName: string;
  qty: number;
  unit: string;
  particulars: string;
  unitAmount: number;
  amount: number;
  category: string;
  department: string;
  status: string;
  preparedBy: string;
  approvedBy: string;
}

interface GroupedItem extends FlattenedItem {
  runningBalance?: number;
  groupRunningBalance?: number;
}

export default function SupplierSummaryReport({ pos, suppliers, currentUser }: SupplierSummaryReportProps) {
  // Filters state
  const [selectedSupplier, setSelectedSupplier] = useState<string>("All");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [poNumberFilter, setPoNumberFilter] = useState<string>("");
  const [preparedByFilter, setPreparedByFilter] = useState<string>("");
  const [approvedByFilter, setApprovedByFilter] = useState<string>("");
  const [globalSearch, setGlobalSearch] = useState<string>("");

  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<"poDate" | "poRef" | "amount" | "supplierName">("poDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Flatten Purchase Orders into Items for report
  const flattenedItems = useMemo(() => {
    const list: FlattenedItem[] = [];
    pos.forEach(po => {
      po.items.forEach((item, index) => {
        list.push({
          id: `${po.id}_${item.id || index}`,
          poId: po.id,
          poRef: po.poNumber,
          poDate: po.poDate,
          supplierId: po.supplierId,
          supplierName: po.supplierName,
          qty: item.quantity,
          unit: item.unit,
          particulars: item.description,
          unitAmount: item.unitPrice,
          amount: item.amount,
          category: po.category || "",
          department: (po as any).department || "Main",
          status: po.status,
          preparedBy: po.preparedBy || "",
          approvedBy: po.approvedBy || ""
        });
      });
    });

    // Sort chronologically or by field to establish a reliable baseline
    return list.sort((a, b) => {
      const dateA = new Date(a.poDate).getTime();
      const dateB = new Date(b.poDate).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return a.poRef.localeCompare(b.poRef);
    });
  }, [pos]);

  // Unique lists for filters dropdown
  const filterOptions = useMemo(() => {
    const cats = new Set<string>();
    const depts = new Set<string>();
    const preps = new Set<string>();
    const approvers = new Set<string>();

    flattenedItems.forEach(item => {
      if (item.category) cats.add(item.category);
      if (item.department) depts.add(item.department);
      if (item.preparedBy) preps.add(item.preparedBy);
      if (item.approvedBy) approvers.add(item.approvedBy);
    });

    return {
      categories: Array.from(cats),
      departments: Array.from(depts),
      preparedBys: Array.from(preps),
      approvedBys: Array.from(approvers)
    };
  }, [flattenedItems]);

  // Apply filters and searches
  const filteredItems = useMemo(() => {
    return flattenedItems.filter(item => {
      // Supplier Filter
      if (selectedSupplier !== "All" && item.supplierId !== selectedSupplier) return false;

      // Date Range Filter
      if (startDate && item.poDate < startDate) return false;
      if (endDate && item.poDate > endDate) return false;

      // Category Filter
      if (selectedCategory !== "All" && item.category !== selectedCategory) return false;

      // Department Filter
      if (selectedDepartment !== "All" && item.department !== selectedDepartment) return false;

      // Status Filter
      if (selectedStatus !== "All" && item.status !== selectedStatus) return false;

      // PO Number Filter
      if (poNumberFilter && !item.poRef.toLowerCase().includes(poNumberFilter.toLowerCase())) return false;

      // Prepared By Filter
      if (preparedByFilter && !item.preparedBy.toLowerCase().includes(preparedByFilter.toLowerCase())) return false;

      // Approved By Filter
      if (approvedByFilter && !item.approvedBy.toLowerCase().includes(approvedByFilter.toLowerCase())) return false;

      // Global Search Filter (Supplier, PO Number, Particulars, Category)
      if (globalSearch) {
        const query = globalSearch.toLowerCase();
        const match = 
          item.supplierName.toLowerCase().includes(query) ||
          item.poRef.toLowerCase().includes(query) ||
          item.particulars.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query);
        if (!match) return false;
      }

      return true;
    });
  }, [
    flattenedItems,
    selectedSupplier,
    startDate,
    endDate,
    selectedCategory,
    selectedDepartment,
    selectedStatus,
    poNumberFilter,
    preparedByFilter,
    approvedByFilter,
    globalSearch
  ]);

  // Sort Filtered Items if not grouped, or for running balance
  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === "poDate") {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredItems, sortField, sortDirection]);

  // Calculate Running Balance on sorted list
  const itemsWithRunningBalance = useMemo(() => {
    let runningSum = 0;
    return sortedItems.map(item => {
      runningSum += item.amount;
      return {
        ...item,
        runningBalance: runningSum
      };
    });
  }, [sortedItems]);

  // Global Grand Total
  const grandTotal = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + item.amount, 0);
  }, [filteredItems]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleResetFilters = () => {
    setSelectedSupplier("All");
    setStartDate("");
    setEndDate("");
    setSelectedCategory("All");
    setSelectedDepartment("All");
    setSelectedStatus("All");
    setPoNumberFilter("");
    setPreparedByFilter("");
    setApprovedByFilter("");
    setGlobalSearch("");
  };

  // Log Audit trail helper
  const logExportAudit = async (format: "Excel" | "PDF") => {
    try {
      await fetch("/api/audit/log-export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("smei_jwt_token")}`
        },
        body: JSON.stringify({
          action: "Export Report",
          module: "Suppliers",
          details: `Exported Supplier Summary Report in ${format} format`
        })
      });
    } catch (err) {
      console.error("Failed to log export activity:", err);
    }
  };

  // Excel Export
  const handleExportExcel = async () => {
    try {
      console.log("SMEI Supplier Summary Export Executed via ExcelJS");
      
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Supplier Summary");

      // Set column widths
      worksheet.columns = [
        { header: "PO REF", key: "poRef", width: 20 },
        { header: "DATE", key: "poDate", width: 15 },
        { header: "SUPPLIER", key: "supplierName", width: 35 },
        { header: "QTY", key: "qty", width: 10 },
        { header: "UNIT", key: "unit", width: 10 },
        { header: "PARTICULARS", key: "particulars", width: 50 },
        { header: "UNIT AMOUNT", key: "unitAmount", width: 18 },
        { header: "AMOUNT", key: "amount", width: 18 },
        { header: "RUNNING BALANCE", key: "runningBalance", width: 20 },
      ];

      // Company Header
      worksheet.mergeCells("A1:I1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = "SOUTHCOAST METAL ENTERPRISE, INC.";
      titleCell.font = { bold: true, size: 18 };
      titleCell.alignment = { horizontal: "center" };

      // Report Title
      worksheet.mergeCells("A2:I2");
      const reportTitleCell = worksheet.getCell("A2");
      reportTitleCell.value = "SUPPLIER SUMMARY REPORT";
      reportTitleCell.font = { bold: true, size: 14 };
      reportTitleCell.alignment = { horizontal: "center", vertical: "middle" };
      reportTitleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9D9D9" }
      };
      reportTitleCell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };

      // Meta Info
      worksheet.addRow([]);
      worksheet.addRow([`Generated: ${new Date().toLocaleString()}`]);
      worksheet.addRow([`Prepared By: ${currentUser.fullName}`]);
      worksheet.addRow([]);

      // Get Meta Row Numbers
      const lastMetaRow = worksheet.lastRow?.number || 6;
      [lastMetaRow - 2, lastMetaRow - 1].forEach(rowNum => {
        const row = worksheet.getRow(rowNum);
        row.getCell(1).font = { bold: true };
      });

      // Table Header
      const headerRow = worksheet.addRow([
        "PO REF", "DATE", "SUPPLIER", "QTY", "UNIT", "PARTICULARS", "UNIT AMOUNT", "AMOUNT", "RUNNING BALANCE"
      ]);
      headerRow.height = 25;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FF000000" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFD9D9D9" }
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" }
        };
      });

      // Group data for row merging
      const grouped: Record<string, GroupedItem[]> = itemsWithRunningBalance.reduce((acc, item) => {
        if (!acc[item.supplierId]) acc[item.supplierId] = [];
        acc[item.supplierId].push(item);
        return acc;
      }, {} as Record<string, GroupedItem[]>);

      // Data Rows
      Object.entries(grouped).forEach(([_, items]) => {
        const startRow = (worksheet.lastRow?.number || 0) + 1;
        items.forEach((item) => {
          const row = worksheet.addRow([
            item.poRef,
            new Date(item.poDate).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "2-digit" }),
            item.supplierName,
            item.qty,
            item.unit,
            item.particulars,
            item.unitAmount,
            item.amount,
            item.runningBalance || 0
          ]);

          // Currency formats
          row.getCell(7).numFmt = "\"₱\" #,##0.00";
          row.getCell(8).numFmt = "\"₱\" #,##0.00";
          row.getCell(9).numFmt = "\"₱\" #,##0.00";

          row.eachCell((cell, colNum) => {
            cell.border = {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" }
            };
            if ([2, 3, 4, 5].includes(colNum)) {
              cell.alignment = { horizontal: "center" };
            }
          });
        });

        // Merge supplier cells
        if (items.length > 1) {
          worksheet.mergeCells(startRow, 3, startRow + items.length - 1, 3);
          worksheet.getCell(startRow, 3).alignment = { vertical: "middle", horizontal: "center" };
        }
      });

      // Grand Total Row
      const totalRow = worksheet.addRow([]);
      totalRow.height = 30;
      worksheet.mergeCells(totalRow.number, 1, totalRow.number, 7);
      
      const totalLabelCell = worksheet.getCell(totalRow.number, 1);
      totalLabelCell.value = "TOTAL AMOUNT";
      totalLabelCell.font = { bold: true };
      totalLabelCell.alignment = { horizontal: "right", vertical: "middle" };
      totalLabelCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9D9D9" }
      };

      const totalValCell = worksheet.getCell(totalRow.number, 8);
      totalValCell.value = grandTotal;
      totalValCell.font = { bold: true, size: 12 };
      totalValCell.numFmt = "\"₱\" #,##0.00";
      totalValCell.alignment = { horizontal: "right", vertical: "middle" };
      totalValCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9D9D9" }
      };

      // Extend gray background to the end of the total row
      const lastCell = worksheet.getCell(totalRow.number, 9);
      lastCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9D9D9" }
      };
      worksheet.mergeCells(totalRow.number, 8, totalRow.number, 9);

      // Borders for total row
      totalRow.eachCell((cell) => {
        cell.border = {
          top: { style: "thick" },
          left: { style: "thin" },
          bottom: { style: "thick" },
          right: { style: "thin" }
        };
      });

      // Generate buffer and trigger download
      const buffer = await workbook.xlsx.writeBuffer();
      const { saveAs } = await import("file-saver");
      saveAs(new Blob([buffer]), `SMEI_Supplier_Summary_${new Date().toISOString().split("T")[0]}.xlsx`);

    } catch (error) {
      console.error("Supplier Summary Export Error", error);
      alert("Failed to export Supplier Summary.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Pagination Helper
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return itemsWithRunningBalance.slice(startIndex, startIndex + itemsPerPage);
  }, [itemsWithRunningBalance, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(itemsWithRunningBalance.length / itemsPerPage) || 1;

  return (
    <div id="smei-supplier-report" className="p-6 md:p-10 space-y-6 max-w-7xl mx-auto">
      
      {/* Report Header (Hidden in Screen if printing, but designed for PDF Print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5 no-print">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight font-display">Supplier Summary Report</h2>
          <p className="text-sm text-gray-500 mt-0.5">Chronological transactions, itemized ledger, and cumulative vendor running balances</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportExcel}
            disabled={itemsWithRunningBalance.length === 0}
            className={`inline-flex items-center gap-2 font-semibold px-4 py-2.5 rounded-xl shadow-md transition-all text-sm whitespace-nowrap ${
              itemsWithRunningBalance.length === 0
                ? "bg-gray-100 dark:bg-slate-800/80 text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-700 cursor-not-allowed shadow-none"
                : "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer hover:scale-[1.02] active:scale-95 shadow-[0_2px_8px_rgba(16,185,129,0.15)]"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={handlePrint}
            disabled={itemsWithRunningBalance.length === 0}
            className={`inline-flex items-center gap-2 font-semibold px-4 py-2.5 rounded-xl shadow-md transition-all text-sm whitespace-nowrap ${
              itemsWithRunningBalance.length === 0
                ? "bg-gray-100 dark:bg-slate-800/80 text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-700 cursor-not-allowed shadow-none"
                : "bg-red-600 hover:bg-red-700 text-white cursor-pointer hover:scale-[1.02] active:scale-95"
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>
          <button
            onClick={() => exportReportToWord(itemsWithRunningBalance, grandTotal, currentUser.fullName)}
            disabled={itemsWithRunningBalance.length === 0}
            className={`inline-flex items-center gap-2 font-semibold px-4 py-2.5 rounded-xl shadow-md transition-all text-sm whitespace-nowrap ${
              itemsWithRunningBalance.length === 0
                ? "bg-gray-100 dark:bg-slate-800/80 text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-700 cursor-not-allowed shadow-none"
                : "bg-[#2B579A] hover:bg-[#1C3A6A] text-white cursor-pointer hover:scale-[1.02] active:scale-95"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Export Word</span>
          </button>
        </div>
      </div>

      {/* Printable Company Header Header */}
      <div className="hidden print:block text-center border-b-2 border-gray-800 pb-4 mb-6">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-10 h-10 bg-red-700 text-white flex items-center justify-center font-black rounded-lg text-lg">
            SMEI
          </div>
          <div className="text-left">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 uppercase">Southcoast Metal Enterprise, Inc.</h1>
            <p className="text-[10px] text-gray-500 font-mono">PEZA Rosario, Cavite, Philippines | Tel: +63-46-437-1234</p>
          </div>
        </div>
        <h2 className="text-lg font-bold text-gray-800 uppercase tracking-widest mt-4">Supplier Summary Ledger Report</h2>
        <div className="text-xs text-gray-500 font-mono mt-1 flex justify-between px-4">
          <span>Date Generated: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</span>
          <span>Prepared By: {currentUser.fullName} ({currentUser.role})</span>
        </div>
      </div>

      {/* Filter and Controls Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4 no-print">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Global Search */}
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-3 w-4.5 h-4.5 text-gray-400" />
            <input
              type="text"
              placeholder="Global Search (Supplier, PO Number, Particulars, Category)..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-sans focus:outline-none focus:ring-2 focus:ring-smei-crimson focus:border-transparent focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                showFilters 
                  ? "bg-slate-100 text-slate-800 border-slate-300" 
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Filters</span>
              {showFilters ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={handleResetFilters}
              title="Reset Filters"
              className="p-2.5 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-xl transition-all"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expandable Advanced Filters Panel */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-100 text-xs">
            
            {/* Supplier Filter */}
            <div>
              <label className="block font-bold text-gray-600 mb-1">Supplier Partner</label>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-smei-crimson"
              >
                <option value="All">All Suppliers</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Date Range Start */}
            <div>
              <label className="block font-bold text-gray-600 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-smei-crimson"
              />
            </div>

            {/* Date Range End */}
            <div>
              <label className="block font-bold text-gray-600 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-smei-crimson"
              />
            </div>

            {/* Category Filter */}
            <div>
              <label className="block font-bold text-gray-600 mb-1">PO Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-smei-crimson"
              >
                <option value="All">All Categories</option>
                {filterOptions.categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Department Filter */}
            <div>
              <label className="block font-bold text-gray-600 mb-1">Department</label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-smei-crimson"
              >
                <option value="All">All Departments</option>
                {filterOptions.departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block font-bold text-gray-600 mb-1">Approval Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-smei-crimson"
              >
                <option value="All">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Pending Review">Pending Review</option>
                <option value="Pending Approval">Pending Approval</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            {/* PO Number Filter */}
            <div>
              <label className="block font-bold text-gray-600 mb-1">PO Number Prefix</label>
              <input
                type="text"
                placeholder="e.g. SMEI-2026"
                value={poNumberFilter}
                onChange={(e) => setPoNumberFilter(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-smei-crimson"
              />
            </div>

            {/* Prepared By */}
            <div>
              <label className="block font-bold text-gray-600 mb-1">Prepared By</label>
              <input
                type="text"
                placeholder="Search preparer..."
                value={preparedByFilter}
                onChange={(e) => setPreparedByFilter(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-smei-crimson"
              />
            </div>

          </div>
        )}
      </div>

      {/* Main Ledger Tables */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
        
        {/* CHRONOLOGICAL FLAT LIST VIEW */}
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-left border-collapse text-xs min-w-[900px]">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr className="text-gray-500 text-[10px] uppercase tracking-wider font-bold border-b border-gray-100">
                <th className="py-3.5 px-6 font-display cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap text-center" onClick={() => handleSort("poRef")}>
                  <div className="flex items-center justify-center gap-1">
                    <span>PO REF</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3.5 px-6 font-display cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap text-center" onClick={() => handleSort("poDate")}>
                  <div className="flex items-center justify-center gap-1">
                    <span>DATE</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3.5 px-6 font-display cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap text-center" onClick={() => handleSort("supplierName")}>
                  <div className="flex items-center justify-center gap-1">
                    <span>SUPPLIER</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3.5 px-4 font-display text-center whitespace-nowrap">QTY</th>
                <th className="py-3.5 px-4 font-display text-center whitespace-nowrap">UNIT</th>
                <th className="py-3.5 px-6 font-display text-center whitespace-nowrap">PARTICULARS</th>
                <th className="py-3.5 px-6 font-display text-center whitespace-nowrap">UNIT AMOUNT</th>
                <th className="py-3.5 px-6 font-display cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap text-center" onClick={() => handleSort("amount")}>
                  <div className="flex items-center justify-center gap-1">
                    <span>AMOUNT</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3.5 px-6 font-display text-center whitespace-nowrap">RUNNING BALANCE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedItems.length > 0 ? (
                paginatedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-red-50/10 transition-colors">
                    <td className="py-3 px-6 font-bold text-gray-800 font-mono tracking-wider border-r border-gray-100 text-center">{item.poRef}</td>
                    <td className="py-3 px-6 text-gray-500 font-mono whitespace-nowrap border-r border-gray-100 text-center">
                      {new Date(item.poDate).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "2-digit" })}
                    </td>
                    <td className="py-3 px-6 font-black text-gray-700 uppercase tracking-tight border-r border-gray-100 text-center">{item.supplierName}</td>
                    <td className="py-3 px-4 font-semibold text-gray-700 text-center font-mono border-r border-gray-100">{item.qty}</td>
                    <td className="py-3 px-4 text-center text-gray-500 font-mono uppercase border-r border-gray-100">{item.unit}</td>
                    <td className="py-3 px-6 text-gray-600 font-sans max-w-xs truncate border-r border-gray-100" title={item.particulars}>
                      {item.particulars}
                    </td>
                    <td className="py-3 px-6 text-right text-gray-600 font-mono border-r border-gray-100">
                      ₱ {item.unitAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-6 text-right font-semibold text-gray-800 font-mono border-r border-gray-100">
                      ₱ {item.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-6 text-right font-black text-gray-900 font-mono bg-amber-50/15">
                      ₱ {item.runningBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400 font-sans">
                    No records found matching filters.
                  </td>
                </tr>
              )}
              
              {/* Grand Total Row */}
              <tr className="bg-gray-50/55 font-bold text-xs border-t border-gray-200">
                <td colSpan={7} className="py-4 px-6 text-right uppercase tracking-wider text-gray-500 border-r border-gray-100">
                  TOTAL AMOUNT
                </td>
                <td colSpan={2} className="py-4 px-6 text-right font-black text-smei-crimson font-mono text-sm">
                  ₱ {grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Flat list view footer and pagination controls */}
        {itemsWithRunningBalance.length > itemsPerPage && (
          <div className="bg-gray-50 border-t border-gray-100 p-4 flex items-center justify-between no-print">
            <span className="text-xs text-gray-500 font-mono">
              Showing page <strong className="text-gray-700">{currentPage}</strong> of <strong className="text-gray-700">{totalPages}</strong> ({itemsWithRunningBalance.length} rows total)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-3 py-1.5 bg-white border border-gray-200 text-xs font-semibold rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-all cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-3 py-1.5 bg-white border border-gray-200 text-xs font-semibold rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-all cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Non-printed Printable compliance footer */}
      <div className="hidden print:block pt-16 grid grid-cols-2 gap-12 text-xs font-sans">
        <div className="space-y-4">
          <div className="border-t border-gray-800 pt-1 text-center font-bold text-gray-700">
            Prepared By: {currentUser.fullName}
            <div className="text-[10px] text-gray-400 font-normal">SMEI Authorized Personnel</div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="border-t border-gray-800 pt-1 text-center font-bold text-gray-700">
            Approved By: Director
            <div className="text-[10px] text-gray-400 font-normal">SMEI Corporate Officer</div>
          </div>
        </div>
      </div>
    </div>
  );
}
