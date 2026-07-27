/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { RequestForSupply, RFSItem, User, UserRole, PurchaseOrder } from "../types";
import { api } from "../lib/api";
import { Search, Plus, Filter, Calendar, FileText, ArrowUpDown, Trash2, Edit3, Eye, FileSpreadsheet, X, Download, Trash } from "lucide-react";
import { exportWordWithTemplate, exportExcelWithTemplate } from "../utils/templateExport";
import { ExportExcelButton, CreateButton, ExportPdfButton } from "./SharedButtons";
import { TableSkeleton } from "./ui/Skeleton";
import { formatRFSNo } from "../utils/templateMapping";
import { formatControlNumber } from "../utils/controlNumber";

interface RFSModuleProps {
  currentUser: User;
}

export default function RequestForSupplyModule({ currentUser }: RFSModuleProps) {
  const [requests, setRequests] = useState<RequestForSupply[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [modeFilter, setModeFilter] = useState("All");
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestForSupply | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeRfsId, setActiveRfsId] = useState<string | null>(null);
  const [selectedRFS, setSelectedRFS] = useState<RequestForSupply | null>(null);

  // Form State
  const [rfsNumber, setRfsNumber] = useState("");
  const [dateRequested, setDateRequested] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [department, setDepartment] = useState("Admin");
  const [departmentOthers, setDepartmentOthers] = useState("");
  const [controlNumber, setControlNumber] = useState("");
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState("");
  const [addNothingFollows, setAddNothingFollows] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [status, setStatus] = useState<"Complete" | "Incomplete" | "On Time" | "Late">("Incomplete");

  const loadPurchaseOrders = async () => {
    try {
      const pos = await api.getPOs();
      setPurchaseOrders(pos || []);
    } catch (err) {
      console.warn("Could not load POs for RFS dropdown:", err);
    }
  };
  const [modeOfRequest, setModeOfRequest] = useState<"Emergency" | "Urgent" | "Regular" | "Irregular">("Regular");
  const [purpose, setPurpose] = useState("");
  const [requestedBy, setRequestedBy] = useState(currentUser.fullName);
  const [verifiedBy, setVerifiedBy] = useState("");
  const [approvedBy, setApprovedBy] = useState("");

  // Items Grid State
  const [items, setItems] = useState<RFSItem[]>([]);

  // Error States
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isAdmin = currentUser.role === UserRole.Administrator;
  const isStaff = currentUser.role === UserRole.PurchasingStaff;
  const isAuthorized = isAdmin || isStaff;

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await api.getRFS();
      setRequests(data);
      if (data && data.length > 0) {
        setActiveRfsId(data[data.length - 1].id);
        setSelectedRFS(data[data.length - 1]);
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.includes("Session expired") || errMsg.includes("unauthorized") || errMsg.includes("token")) {
        console.warn("RFS fetch unauthorized or session expired (handled globally):", errMsg);
      } else {
        console.error("Error fetching RFS:", errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Filter & Search Logic
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const matchesSearch =
        req.rfsNumber.toLowerCase().includes(search.toLowerCase()) ||
        req.controlNumber.toLowerCase().includes(search.toLowerCase()) ||
        (req.purpose || "").toLowerCase().includes(search.toLowerCase()) ||
        req.department.toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus = statusFilter === "All" || req.status === statusFilter;
      const matchesDepartment = departmentFilter === "All" || req.department === departmentFilter;
      const matchesMode = modeFilter === "All" || req.modeOfRequest === modeFilter;

      return matchesSearch && matchesStatus && matchesDepartment && matchesMode;
    });
  }, [requests, search, statusFilter, departmentFilter, modeFilter]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage) || 1;
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRequests.slice(start, start + itemsPerPage);
  }, [filteredRequests, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, departmentFilter, modeFilter]);

  useEffect(() => {
    if (isModalOpen) {
      window.dispatchEvent(new CustomEvent("smei-editor-opened"));
    } else {
      window.dispatchEvent(new CustomEvent("smei-editor-closed"));
    }
    return () => {
      window.dispatchEvent(new CustomEvent("smei-editor-closed"));
    };
  }, [isModalOpen]);

  const currentRFSData = useMemo<RequestForSupply | null>(() => {
    return {
      id: selectedRequest?.id || "temp-rfs-id",
      rfsNumber,
      dateRequested,
      dueDate,
      department,
      departmentOthers: department === "Others" ? departmentOthers : "",
      controlNumber,
      purchaseOrderNumber,
      addNothingFollows,
      items,
      status,
      modeOfRequest,
      purpose,
      requestedBy,
      verifiedBy,
      approvedBy,
      createdAt: selectedRequest?.createdAt || new Date().toISOString(),
      updatedAt: selectedRequest?.updatedAt || new Date().toISOString(),
      created_by: selectedRequest?.created_by || currentUser.fullName,
    };
  }, [
    selectedRequest, rfsNumber, dateRequested, dueDate, department, departmentOthers,
    controlNumber, purchaseOrderNumber, addNothingFollows, items, status, modeOfRequest, purpose,
    requestedBy, verifiedBy, approvedBy, currentUser
  ]);

  // Open modal for Create/View/Edit
  const handleOpenModal = async (req: RequestForSupply | null = null, edit = false) => {
    setErrors({});
    loadPurchaseOrders();
    if (req) {
      setSelectedRequest(req);
      setIsEditMode(edit);
      setRfsNumber(req.rfsNumber);
      setDateRequested(req.dateRequested);
      setDueDate(req.dueDate);
      setDepartment(req.department);
      setDepartmentOthers(req.departmentOthers || "");
      setControlNumber(req.controlNumber);
      setPurchaseOrderNumber(req.purchaseOrderNumber || "");
      setAddNothingFollows(req.addNothingFollows || false);
      setStatus(req.status);
      setModeOfRequest(req.modeOfRequest);
      setPurpose(req.purpose);
      setRequestedBy(req.requestedBy);
      setVerifiedBy(req.verifiedBy || "");
      setApprovedBy(req.approvedBy || "");
      setItems(req.items || []);
    } else {
      setSelectedRequest(null);
      setIsEditMode(true);
      setDateRequested(new Date().toISOString().split("T")[0]);
      setDueDate("");
      setDepartment("Admin");
      setDepartmentOthers("");
      
      // Auto-generate sequential 5-digit control number
      let nextControlNo = "00001";
      if (requests && requests.length > 0) {
        let maxSeq = 0;
        requests.forEach((r) => {
          if (r.controlNumber) {
            const numericPart = r.controlNumber.replace(/\D/g, "");
            const seq = parseInt(numericPart, 10);
            if (!isNaN(seq) && seq > maxSeq) {
              maxSeq = seq;
            }
          }
        });
        nextControlNo = (maxSeq + 1).toString().padStart(5, "0");
      }
      setControlNumber(nextControlNo);
      
      setPurchaseOrderNumber("");
      setAddNothingFollows(false);
      setStatus("Incomplete");
      setModeOfRequest("Regular");
      setPurpose("");
      setRequestedBy(currentUser.fullName);
      setVerifiedBy("");
      setApprovedBy("");
      setItems([{
        id: `item_${Date.now()}_0`,
        quantity: 1,
        unit: "pcs",
        description: "",
        lastPurchaseDate: "",
        lastPurchaseQuantity: 0,
        lastPurchaseUnitPrice: 0,
        currentPurchaseDate: new Date().toISOString().split("T")[0],
        currentPurchaseQuantity: 1,
        currentPurchaseUnitPrice: 0,
        remarks: ""
      }]);

      // Fetch next auto-generated number
      try {
        const { nextNumber } = await api.getNextRFSNumber();
        setRfsNumber(nextNumber);
      } catch (err) {
        setRfsNumber("");
      }
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRequest(null);
  };

  // Items manipulation helpers
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item_${Date.now()}_${prev.length}`,
        quantity: 1,
        unit: "pcs",
        description: "",
        lastPurchaseDate: "",
        lastPurchaseQuantity: 0,
        lastPurchaseUnitPrice: 0,
        currentPurchaseDate: new Date().toISOString().split("T")[0],
        currentPurchaseQuantity: 1,
        currentPurchaseUnitPrice: 0,
        remarks: ""
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      alert("At least one line item is required.");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof RFSItem, value: any) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        
        const updated = { ...it, [field]: value };
        
        // Sync item.quantity with currentPurchaseQuantity automatically for sanity
        if (field === "quantity") {
          updated.currentPurchaseQuantity = Number(value);
        }
        if (field === "currentPurchaseQuantity") {
          updated.quantity = Number(value);
        }
        
        return updated;
      })
    );
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditMode) return;

    // Client-side Validations
    const newErrors: Record<string, string> = {};
    
    if (!purpose.trim()) newErrors.purpose = "Purpose is required.";
    if (!dateRequested) newErrors.dateRequested = "Requested date is required.";
    
    if (!rfsNumber.trim()) {
      newErrors.rfsNumber = "Control No is required.";
    } else {
      const format = /^\d{4}-\d{2}-\d{3}$/;
      if (!format.test(rfsNumber)) {
        newErrors.rfsNumber = "Invalid format. Expected: YYYY-MM-### (e.g., 2026-07-001).";
      }
    }

    // Validate Items
    if (items.length === 0) {
      newErrors.items = "RFS must contain at least one line item.";
    } else {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.description.trim()) {
          newErrors.items = `Line item #${i + 1} has empty name/description.`;
          break;
        }
        if (Number(item.quantity) <= 0) {
          newErrors.items = `Line item #${i + 1} quantity must be greater than zero.`;
          break;
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload: Partial<RequestForSupply> = {
      rfsNumber,
      dateRequested,
      dueDate: dueDate || "",
      department,
      departmentOthers: department === "Others" ? departmentOthers : "",
      controlNumber: "",
      purchaseOrderNumber,
      addNothingFollows,
      items,
      status,
      modeOfRequest,
      purpose,
      requestedBy,
      verifiedBy,
      approvedBy
    };

    try {
      if (selectedRequest) {
        // Edit Mode
        await api.updateRFS(selectedRequest.id, payload);
      } else {
        // Create Mode
        await api.createRFS(payload);
      }
      fetchRequests();
      handleCloseModal();
    } catch (err: any) {
      setErrors({ server: err.message || "An unexpected error occurred." });
    }
  };

  const handleDelete = async (id: string, num: string) => {
    if (confirm(`Are you sure you want to delete Request for Supply ${num}?`)) {
      try {
        await api.deleteRFS(id);
        fetchRequests();
      } catch (err: any) {
        alert(err.message || "Error deleting RFS");
      }
    }
  };

  const validateRFSExport = (req: RequestForSupply): boolean => {
    const isComplete = req.status === "Complete";
    const hasDueDate = Boolean(req.dueDate && req.dueDate.trim() !== "");

    if (!isComplete && !hasDueDate) {
      alert("Cannot export RFS. Status must be 'Complete' and Due Date must be set before exporting.");
      return false;
    }
    if (!isComplete) {
      alert(`Cannot export RFS. Status must be 'Complete' before exporting (Current status: '${req.status || "Incomplete"}'). Please complete the RFS approval first.`);
      return false;
    }
    if (!hasDueDate) {
      alert("Cannot export RFS. Due Date is missing. Please set the Due Date in RFS Approval before exporting.");
      return false;
    }
    return true;
  };

  // Template-based Export
  const handleExport = async (req: RequestForSupply, format: "word" | "excel") => {
    if (!validateRFSExport(req)) return;
    const formattedRFS = formatRFSNo(req.rfsNumber, req.dateRequested);
    const exportData = {
      RFS_NO: formattedRFS,
      REQUEST_DATE: req.dateRequested,
      DUE_DATE: req.dueDate || "",
      RECEIVED_DATE: req.dueDate || "", // Map to template placeholder
      DEPARTMENT: req.department === "Others" ? req.departmentOthers : req.department,
      CONTROL_NO: formattedRFS,
      PO_NO: req.purchaseOrderNumber || "N/A",
      STATUS: req.status,
      MODE: req.modeOfRequest,
      PURPOSE: req.purpose,
      REQUESTED_BY: req.requestedBy,
      VERIFIED_BY: req.verifiedBy || "N/A",
      APPROVED_BY: req.approvedBy || "N/A",
    };

    const exportItems = (req.items || []).map((it, index) => ({
      index: index + 1,
      quantity: it.quantity,
      unit: it.unit,
      description: it.description,
      item: it.description,
      lastPurchaseDate: it.lastPurchaseDate || "N/A",
      lastPurchaseQuantity: it.lastPurchaseQuantity || 0,
      lastPurchaseUnitPrice: it.lastPurchaseUnitPrice || 0,
      currentPurchaseDate: it.currentPurchaseDate || "N/A",
      currentPurchaseQuantity: it.currentPurchaseQuantity || 0,
      currentPurchaseUnitPrice: it.currentPurchaseUnitPrice || 0,
      remarks: it.remarks || "N/A",
      isItalic: false,
    }));

    if (req.addNothingFollows) {
      exportItems.push({
        index: exportItems.length + 1,
        quantity: "",
        unit: "",
        description: "*****NOTHING FOLLOWS*****",
        item: "*****NOTHING FOLLOWS*****",
        lastPurchaseDate: "N/A",
        lastPurchaseQuantity: 0,
        lastPurchaseUnitPrice: 0,
        currentPurchaseDate: "N/A",
        currentPurchaseQuantity: 0,
        currentPurchaseUnitPrice: 0,
        remarks: "N/A",
        isItalic: true,
      } as any);
    }

    if (format === "word") {
      // Pass data to Docxtemplater containing loop array "items"
      await exportWordWithTemplate("RFS_TEMPLATE_WORD.docx", { ...exportData, items: exportItems }, `${formattedRFS}_SMEI_RFS.docx`);
    } else {
      await exportExcelWithTemplate("RFS_TEMPLATE.xlsm", exportData, "items", exportItems, `${formattedRFS}_SMEI_RFS.xlsm`);
    }
  };

  const statusColors: Record<string, string> = {
    Complete: "bg-green-50 text-green-700 border-green-300",
    Incomplete: "bg-gray-100 text-gray-700 border-gray-300",
    "On Time": "bg-blue-50 text-blue-700 border-blue-300",
    Late: "bg-rose-50 text-rose-700 border-rose-300"
  };

  const modeColors: Record<string, string> = {
    Emergency: "bg-red-50 text-red-700 border-red-200 font-bold",
    Urgent: "bg-orange-50 text-orange-700 border-orange-200 font-bold",
    Regular: "bg-gray-50 text-gray-700 border-gray-200",
    Irregular: "bg-amber-50 text-amber-700 border-amber-200"
  };

const handleExportExcel = async () => {
    if (!selectedRFS) {
        alert("Please select one Request for Supply first.");
        return;
    }
    await handleExport(selectedRFS, "excel");
};

  const handleTriggerPDFExport = async () => {
    if (selectedRFS) {
      if (!validateRFSExport(selectedRFS)) return;
      try {
        const { printDocument } = await import("../utils/printDocument");
        await printDocument("rfs", selectedRFS);
      } catch (err: any) {
        alert("Failed to print: " + (err.message || err));
      }
    } else {
      alert("Please select an RFS first.");
    }
  };

  return (
    <div id="smei-rfs-list" className="p-4 md:p-6 space-y-4 max-w-[130rem] mx-auto w-full">
      {/* Upper Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 tracking-tight font-display">Requests for Supply [RFS]</h2>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5">Manage departmental purchasing requests and supply deliveries</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full md:w-auto md:justify-end">
          {selectedRFS && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase font-mono tracking-wider">Selected:</span>
              <span className="text-[11px] font-bold font-mono text-smei-crimson bg-red-50 border border-red-200 px-2.5 py-1 rounded-md">
                {formatRFSNo(selectedRFS.rfsNumber, selectedRFS.dateRequested)}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            {isAuthorized && (
              <CreateButton onClick={() => handleOpenModal(null)} label="Create RFS" />
            )}
          </div>
        </div>
      </div>

      {/* Full Width Layout for RFS */}
      <div className="w-full">
        {/* Main Column: Filters + Table (List Mode) OR Form Editor (Form Mode) */}
        <div className="w-full flex flex-col gap-4 h-[calc(100vh-170px)] min-h-[650px]">
          {isModalOpen ? (
            /* Embedded High-Fidelity Form Editor (Identical to PO design style) */
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
              {/* Form Header */}
              <div className="bg-smei-crimson text-white px-6 py-3 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide">
                    {selectedRequest ? (isEditMode ? "Edit Request for Supply" : "Request for Supply Details") : "Create New Request for Supply"}
                  </h3>
                  <p className="text-[10px] text-red-100 font-medium">SMEI Departmental Purchasing Requests</p>
                </div>
                <button onClick={handleCloseModal} className="text-white hover:text-red-200 p-1 rounded hover:bg-white/10 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Content (Scrollable) */}
              <div className="p-6 overflow-y-auto flex-1">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {errors.server && (
                    <div className="bg-rose-50 border-l-4 border-rose-500 text-rose-700 text-xs p-3 rounded-md font-medium">
                      {errors.server}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Control Number */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Control No.: *</label>
                      <input
                        type="text"
                        required
                        disabled={!isEditMode}
                        className={`w-full text-sm font-mono font-semibold p-2 border rounded-lg focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none ${
                          errors.rfsNumber ? "border-rose-500 bg-rose-50/20" : "border-gray-200 bg-gray-50"
                        }`}
                        value={rfsNumber}
                        onChange={(e) => setRfsNumber(formatControlNumber(e.target.value, "rfsNumber"))}
                        placeholder="YYYY-MM-###"
                      />
                      {errors.rfsNumber && <p className="text-[10px] text-rose-500 mt-0.5 font-semibold">{errors.rfsNumber}</p>}
                    </div>

                    {/* Purchase Order Number */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Associated PO Number (Optional):</label>
                      <select
                        disabled={!isEditMode}
                        className="w-full text-sm p-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson font-mono bg-white"
                        value={purchaseOrderNumber}
                        onChange={(e) => setPurchaseOrderNumber(e.target.value)}
                      >
                        <option value="">No Associated Purchase Order</option>
                        {purchaseOrders.map((po) => (
                          <option key={po.id || po.poNumber} value={po.poNumber}>
                            {po.poNumber}{po.supplierName ? ` (${po.supplierName})` : ""}
                          </option>
                        ))}
                        {purchaseOrderNumber && !purchaseOrders.some((p) => p.poNumber === purchaseOrderNumber) && (
                          <option value={purchaseOrderNumber}>{purchaseOrderNumber}</option>
                        )}
                      </select>
                    </div>

                    {/* Department Selection */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Requesting Department:</label>
                      <div className="flex gap-2">
                        <select
                          disabled={!isEditMode}
                          className="w-1/2 text-sm p-2 border border-gray-200 rounded-lg bg-white outline-none focus:ring-1 focus:ring-smei-crimson"
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                        >
                          <option value="Admin">Admin</option>
                          <option value="Technical">Technical</option>
                          <option value="Accounting">Accounting</option>
                          <option value="OM Sales">OM Sales</option>
                          <option value="Sales">Sales</option>
                          <option value="Others">Others</option>
                        </select>
                        {department === "Others" && (
                          <input
                            type="text"
                            required
                            disabled={!isEditMode}
                            placeholder="Specify"
                            className="w-1/2 text-sm p-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-smei-crimson"
                            value={departmentOthers}
                            onChange={(e) => setDepartmentOthers(e.target.value)}
                          />
                        )}
                      </div>
                    </div>

                    {/* Mode of Request */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Mode of Request: *</label>
                      <select
                        disabled={!isEditMode}
                        className="w-full text-sm p-2 border border-gray-200 rounded-lg bg-white outline-none focus:ring-1 focus:ring-smei-crimson"
                        value={modeOfRequest}
                        onChange={(e: any) => setModeOfRequest(e.target.value)}
                      >
                        <option value="Regular">REGULAR/ROUTINE (5-7 days)</option>
                        <option value="Emergency">EMERGENCY (1-2 days)</option>
                        <option value="Urgent">URGENT (4-5 days)</option>
                        <option value="Irregular">IRREGULAR (7-10 days)</option>
                      </select>
                    </div>

                    {/* Date Requested */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Date Requested: *</label>
                      <input
                        type="date"
                        required
                        disabled={!isEditMode}
                        className={`w-full text-sm p-2 border rounded-lg focus:ring-1 focus:ring-smei-crimson outline-none ${
                          errors.dateRequested ? "border-rose-500 bg-rose-50/20" : "border-gray-200"
                        }`}
                        value={dateRequested}
                        onChange={(e) => setDateRequested(e.target.value)}
                      />
                      {errors.dateRequested && <p className="text-[10px] text-rose-500 mt-0.5 font-semibold">{errors.dateRequested}</p>}
                    </div>

                    {/* Purpose - Full width row */}
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Purpose: *</label>
                      <input
                        type="text"
                        required
                        disabled={!isEditMode}
                        placeholder="Narrative explanation of request"
                        className={`w-full text-sm p-2 border rounded-lg outline-none focus:ring-1 focus:ring-smei-crimson ${
                          errors.purpose ? "border-rose-500 bg-rose-50/20" : "border-gray-200"
                        }`}
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                      />
                      {errors.purpose && <p className="text-[10px] text-rose-500 mt-0.5 font-semibold">{errors.purpose}</p>}
                    </div>
                  </div>

                  {/* Items Table Grid */}
                  <div className="border-t border-gray-100 pt-4 mt-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <h4 className="text-xs font-bold text-smei-darkred uppercase tracking-wide">Supply Items List Grid</h4>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1.5 text-xs text-gray-700 font-medium cursor-pointer select-none">
                          <input
                            type="checkbox"
                            disabled={!isEditMode}
                            checked={addNothingFollows}
                            onChange={(e) => setAddNothingFollows(e.target.checked)}
                            className="w-4 h-4 text-smei-crimson rounded border-gray-300 focus:ring-smei-crimson"
                          />
                          <span>Add &quot;*****NOTHING FOLLOWS*****&quot; to the last item</span>
                        </label>
                        {isEditMode && (
                          <button
                            type="button"
                            onClick={handleAddItem}
                            className="text-xs bg-red-50 hover:bg-red-100 text-smei-crimson border border-red-200 px-2.5 py-1 rounded font-semibold flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Item Row</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {errors.items && <p className="text-xs text-rose-500 mb-2 font-semibold bg-rose-50 p-2 border-l-4 border-rose-500 rounded">{errors.items}</p>}

                    <div className="overflow-x-auto border border-gray-100 rounded-lg">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-100 text-gray-600 font-bold uppercase tracking-wider border-b border-gray-200 text-[10px]">
                            <th className="py-2.5 px-3 w-16">Qty</th>
                            <th className="py-2.5 px-3 w-20">Unit</th>
                            <th className="py-2.5 px-3 w-48">Description *</th>
                            <th className="py-2.5 px-3 w-32">Last Pur. Date</th>
                            <th className="py-2.5 px-3 w-24">Last Qty</th>
                            <th className="py-2.5 px-3 w-28">Last Purchase</th>
                            <th className="py-2.5 px-3 w-32">Cur. Pur. Date</th>
                            <th className="py-2.5 px-3 w-24">Current Qty</th>
                            <th className="py-2.5 px-3 w-28">Current Price</th>
                            <th className="py-2.5 px-3 w-36">Remarks</th>
                            {isEditMode && <th className="py-2.5 px-3 text-center w-12">Act</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((it, idx) => (
                            <tr key={it.id || idx} className="border-b border-gray-100 hover:bg-gray-50/50">
                              {/* Qty */}
                              <td className="p-1">
                                <input
                                  type="number"
                                  required
                                  disabled={!isEditMode}
                                  className="w-full border border-gray-200 p-1 rounded font-mono text-center focus:border-smei-crimson outline-none"
                                  value={it.quantity === 0 ? "" : it.quantity}
                                  onChange={(e) => handleItemChange(idx, "quantity", e.target.value === "" ? 0 : Number(e.target.value))}
                                />
                              </td>
                              {/* Unit */}
                              <td className="p-1">
                                <input
                                  type="text"
                                  disabled={!isEditMode}
                                  className="w-full border border-gray-200 p-1 rounded text-center focus:border-smei-crimson outline-none"
                                  value={it.unit}
                                  onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                                />
                              </td>
                              {/* Description */}
                              <td className="p-1">
                                <input
                                  type="text"
                                  required
                                  disabled={!isEditMode}
                                  placeholder="Name/Specs of item"
                                  className="w-full border border-gray-200 p-1 rounded focus:border-smei-crimson outline-none font-semibold text-gray-800"
                                  value={it.description}
                                  onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                                />
                              </td>
                              {/* Last Purchase Date */}
                              <td className="p-1">
                                <input
                                  type="date"
                                  disabled={!isEditMode}
                                  className="w-full border border-gray-200 p-1 rounded font-mono focus:border-smei-crimson outline-none"
                                  value={it.lastPurchaseDate}
                                  onChange={(e) => handleItemChange(idx, "lastPurchaseDate", e.target.value)}
                                />
                              </td>
                              {/* Last Purchase Qty */}
                              <td className="p-1">
                                <input
                                  type="number"
                                  disabled={!isEditMode}
                                  className="w-full border border-gray-200 p-1 rounded font-mono focus:border-smei-crimson outline-none"
                                  value={it.lastPurchaseQuantity === 0 ? "" : it.lastPurchaseQuantity}
                                  onChange={(e) => handleItemChange(idx, "lastPurchaseQuantity", e.target.value === "" ? 0 : Number(e.target.value))}
                                />
                              </td>
                              {/* Last Purchase Price */}
                              <td className="p-1">
                                <input
                                  type="number"
                                  step="any"
                                  disabled={!isEditMode}
                                  className="w-full border border-gray-200 p-1 rounded font-mono focus:border-smei-crimson outline-none"
                                  value={it.lastPurchaseUnitPrice === 0 ? "" : it.lastPurchaseUnitPrice}
                                  onChange={(e) => handleItemChange(idx, "lastPurchaseUnitPrice", e.target.value === "" ? 0 : Number(e.target.value))}
                                />
                              </td>
                              {/* Current Purchase Date */}
                              <td className="p-1">
                                <input
                                  type="date"
                                  disabled={!isEditMode}
                                  className="w-full border border-gray-200 p-1 rounded font-mono focus:border-smei-crimson outline-none"
                                  value={it.currentPurchaseDate}
                                  onChange={(e) => handleItemChange(idx, "currentPurchaseDate", e.target.value)}
                                />
                              </td>
                              {/* Current Qty */}
                              <td className="p-1">
                                <input
                                  type="number"
                                  disabled={!isEditMode}
                                  className="w-full border border-gray-200 p-1 rounded font-mono focus:border-smei-crimson outline-none"
                                  value={it.currentPurchaseQuantity === 0 ? "" : it.currentPurchaseQuantity}
                                  onChange={(e) => handleItemChange(idx, "currentPurchaseQuantity", e.target.value === "" ? 0 : Number(e.target.value))}
                                />
                              </td>
                              {/* Current Purchase Price */}
                              <td className="p-1">
                                <input
                                  type="number"
                                  step="any"
                                  disabled={!isEditMode}
                                  className="w-full border border-gray-200 p-1 rounded font-mono focus:border-smei-crimson outline-none"
                                  value={it.currentPurchaseUnitPrice === 0 ? "" : it.currentPurchaseUnitPrice}
                                  onChange={(e) => handleItemChange(idx, "currentPurchaseUnitPrice", e.target.value === "" ? 0 : Number(e.target.value))}
                                />
                              </td>
                              {/* Remarks */}
                              <td className="p-1">
                                <input
                                  type="text"
                                  disabled={!isEditMode}
                                  placeholder="Notes"
                                  className="w-full border border-gray-200 p-1 rounded focus:border-smei-crimson outline-none"
                                  value={it.remarks}
                                  onChange={(e) => handleItemChange(idx, "remarks", e.target.value)}
                                />
                              </td>
                              {/* Action */}
                              {isEditMode && (
                                <td className="p-1 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(idx)}
                                    className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                  >
                                    <Trash className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                          {addNothingFollows && (
                            <tr className="border-b border-gray-100 bg-gray-50/70 italic text-gray-500 font-medium select-none">
                              <td className="p-2 text-center font-mono text-[11px] text-gray-400">-</td>
                              <td className="p-2 text-center text-[11px] text-gray-400">-</td>
                              <td className="p-2 font-semibold text-gray-600 tracking-wide font-mono text-xs italic">
                                *****NOTHING FOLLOWS*****
                              </td>
                              <td className="p-2 text-center text-[11px] text-gray-400 font-mono">-</td>
                              <td className="p-2 text-center text-[11px] text-gray-400 font-mono">-</td>
                              <td className="p-2 text-center text-[11px] text-gray-400 font-mono">-</td>
                              <td className="p-2 text-center text-[11px] text-gray-400 font-mono">-</td>
                              <td className="p-2 text-center text-[11px] text-gray-400 font-mono">-</td>
                              <td className="p-2 text-center text-[11px] text-gray-400 font-mono">-</td>
                              <td className="p-2 text-center text-[11px] text-gray-400 font-mono">-</td>
                              {isEditMode && <td className="p-2 text-center text-gray-300 text-[10px]">Auto</td>}
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Signatories Section */}
                  <div className="border-t border-gray-100 pt-4 mt-2">
                    <h4 className="text-xs font-bold text-smei-darkred uppercase tracking-wide mb-3">Workflow Signatories</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Requested By (Dept Head):</label>
                        <input
                          type="text"
                          disabled={!isEditMode}
                          className="w-full text-sm p-2 border border-gray-200 rounded-lg bg-gray-50/50"
                          value={requestedBy}
                          onChange={(e) => setRequestedBy(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Verified By (Purchasing):</label>
                        <input
                          type="text"
                          disabled={!isEditMode}
                          className="w-full text-sm p-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-smei-crimson"
                          value={verifiedBy}
                          onChange={(e) => setVerifiedBy(e.target.value)}
                          placeholder="Name of verifier"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Approved By (Director):</label>
                        <input
                          type="text"
                          disabled={!isEditMode}
                          className="w-full text-sm p-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-smei-crimson"
                          value={approvedBy}
                          onChange={(e) => setApprovedBy(e.target.value)}
                          placeholder="Name of director"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Form Buttons */}
                  <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4 mt-6">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      {isEditMode ? "Cancel" : "Close"}
                    </button>
                    {isEditMode && (
                      <button
                        type="submit"
                        className="px-5 py-2 bg-smei-crimson hover:bg-smei-darkred text-white text-sm font-semibold rounded-lg shadow-xs"
                      >
                        Save Request
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          ) : (
            /* Compressed Search and Filters Board + Table Container (List View) */
            <>
              {/* Compressed Search and Filters Board */}
              <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  {/* Search Keywords */}
                  <div className="space-y-0.5">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Search Keywords</label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="RFS#, purpose, items..."
                        className="w-full pl-7.5 pr-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent focus:bg-white transition-all text-gray-700"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Status Filter */}
                  <div className="space-y-0.5">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Status</label>
                    <div className="relative">
                      <Filter className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                      <select
                        className="w-full pl-7.5 pr-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent focus:bg-white transition-all text-gray-700"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                      >
                        <option value="All">All Statuses</option>
                        <option value="Incomplete">Incomplete</option>
                        <option value="Complete">Complete</option>
                        <option value="On Time">On Time</option>
                        <option value="Late">Late</option>
                      </select>
                    </div>
                  </div>

                  {/* Department Filter */}
                  <div className="space-y-0.5">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Department</label>
                    <div className="relative">
                      <Filter className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                      <select
                        className="w-full pl-7.5 pr-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent focus:bg-white transition-all text-gray-700"
                        value={departmentFilter}
                        onChange={(e) => setDepartmentFilter(e.target.value)}
                      >
                        <option value="All">All Departments</option>
                        <option value="Admin">Admin</option>
                        <option value="Technical">Technical</option>
                        <option value="Accounting">Accounting</option>
                        <option value="OM Sales">OM Sales</option>
                        <option value="Sales">Sales</option>
                        <option value="Others">Others</option>
                      </select>
                    </div>
                  </div>

                  {/* Request Mode Filter */}
                  <div className="space-y-0.5">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Request Mode</label>
                    <div className="relative">
                      <Filter className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                      <select
                        className="w-full pl-7.5 pr-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent focus:bg-white transition-all text-gray-700"
                        value={modeFilter}
                        onChange={(e) => setModeFilter(e.target.value)}
                      >
                        <option value="All">All Modes</option>
                        <option value="Emergency">Emergency</option>
                        <option value="Urgent">Urgent</option>
                        <option value="Regular">Regular</option>
                        <option value="Irregular">Irregular</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Table Container */}
              <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto flex-1 overflow-y-auto">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead className="sticky top-0 bg-white z-10 shadow-sm">
                      <tr className="bg-red-50/20 text-gray-600 border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider">
                        <th className="py-4 px-6">Control No.</th>
                        <th className="py-4 px-6">Department</th>
                        <th className="py-4 px-6">Date Requested</th>
                        <th className="py-4 px-6">Due Date</th>
                        <th className="py-4 px-6">Mode</th>
                        <th className="py-4 px-6">Status</th>
                        <th className="py-4 px-6 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <TableSkeleton rows={5} columns={8} />
                      ) : paginatedRequests.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-gray-400">
                            No Requests for Supply found matching filters.
                          </td>
                        </tr>
                      ) : (
                        filteredRequests.map((req, idx) => (
                          <tr
                            key={req.id}
                            onClick={() => {
                              setActiveRfsId(req.id);
                              setSelectedRFS(req);
                            }}
                            onDoubleClick={() => handleOpenModal(req, false)}
                            className={`cursor-pointer transition-all border-b border-gray-50/60 group ${
                              selectedRFS?.id === req.id
                                ? "bg-red-600/20 border-l-4 border-l-smei-crimson font-medium"
                                : idx % 2 === 1
                                ? "bg-gray-50/30 hover:bg-red-600/10"
                                : "bg-white hover:bg-red-600/10"
                            }`}
                            title="Double-click to View details"
                          >
                            <td className="py-3 px-6 font-mono font-bold text-smei-darkred">
                              <div className="flex items-center gap-2">
                                {selectedRFS?.id === req.id && (
                                  <div className="w-1.5 h-1.5 bg-smei-crimson rounded-full animate-pulse shrink-0" />
                                )}
                                <span>{formatRFSNo(req.rfsNumber, req.dateRequested)}</span>
                              </div>
                            </td>
                            <td className="py-3 px-6 text-gray-700 font-semibold text-xs">
                              {req.department === "Others" ? req.departmentOthers : req.department}
                            </td>
                            <td className="py-3 px-6 text-gray-500 font-mono">{req.dateRequested}</td>
                            <td className="py-3 px-6 text-gray-500 font-mono">{req.dueDate}</td>
                            <td className="py-3 px-6">
                              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] border ${modeColors[req.modeOfRequest] || "bg-gray-100"}`}>
                                {req.modeOfRequest}
                              </span>
                            </td>
                            <td className="py-3 px-6">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border ${statusColors[req.status] || "bg-gray-100"}`}>
                                {req.status}
                              </span>
                            </td>
                            <td className="py-3 px-6 text-center" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleOpenModal(req, false)}
                                  className="p-1 hover:bg-red-50 hover:text-smei-crimson text-gray-400 rounded transition-all"
                                  title="View details"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>

                                {isAuthorized && (
                                  <button
                                    onClick={() => handleOpenModal(req, true)}
                                    className="p-1 hover:bg-blue-50 hover:text-blue-600 text-gray-400 rounded transition-all"
                                    title="Edit RFS"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                )}

                                {isAuthorized && (
                                  <button
                                    onClick={() => handleDelete(req.id, formatRFSNo(req.rfsNumber, req.dateRequested))}
                                    className="p-1 hover:bg-rose-50 hover:text-rose-600 text-gray-400 rounded transition-all"
                                    title="Delete RFS"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
