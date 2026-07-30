/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { PaymentInstructionSlip, PaymentEntry, User, UserRole, PurchaseOrder } from "../types";
import { api } from "../lib/api";
import { Search, Plus, Filter, Calendar, FileText, ArrowUpDown, Trash2, Edit3, Eye, FileSpreadsheet, X, Download } from "lucide-react";
import { exportWordWithTemplate, exportExcelWithTemplate } from "../utils/templateExport";
import { wrapRemarks, mapPISData } from "../utils/templateMapping";
import { WysiwygPurposeEditor } from "./WysiwygPurposeEditor";
import { ExportExcelButton, CreateButton } from "./SharedButtons";
import { formatControlNumber } from "../utils/controlNumber";
import { TableSkeleton } from "./ui/Skeleton";

interface PISModuleProps {
  currentUser: User;
}

export default function PaymentInstructionSlipModule({ currentUser }: PISModuleProps) {
  const [slips, setSlips] = useState<PaymentInstructionSlip[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currencyFilter, setCurrencyFilter] = useState("All");
  const [paymentModeFilter, setPaymentModeFilter] = useState("All");
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState<PaymentInstructionSlip | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeSlipId, setActiveSlipId] = useState<string | null>(null);

  // Form State
  const [pisNumber, setPisNumber] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [ampm, setAmpm] = useState<"AM" | "PM">("AM");
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [gross, setGross] = useState<number>(0);
  const [ewt, setEwt] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  const [currency, setCurrency] = useState<"PHP" | "USD" | "JP Yen" | "Others">("PHP");
  const [currencyOthers, setCurrencyOthers] = useState("");
  const [paymentMode, setPaymentMode] = useState<"Cash" | "Check Crossed" | "Check Not Crossed" | "T/T" | "Others">("Cash");
  const [paymentModeOthers, setPaymentModeOthers] = useState("");
  const [remarks, setRemarks] = useState("");
  const [requestedBy, setRequestedBy] = useState(currentUser.fullName);
  const [requestedDate, setRequestedDate] = useState(new Date().toISOString().split("T")[0]);
  const [checkedAndVerifiedBy, setCheckedAndVerifiedBy] = useState("");
  const [checkedAndVerifiedByPosition, setCheckedAndVerifiedByPosition] = useState("");
  const [verifiedBy, setVerifiedBy] = useState("");
  const [verifiedByPosition, setVerifiedByPosition] = useState("");
  const [verifiedByDate, setVerifiedByDate] = useState("");
  const [acceptedBy, setAcceptedBy] = useState("");
  const [acceptedByPosition, setAcceptedByPosition] = useState("");
  const [acceptedByDate, setAcceptedByDate] = useState("");
  const [status, setStatus] = useState<"Draft" | "Pending" | "Approved" | "Released" | "Cancelled">("Draft");
  const [payments, setPayments] = useState<PaymentEntry[]>([
    { id: "1", completedPOId: "", completedPONumber: "", paymentPurpose: "", gross: 0, ewt: 1, total: 0 }
  ]);

  // Error States
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isAdmin = currentUser.role === UserRole.Administrator;
  const isStaff = currentUser.role === UserRole.PurchasingStaff;
  const isAuthorized = isAdmin || isStaff;

  const fetchSlips = async () => {
    setLoading(true);
    try {
      const [pisData, posData] = await Promise.all([
        api.getPIS().catch(() => []),
        api.getPOs().catch(() => [])
      ]);
      setSlips(pisData);
      setPurchaseOrders(posData);
      if (pisData && pisData.length > 0) {
        setActiveSlipId(pisData[pisData.length - 1].id);
        setSelectedSlip(pisData[pisData.length - 1]);
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.includes("Session expired") || errMsg.includes("unauthorized") || errMsg.includes("token")) {
        console.warn("PIS fetch unauthorized or session expired (handled globally):", errMsg);
      } else {
        console.error("Error fetching PIS slips:", errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlips();
  }, []);

  // Filter completed/eligible Purchase Orders for selection
  const eligiblePOs = useMemo(() => {
    if (!purchaseOrders || purchaseOrders.length === 0) return [];
    const approvedList = purchaseOrders.filter((po) => {
      return (
        po.status === "Approved" ||
        po.status === "Closed" ||
        po.approvalStatus === "Approved"
      );
    });
    if (approvedList.length > 0) return approvedList;
    return purchaseOrders;
  }, [purchaseOrders]);

  // Auto-calculate total and set amount whenever payments changes
  useEffect(() => {
    let computedGrossSum = 0;
    let computedEwtSum = 0;
    let computedTotalSum = 0;

    payments.forEach((p) => {
      computedGrossSum += Number(p.gross) || 0;
      computedEwtSum += Number(p.ewt) || 0;
      computedTotalSum += Number(p.total) || 0;
    });

    setGross(Number(computedGrossSum.toFixed(2)));
    setEwt(Number(computedEwtSum.toFixed(2)));
    setTotal(Number(computedTotalSum.toFixed(2)));
    setAmount(Number(computedTotalSum.toFixed(2)));
  }, [payments]);

  // Filter & Search Logic
  const filteredSlips = useMemo(() => {
    return slips.filter((slip) => {
      const matchesSearch =
        slip.pisNumber.toLowerCase().includes(search.toLowerCase()) ||
        slip.payee.toLowerCase().includes(search.toLowerCase()) ||
        (slip.remarks || "").toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus = statusFilter === "All" || slip.status === statusFilter;
      const matchesCurrency = currencyFilter === "All" || slip.currency === currencyFilter;
      const matchesPaymentMode = paymentModeFilter === "All" || slip.paymentMode === paymentModeFilter;

      return matchesSearch && matchesStatus && matchesCurrency && matchesPaymentMode;
    });
  }, [slips, search, statusFilter, currencyFilter, paymentModeFilter]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredSlips.length / itemsPerPage) || 1;
  const paginatedSlips = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSlips.slice(start, start + itemsPerPage);
  }, [filteredSlips, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, currencyFilter, paymentModeFilter]);

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

  const currentPISData = useMemo<PaymentInstructionSlip>(() => {
    return {
      id: selectedSlip?.id || "temp-pis-id",
      pisNumber,
      scheduleDate,
      scheduleTime,
      ampm,
      payee,
      gross,
      ewt,
      total,
      amount,
      currency,
      currencyOthers,
      paymentMode,
      paymentModeOthers,
      remarks,
      requestedBy,
      requestedDate,
      checkedAndVerifiedBy,
      checkedAndVerifiedByPosition,
      verifiedBy,
      verifiedByPosition,
      verifiedByDate,
      acceptedBy,
      acceptedByPosition,
      acceptedByDate,
      status,
      payments,
      created_by: selectedSlip?.created_by || currentUser.fullName,
      createdAt: selectedSlip?.createdAt || new Date().toISOString()
    };
  }, [
    selectedSlip, pisNumber, scheduleDate, scheduleTime, ampm, payee, gross, ewt, total, amount,
    currency, currencyOthers, paymentMode, paymentModeOthers, remarks, requestedBy, requestedDate,
    checkedAndVerifiedBy, checkedAndVerifiedByPosition, verifiedBy, verifiedByPosition, verifiedByDate,
    acceptedBy, acceptedByPosition, acceptedByDate, status, payments, currentUser
  ]);

  // Open modal for Create/View/Edit
  const handleOpenModal = async (slip: PaymentInstructionSlip | null = null, edit = false) => {
    setErrors({});
    if (slip) {
      setSelectedSlip(slip);
      setIsEditMode(edit);
      setPisNumber((slip.pisNumber || "").toUpperCase());
      setScheduleDate(slip.scheduleDate);
      setScheduleTime(slip.scheduleTime);
      setAmpm(slip.ampm);
      setPayee(slip.payee);
      setGross(slip.gross !== undefined ? slip.gross : slip.amount);
      setEwt(slip.ewt !== undefined ? slip.ewt : 0);
      setTotal(slip.total !== undefined ? slip.total : slip.amount);
      setAmount(slip.amount);
      setCurrency(slip.currency);
      setCurrencyOthers(slip.currencyOthers || "");
      setPaymentMode(slip.paymentMode);
      setPaymentModeOthers(slip.paymentModeOthers || "");
      setRemarks(slip.remarks || "");
      setRequestedBy(slip.requestedBy);
      setRequestedDate(slip.requestedDate);
      setCheckedAndVerifiedBy(slip.checkedAndVerifiedBy || "");
      setCheckedAndVerifiedByPosition(slip.checkedAndVerifiedByPosition || "");
      setVerifiedBy(slip.verifiedBy || "");
      setVerifiedByPosition(slip.verifiedByPosition || "");
      setVerifiedByDate(slip.verifiedByDate || "");
      setAcceptedBy(slip.acceptedBy || "");
      setAcceptedByPosition(slip.acceptedByPosition || "");
      setAcceptedByDate(slip.acceptedByDate || "");
      setStatus(slip.status);
      if (slip.payments && slip.payments.length > 0) {
        setPayments(slip.payments.map(p => ({
          ...p,
          completedPOId: p.completedPOId || "",
          completedPONumber: p.completedPONumber || p.poNumber || "",
          poNumber: p.completedPONumber || p.poNumber || "",
          paymentPurpose: (p.paymentPurpose || "").toUpperCase()
        })));
      } else {
        setPayments([
          {
            id: "1",
            completedPOId: slip.completedPOId || "",
            completedPONumber: slip.completedPONumber || slip.poNumber || "",
            poNumber: slip.completedPONumber || slip.poNumber || "",
            paymentPurpose: (slip.remarks || "PAYMENT ENTRY").toUpperCase(),
            gross: slip.gross !== undefined ? slip.gross : slip.amount,
            ewt: slip.ewt !== undefined ? slip.ewt : 0,
            total: slip.total !== undefined ? slip.total : slip.amount
          }
        ]);
      }
    } else {
      setSelectedSlip(null);
      setIsEditMode(true);
      setScheduleDate(new Date().toISOString().split("T")[0]);
      setScheduleTime("09:00");
      setAmpm("AM");
      setPayee("");
      setGross(0);
      setEwt(0);
      setTotal(0);
      setAmount(0);
      setCurrency("PHP");
      setCurrencyOthers("");
      setPaymentMode("Cash");
      setPaymentModeOthers("");
      setRemarks("");
      setPayments([
        { id: "1", completedPOId: "", completedPONumber: "", poNumber: "", paymentPurpose: "", gross: 0, ewt: 1, total: 0 }
      ]);
      setRequestedBy(currentUser.fullName);
      setRequestedDate(new Date().toISOString().split("T")[0]);
      setCheckedAndVerifiedBy("");
      setCheckedAndVerifiedByPosition("");
      setVerifiedBy("");
      setVerifiedByPosition("");
      setVerifiedByDate("");
      setAcceptedBy("");
      setAcceptedByPosition("");
      setAcceptedByDate("");
      setStatus("Pending");

      // Fetch next auto-generated number
      try {
        const { nextNumber } = await api.getNextPISNumber();
        setPisNumber(nextNumber);
      } catch (err) {
        setPisNumber("");
      }
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSlip(null);
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditMode) return;

    // Client-side Validations
    const newErrors: Record<string, string> = {};
    
    if (!payee.trim()) newErrors.payee = "Payee is required.";
    if (!scheduleDate) newErrors.scheduleDate = "Schedule date is required.";
    if (!pisNumber.trim()) {
      newErrors.pisNumber = "PIS Number is required.";
    } else {
      const format = /^PURC-PIS-\d{2}-\d{3}$/;
      if (!format.test(pisNumber)) {
        newErrors.pisNumber = "Invalid format. Expected: PURC-PIS-YY-### (e.g., PURC-PIS-26-001).";
      }
    }

    // Validate payment entries
    let missingPO = false;
    let missingGross = false;
    let duplicatePO = false;
    let completedPOSelected = false;

    const seenPOIds = new Set<string>();

    payments.forEach((p) => {
      const isPOFilled = (p.completedPONumber || p.completedPOId || "").trim() !== "";
      const isPurposeFilled = (p.paymentPurpose || "").trim() !== "";
      const isGrossFilled = (p.gross || 0) > 0;
      const isEwtFilled = (p.ewt || 0) > 0;

      if (!isPOFilled) {
        missingPO = true;
        newErrors[`completedPO_${p.id}`] = "Please select a PO Number.";
      } else {
        const selectedId = p.completedPOId || p.completedPONumber;
        if (seenPOIds.has(selectedId)) {
          duplicatePO = true;
          newErrors[`completedPO_${p.id}`] = "This Purchase Order is selected multiple times.";
        } else {
          seenPOIds.add(selectedId);
        }

        const matchedPO = purchaseOrders.find(po => po.id === p.completedPOId || po.poNumber === p.completedPONumber);
        if (matchedPO) {
          const isStatusCompleted = ["COMPLETED", "FULLY PAID", "PAYMENT FINISHED", "CLOSED"].includes((matchedPO.status || "").toUpperCase()) || ["COMPLETED", "FULLY PAID", "PAYMENT FINISHED", "CLOSED"].includes((matchedPO.approvalStatus || "").toUpperCase());
          const usedInOtherPIS = slips.some((slip) =>
            slip.id !== selectedSlip?.id &&
            slip.status !== "Cancelled" &&
            (slip.completedPOId === matchedPO.id || slip.completedPONumber === matchedPO.poNumber || (slip.payments && slip.payments.some(pay => pay.completedPOId === matchedPO.id || pay.completedPONumber === matchedPO.poNumber)))
          );

          if (isStatusCompleted || usedInOtherPIS) {
            completedPOSelected = true;
            newErrors[`completedPO_${p.id}`] = `Purchase Order ${matchedPO.poNumber} is already completed or paid.`;
          }
        }
      }

      if (!p.gross || p.gross <= 0) {
        missingGross = true;
        newErrors[`gross_${p.id}`] = "Please enter the Gross amount.";
      }
      if (p.ewt === undefined || p.ewt < 0 || p.ewt > 100) {
        newErrors[`ewt_${p.id}`] = "EWT must be a valid percentage.";
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (duplicatePO) {
        alert("⚠ Cannot save: Duplicate Purchase Order selected in Payment Breakdown.");
      } else if (completedPOSelected) {
        alert("⚠ Cannot save: One or more selected Purchase Orders are already completed or fully paid.");
      } else if (missingPO && missingGross) {
        alert("⚠ Please select a PO Number and enter the Gross amount before saving.");
      } else if (missingPO) {
        alert("⚠ Please select a PO Number before saving.");
      } else if (missingGross) {
        alert("⚠ Please enter the Gross amount before saving.");
      }
      return;
    }

    const primaryPOEntry = payments.find(p => (p.completedPONumber || p.poNumber || "").trim() !== "");
    const cleanedPayments = payments.map(p => ({
      ...p,
      completedPOId: p.completedPOId || "",
      completedPONumber: (p.completedPONumber || p.poNumber || "").toUpperCase(),
      poNumber: (p.completedPONumber || p.poNumber || "").toUpperCase(),
      paymentPurpose: (p.paymentPurpose || "").toUpperCase()
    }));

    const payload: Partial<PaymentInstructionSlip> = {
      pisNumber: pisNumber.toUpperCase(),
      completedPOId: primaryPOEntry?.completedPOId || "",
      completedPONumber: (primaryPOEntry?.completedPONumber || primaryPOEntry?.poNumber || "").toUpperCase(),
      poNumber: (primaryPOEntry?.completedPONumber || primaryPOEntry?.poNumber || "").toUpperCase(),
      scheduleDate,
      scheduleTime,
      ampm,
      payee: payee.toUpperCase(),
      amount,
      gross,
      ewt,
      total,
      currency,
      currencyOthers: currency === "Others" ? currencyOthers.toUpperCase() : "",
      paymentMode,
      paymentModeOthers: paymentMode === "Others" ? paymentModeOthers.toUpperCase() : "",
      remarks: remarks.toUpperCase(),
      payments: cleanedPayments,
      requestedBy,
      requestedDate,
      checkedAndVerifiedBy,
      checkedAndVerifiedByPosition,
      verifiedBy,
      verifiedByPosition,
      verifiedByDate,
      acceptedBy,
      acceptedByPosition,
      acceptedByDate,
      status
    };

    try {
      if (selectedSlip) {
        // Edit Mode
        await api.updatePIS(selectedSlip.id, payload);
      } else {
        // Create Mode
        await api.createPIS(payload);
      }
      fetchSlips();
      handleCloseModal();
    } catch (err: any) {
      setErrors({ server: err.message || "An unexpected error occurred." });
    }
  };

  const handleDelete = async (id: string, num: string) => {
    if (confirm(`Are you sure you want to delete Payment Instruction Slip ${num}?`)) {
      try {
        await api.deletePIS(id);
        fetchSlips();
      } catch (err: any) {
        alert(err.message || "Error deleting PIS");
      }
    }
  };

  // Template-based Export
  const handleExport = async (slip: PaymentInstructionSlip, format: "word" | "excel") => {
     console.log("===== HANDLE EXPORT =====");
      console.log("Format:", format);
      console.log("PIS:", slip.pisNumber);

    const remarksText = slip.remarks || "";
    const remarksLines = wrapRemarks(remarksText, 34);

    if (remarksLines.length > 5) {
      alert("Remarks exceed the printable area. Please shorten the Remarks.");
      return;
    }

    const exportData = mapPISData(slip);

    if (format === "word") {
      await exportWordWithTemplate("PIS_TEMPLATE_WORD.docx", exportData, `${slip.pisNumber}_SMEI_PIS.docx`);
    } else {
      console.log("Calling exportExcelWithTemplate...");
      await exportExcelWithTemplate("PIS_TEMPLATE.xlsm", exportData, "items", [], `${slip.pisNumber}_SMEI_PIS.xlsm`);
    }
  };

  const statusColors: Record<string, string> = {
    Draft: "bg-gray-100 text-gray-800 border-gray-300",
    Pending: "bg-amber-50 text-amber-700 border-amber-300 animate-pulse",
    Approved: "bg-green-50 text-green-700 border-green-300",
    Released: "bg-blue-50 text-blue-700 border-blue-300",
    Cancelled: "bg-rose-50 text-rose-700 border-rose-300",
    Rejected: "bg-red-50 text-red-700 border-red-300"
  };

  const handleExportExcel = async () => {
    console.log("===== GREEN EXPORT BUTTON =====");

    if (!activeSlipId) {
      console.log("No PIS active row selected");
      alert("Please select one Payment Instruction Slip first.");
      return;
    }

    const slipToExport = slips.find((s) => s.id === activeSlipId);

    if (!slipToExport) {
      console.log("No matching slip found for ID:", activeSlipId);
      alert("Please select one Payment Instruction Slip first.");
      return;
    }

    console.log("Selected PIS:", slipToExport.pisNumber);
    await handleExport(slipToExport, "excel");
    console.log("handleExport finished");
  };



  return (
    <div id="smei-pis-list" className="p-4 md:p-6 space-y-4 max-w-[130rem] mx-auto w-full">
      {/* Upper Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 tracking-tight font-display">Payment Instruction Slips [PIS]</h2>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5">Manage purchasing payment instructions and financial authorizations</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full md:w-auto md:justify-end">
          {activeSlipId && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase font-mono tracking-wider">Selected:</span>
              <span className="text-[11px] font-bold font-mono text-smei-crimson bg-red-50 border border-red-200 px-2.5 py-1 rounded-md">
                {slips.find((s) => s.id === activeSlipId)?.pisNumber || ""}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            {isAuthorized && (
              <CreateButton onClick={() => handleOpenModal(null)} label="Create PIS" />
            )}
          </div>
        </div>
      </div>

      {/* Full Width Layout for PIS Grid */}
      <div className="w-full flex flex-col gap-4 h-[calc(100vh-170px)] min-h-[650px]">
        
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
                    placeholder="PIS#, payee, remarks..."
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
                    <option value="Draft">Draft</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Released">Released</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Currency Filter */}
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Currency</label>
                <div className="relative">
                  <Filter className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                  <select
                    className="w-full pl-7.5 pr-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent focus:bg-white transition-all text-gray-700"
                    value={currencyFilter}
                    onChange={(e) => setCurrencyFilter(e.target.value)}
                  >
                    <option value="All">All Currencies</option>
                    <option value="PHP">PHP (Pesos)</option>
                    <option value="USD">USD (Dollars)</option>
                    <option value="JP Yen">JP Yen</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
              </div>

              {/* Payment Mode Filter */}
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Payment Mode</label>
                <div className="relative">
                  <Filter className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                  <select
                    className="w-full pl-7.5 pr-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent focus:bg-white transition-all text-gray-700"
                    value={paymentModeFilter}
                    onChange={(e) => setPaymentModeFilter(e.target.value)}
                  >
                    <option value="All">All Modes</option>
                    <option value="Cash">Cash</option>
                    <option value="Check Crossed">Check Crossed</option>
                    <option value="Check Not Crossed">Check Not Crossed</option>
                    <option value="T/T">T/T</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="sticky top-0 bg-white z-10 shadow-sm">
                  <tr className="bg-red-50/20 text-gray-600 border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-6">PIS Number</th>
                    <th className="py-3.5 px-6">Payee</th>
                    <th className="py-3.5 px-6">Schedule</th>
                    <th className="py-3.5 px-6 text-right">Amount</th>
                    <th className="py-3.5 px-6">Payment Mode</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {loading ? (
                    <TableSkeleton rows={5} columns={7} />
                  ) : paginatedSlips.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400">
                        No Payment Instruction Slips found matching filters.
                      </td>
                    </tr>
                  ) : (
                    filteredSlips.map((slip, idx) => (
                      <tr
                        key={slip.id}
                        onClick={() => {
                            setActiveSlipId(slip.id);
                            setSelectedSlip(slip);
                        }}
                        onDoubleClick={() => handleOpenModal(slip, isAuthorized)}
                        className={`cursor-pointer transition-all border-b border-gray-50/60 group ${
                          activeSlipId === slip.id
                            ? "bg-red-600/20 border-l-4 border-l-smei-crimson font-medium"
                            : idx % 2 === 1
                            ? "bg-gray-50/30 hover:bg-red-600/10"
                            : "bg-white hover:bg-red-600/10"
                        }`}
                        title="Double-click to View/Edit details"
                      >
                        <td className="py-3 px-6 font-mono font-bold text-smei-darkred">
                          <div className="flex items-center gap-2">
                            {activeSlipId === slip.id && (
                              <div className="w-1.5 h-1.5 bg-smei-crimson rounded-full animate-pulse shrink-0" />
                            )}
                            <span>{slip.pisNumber}</span>
                          </div>
                        </td>
                        <td className="py-3 px-6 font-semibold text-gray-800">{slip.payee}</td>
                        <td className="py-3 px-6 text-gray-500 font-mono">
                          {slip.scheduleDate} {slip.scheduleTime} {slip.ampm}
                        </td>
                        <td className="py-3 px-6 text-right font-mono font-bold text-gray-800">
                          {new Intl.NumberFormat("en-PH", {
                            style: "currency",
                            currency: slip.currency === "Others" ? "PHP" : (slip.currency === "JP Yen" ? "JPY" : slip.currency),
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }).format(slip.amount)}
                        </td>
                        <td className="py-3 px-6 text-gray-600 text-xs">
                          {slip.paymentMode === "Others" ? slip.paymentModeOthers : slip.paymentMode}
                        </td>
                        <td className="py-3 px-6">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border ${statusColors[slip.status] || "bg-gray-100"}`}>
                            {slip.status}
                          </span>
                        </td>
                        <td className="py-3 px-6 text-center" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenModal(slip, false)}
                              className="p-1 hover:bg-red-50 hover:text-smei-crimson text-gray-400 rounded transition-all"
                              title="View PIS details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {isAuthorized && (
                              <button
                                onClick={() => handleOpenModal(slip, true)}
                                className="p-1 hover:bg-blue-50 hover:text-blue-600 text-gray-400 rounded transition-all"
                                title="Edit PIS"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            )}

                            {isAuthorized && (
                              <button
                                onClick={() => handleDelete(slip.id, slip.pisNumber)}
                                className="p-1 hover:bg-rose-50 hover:text-rose-600 text-gray-400 rounded transition-all"
                                title="Delete PIS"
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
        </div>

      {/* View/Create/Edit Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 w-full max-w-3xl overflow-hidden transition-all scale-100">
            <div className="bg-smei-crimson text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold uppercase tracking-wide">
                  {selectedSlip ? (isEditMode ? "Edit PIS Document" : "Payment Instruction Slip Details") : "Create New PIS Document"}
                </h3>
                <p className="text-[10px] text-red-100 font-medium">SMEI Purchasing Management <strong>Operations</strong></p>
              </div>
              <button onClick={handleCloseModal} className="text-white hover:text-red-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[80vh] overflow-y-auto">
              {/* Form Editor */}
              <div className="w-full">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {errors.server && (
                    <div className="bg-rose-50 border-l-4 border-rose-500 text-rose-700 text-xs p-3 rounded-md font-medium">
                      {errors.server}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* PIS Number */}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">PIS Document Number: *</label>
                      <input
                        type="text"
                        required
                        disabled={!isEditMode}
                        className={`w-full text-sm font-mono font-semibold p-2 border rounded-lg focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none ${
                          errors.pisNumber ? "border-rose-500 bg-rose-50/20" : "border-gray-200 bg-gray-50"
                        }`}
                        value={pisNumber}
                        onChange={(e) => setPisNumber(formatControlNumber(e.target.value, "pisNumber"))}
                        placeholder="PURC-PIS-YY-###"
                      />
                      {errors.pisNumber && <p className="text-[10px] text-rose-500 mt-0.5 font-semibold">{errors.pisNumber}</p>}
                    </div>

                    {/* Payee */}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Payee Name: *</label>
                      <input
                        type="text"
                        required
                        disabled={!isEditMode}
                        placeholder="Enter recipient company or person"
                        className={`w-full text-sm p-2 border rounded-lg focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none ${
                          errors.payee ? "border-rose-500 bg-rose-50/20" : "border-gray-200"
                        }`}
                        value={payee}
                        onChange={(e) => setPayee(e.target.value)}
                      />
                      {errors.payee && <p className="text-[10px] text-rose-500 mt-0.5 font-semibold">{errors.payee}</p>}
                    </div>

                    {/* Dynamic Payments Breakdown List */}
                    <div className="md:col-span-2 bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-4">
                      <div className="pb-2 border-b border-gray-100">
                        <h4 className="text-sm font-bold text-gray-800">Payment Breakdown</h4>
                      </div>

                      <div className="space-y-3">
                        {payments.map((p, idx) => (
                          <div key={p.id} className="relative grid grid-cols-1 md:grid-cols-12 gap-3 bg-white p-3.5 rounded-lg border border-gray-100 shadow-sm">
                            {/* Header / Delete row */}
                            <div className="md:col-span-12 flex justify-between items-center pb-1 border-b border-gray-100/60">
                              <span className="text-[11px] font-bold text-gray-400 font-mono">Entry #{idx + 1}</span>
                              {payments.length > 1 && isEditMode && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPayments(payments.filter(item => item.id !== p.id));
                                  }}
                                  className="text-xs font-semibold text-rose-500 hover:text-rose-700 transition-all flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-rose-50"
                                >
                                  Remove
                                </button>
                              )}
                            </div>

                            {/* 1. Completed Purchase Order Selection */}
                            <div className="md:col-span-6">
                              <label className="block text-[10px] font-bold text-gray-500 mb-0.5 uppercase tracking-wider">
                                Completed Purchase Order: {errors[`completedPO_${p.id}`] && <span className="text-rose-500 font-bold ml-1">⚠</span>}
                              </label>
                              <select
                                disabled={!isEditMode}
                                className={`w-full text-xs p-2 border rounded-lg focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none ${
                                  errors[`completedPO_${p.id}`] ? "border-rose-500 bg-rose-50/20" : "border-gray-200 bg-white"
                                }`}
                                value={p.completedPOId || ""}
                                onChange={(e) => {
                                  const selectedId = e.target.value;
                                  const matchedPO = eligiblePOs.find(po => po.id === selectedId);
                                  const poNum = matchedPO ? matchedPO.poNumber : "";
                                  const nextPurpose = matchedPO ? (matchedPO.purpose || "").toUpperCase() : "";

                                  const updated = payments.map(item => {
                                    if (item.id === p.id) {
                                      const nextGross = (item.gross === 0 && matchedPO?.totalAmount)
                                        ? matchedPO.totalAmount
                                        : item.gross;
                                      const nextTotal = Number((nextGross - (nextGross * (item.ewt || 0) / 100)).toFixed(2));
                                      return {
                                        ...item,
                                        completedPOId: selectedId,
                                        completedPONumber: poNum,
                                        poNumber: poNum,
                                        paymentPurpose: nextPurpose,
                                        gross: nextGross,
                                        total: nextTotal
                                      };
                                    }
                                    return item;
                                  });
                                  setPayments(updated);
                                  if (!payee && matchedPO?.supplierName) {
                                    setPayee(matchedPO.supplierName.toUpperCase());
                                  }
                                }}
                              >
                                <option value="">-- Select Completed Purchase Order --</option>
                                {eligiblePOs.map((po) => {
                                  const isStatusCompleted = ["COMPLETED", "FULLY PAID", "PAYMENT FINISHED", "CLOSED"].includes((po.status || "").toUpperCase()) || ["COMPLETED", "FULLY PAID", "PAYMENT FINISHED", "CLOSED"].includes((po.approvalStatus || "").toUpperCase());
                                  const usedInOtherPIS = slips.some((slip) =>
                                    slip.id !== selectedSlip?.id &&
                                    slip.status !== "Cancelled" &&
                                    (slip.completedPOId === po.id || slip.completedPONumber === po.poNumber || (slip.payments && slip.payments.some(pay => pay.completedPOId === po.id || pay.completedPONumber === po.poNumber)))
                                  );
                                  const usedInAnotherEntryInCurrentForm = payments.some(other => other.id !== p.id && (other.completedPOId === po.id || (other.completedPONumber && other.completedPONumber === po.poNumber)));

                                  const isUnavailable = isStatusCompleted || usedInOtherPIS || usedInAnotherEntryInCurrentForm;
                                  const statusLabel = isStatusCompleted
                                    ? " (COMPLETED)"
                                    : usedInOtherPIS
                                    ? " (ALREADY PAID)"
                                    : usedInAnotherEntryInCurrentForm
                                    ? " (SELECTED IN FORM)"
                                    : "";

                                  return (
                                    <option
                                      key={po.id}
                                      value={po.id}
                                      disabled={isUnavailable && p.completedPOId !== po.id}
                                      className={isUnavailable && p.completedPOId !== po.id ? "text-gray-400 bg-gray-100" : ""}
                                    >
                                      {po.poNumber} {po.supplierName ? ` - ${po.supplierName}` : ""}{statusLabel}
                                    </option>
                                  );
                                })}
                              </select>
                              {errors[`completedPO_${p.id}`] && <p className="text-[9px] text-rose-500 mt-0.5 font-semibold">⚠ {errors[`completedPO_${p.id}`]}</p>}
                              {p.completedPONumber && (
                                <span className="text-[10px] text-emerald-600 font-medium mt-0.5 block">
                                  Selected PO: <strong className="font-mono">{p.completedPONumber}</strong>
                                </span>
                              )}
                            </div>

                            {/* Gross */}
                            <div className="md:col-span-2">
                              <label className="block text-[10px] font-bold text-gray-500 mb-0.5 uppercase tracking-wider">Gross:</label>
                              <div className="relative">
                                <span className="absolute left-2.5 top-2 text-xs font-bold text-gray-400">₱</span>
                                <input
                                  type="number"
                                  step="any"
                                  disabled={!isEditMode}
                                  placeholder="0.00"
                                  className={`w-full text-xs pl-5 pr-1.5 p-2 border rounded-lg focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none ${
                                    errors[`gross_${p.id}`] ? "border-rose-500 bg-rose-50/20" : "border-gray-200 bg-white"
                                  }`}
                                  value={p.gross === 0 ? "" : p.gross}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? 0 : Number(e.target.value);
                                    const updated = payments.map(item => {
                                      if (item.id === p.id) {
                                        const total = Number((val - (val * (item.ewt || 0) / 100)).toFixed(2));
                                        return { ...item, gross: val, total };
                                      }
                                      return item;
                                    });
                                    setPayments(updated);
                                  }}
                                />
                              </div>
                              {errors[`gross_${p.id}`] && <p className="text-[9px] text-rose-500 mt-0.5 font-semibold">⚠ {errors[`gross_${p.id}`]}</p>}
                            </div>

                            {/* EWT */}
                            <div className="md:col-span-2">
                              <label className="block text-[10px] font-bold text-gray-500 mb-0.5 uppercase tracking-wider">EWT (%):</label>
                              <div className="relative">
                                <span className="absolute right-2.5 top-2 text-xs font-bold text-gray-400">%</span>
                                <input
                                  type="number"
                                  step="any"
                                  disabled={!isEditMode}
                                  placeholder="1"
                                  className={`w-full text-xs pl-2 pr-6 p-2 border rounded-lg focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none ${
                                    errors[`ewt_${p.id}`] ? "border-rose-500 bg-rose-50/20" : "border-gray-200 bg-white"
                                  }`}
                                  value={p.ewt === 0 ? "" : p.ewt}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? 0 : Number(e.target.value);
                                    const updated = payments.map(item => {
                                      if (item.id === p.id) {
                                        const total = Number((item.gross - (item.gross * val / 100)).toFixed(2));
                                        return { ...item, ewt: val, total };
                                      }
                                      return item;
                                    });
                                    setPayments(updated);
                                  }}
                                />
                              </div>
                              {errors[`ewt_${p.id}`] && <p className="text-[9px] text-rose-500 mt-0.5 font-semibold">⚠ {errors[`ewt_${p.id}`]}</p>}
                            </div>

                            {/* Total (derived) */}
                            <div className="md:col-span-2">
                              <label className="block text-[10px] font-bold text-gray-500 mb-0.5 uppercase tracking-wider">Net Total:</label>
                              <div className="relative">
                                <span className="absolute left-2.5 top-2 text-xs font-bold text-gray-500">₱</span>
                                <input
                                  type="text"
                                  disabled
                                  placeholder="0.00"
                                  className="w-full text-xs pl-5 pr-1.5 p-2 border border-gray-100 rounded-lg bg-gray-50 font-mono font-bold text-gray-700 outline-none"
                                  value={p.total ? new Intl.NumberFormat("en-PH").format(p.total) : "0.00"}
                                />
                              </div>
                            </div>

                            {/* 2. Payment Purpose Input (WYSIWYG Auto-Fit Editor) */}
                            <div className="md:col-span-12 mt-1">
                              <WysiwygPurposeEditor
                                id={p.id}
                                value={p.paymentPurpose || ""}
                                disabled={!isEditMode}
                                onChange={(newPurpose) => {
                                  const updated = payments.map(item => {
                                    if (item.id === p.id) {
                                      return { ...item, paymentPurpose: newPurpose };
                                    }
                                    return item;
                                  });
                                  setPayments(updated);
                                }}
                                error={errors[`paymentPurpose_${p.id}`]}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Relocated Add Payment Button at the bottom of the Entry Container */}
                      {isEditMode && (
                        <div className="pt-1 pb-1">
                          <button
                            type="button"
                            onClick={() => {
                              setPayments([
                                ...payments,
                                { id: String(Date.now()), completedPOId: "", completedPONumber: "", paymentPurpose: "", gross: 0, ewt: 1, total: 0 }
                              ]);
                            }}
                            className="text-xs font-semibold px-3 py-1.5 bg-smei-crimson text-white rounded-lg hover:bg-smei-crimson/90 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Payment
                          </button>
                        </div>
                      )}

                      {/* Cumulative summary display */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white p-3 rounded-lg border border-gray-100 shadow-sm text-xs font-semibold text-gray-600">
                        <div>
                          <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Total Gross:</span>
                          <span className="font-mono text-gray-800 text-sm">₱{new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2 }).format(gross)}</span>
                        </div>
                        <div>
                          <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Total EWT:</span>
                          <span className="font-mono text-gray-800 text-sm">₱{new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2 }).format(ewt)}</span>
                        </div>
                        <div>
                          <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Total Amount (Net):</span>
                          <span className="font-mono text-smei-crimson text-sm font-bold">₱{new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2 }).format(total)}</span>
                        </div>
                        <div>
                          <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Count:</span>
                          <span className="font-mono text-gray-800 text-sm">{payments.length}</span>
                        </div>
                      </div>
                    </div>

                    {/* Schedule Date */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Schedule Date to Pay: *</label>
                      <input
                        type="date"
                        required
                        disabled={!isEditMode}
                        className={`w-full text-sm p-2 border rounded-lg focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none ${
                          errors.scheduleDate ? "border-rose-500 bg-rose-50/20" : "border-gray-200"
                        }`}
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                      />
                      {errors.scheduleDate && <p className="text-[10px] text-rose-500 mt-0.5 font-semibold">{errors.scheduleDate}</p>}
                    </div>

                    {/* Blank element to balance row */}
                    <div className="hidden md:block"></div>

                    {/* Consolidated Time, Payment Mode, and Currency Row */}
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Schedule Time */}
                      <div className="flex gap-2">
                        <div className="w-2/3">
                          <label className="block text-xs font-bold text-gray-700 mb-1">Time:</label>
                          <input
                            type="time"
                            disabled={!isEditMode}
                            className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none"
                            value={scheduleTime}
                            onChange={(e) => setScheduleTime(e.target.value)}
                          />
                        </div>
                        <div className="w-1/3">
                          <label className="block text-xs font-bold text-gray-700 mb-1">AM/PM:</label>
                          <select
                            disabled={!isEditMode}
                            className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson bg-white outline-none"
                            value={ampm}
                            onChange={(e: any) => setAmpm(e.target.value)}
                          >
                            <option value="AM">AM</option>
                            <option value="PM">PM</option>
                          </select>
                        </div>
                      </div>

                      {/* Payment Mode */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Payment Mode:</label>
                        <div className="flex gap-2">
                          <select
                            disabled={!isEditMode}
                            className="w-1/2 text-sm p-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson bg-white outline-none"
                            value={paymentMode}
                            onChange={(e: any) => setPaymentMode(e.target.value)}
                          >
                            <option value="Cash">Cash</option>
                            <option value="Check Crossed">Check Crossed</option>
                            <option value="Check Not Crossed">Check Not Crossed</option>
                            <option value="T/T">T/T</option>
                            <option value="Others">Others</option>
                          </select>
                          {paymentMode === "Others" && (
                            <input
                              type="text"
                              required
                              disabled={!isEditMode}
                              placeholder="Specify mode"
                              className="w-1/2 text-sm p-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson"
                              value={paymentModeOthers}
                              onChange={(e) => setPaymentModeOthers(e.target.value)}
                            />
                          )}
                        </div>
                      </div>

                      {/* Currency */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Currency:</label>
                        <div className="flex gap-2">
                          <select
                            disabled={!isEditMode}
                            className="w-1/2 text-sm p-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson bg-white outline-none"
                            value={currency}
                            onChange={(e: any) => setCurrency(e.target.value)}
                          >
                            <option value="PHP">PHP</option>
                            <option value="USD">USD</option>
                            <option value="JP Yen">JP Yen</option>
                            <option value="Others">Others</option>
                          </select>
                          {currency === "Others" && (
                            <input
                              type="text"
                              required
                              disabled={!isEditMode}
                              placeholder="Specify"
                              className="w-1/2 text-sm p-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson"
                              value={currencyOthers}
                              onChange={(e) => setCurrencyOthers(e.target.value)}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Remarks / Narrative (Increased width to col-span-2) */}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Remarks / Narrative</label>
                      <input
                        type="text"
                        disabled={!isEditMode}
                        placeholder="e.g. For structural casting downpayment"
                        className="w-full text-sm p-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Signatories Section */}
                  <div className="border-t border-gray-100 pt-4 mt-2">
                    <h4 className="text-xs font-bold text-smei-darkred uppercase tracking-wide mb-3">Signatories & Authorizations</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Requested By:</label>
                        <input
                          type="text"
                          disabled={!isEditMode}
                          className="w-full text-sm p-2 border border-gray-200 rounded-lg bg-gray-50/50"
                          value={requestedBy}
                          onChange={(e) => setRequestedBy(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Checked & Verified By:</label>
                        <input
                          type="text"
                          disabled={!isEditMode}
                          className="w-full text-sm p-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson"
                          value={checkedAndVerifiedBy}
                          onChange={(e) => setCheckedAndVerifiedBy(e.target.value)}
                          placeholder="Name of verifier"
                        />
                        <div className="mt-1.5">
                          <label className="block text-[10px] uppercase font-bold text-gray-400 mb-0.5">Position:</label>
                          <input
                            type="text"
                            disabled={!isEditMode}
                            className="w-full text-xs p-1.5 border border-gray-200 rounded-md outline-none focus:ring-1 focus:ring-smei-crimson"
                            value={checkedAndVerifiedByPosition}
                            onChange={(e) => setCheckedAndVerifiedByPosition(e.target.value)}
                            placeholder="Position"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Acceptance and Verification Section */}
                  <div className="border-t border-dashed border-gray-300 my-4 pt-4">
                    {/* Notice Text */}
                    <div className="text-center bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 mb-4 font-semibold text-xs tracking-wide">
                      ⚠ For Encashment and Irregular Transactions Only
                    </div>
                    
                    <h4 className="text-xs font-bold text-smei-darkred uppercase tracking-wide mb-3">Acceptance and Verification</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left Column: Accepted By */}
                      <div className="space-y-2 border border-gray-100 rounded-lg p-3 bg-gray-50/30">
                        <label className="block text-[10px] uppercase font-bold text-gray-600 mb-1">Accepted By:</label>
                        <input
                          type="text"
                          disabled={!isEditMode}
                          className="w-full text-sm p-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-smei-crimson"
                          value={acceptedBy}
                          onChange={(e) => setAcceptedBy(e.target.value)}
                          placeholder="Name of accepting officer"
                        />
                        <div className="mt-1.5">
                          <label className="block text-[10px] uppercase font-bold text-gray-400 mb-0.5">Position:</label>
                          <input
                            type="text"
                            disabled={!isEditMode}
                            className="w-full text-xs p-1.5 border border-gray-200 rounded-md outline-none focus:ring-1 focus:ring-smei-crimson"
                            value={acceptedByPosition}
                            onChange={(e) => setAcceptedByPosition(e.target.value)}
                            placeholder="Position"
                          />
                        </div>
                      </div>

                      {/* Right Column: Verified By */}
                      <div className="space-y-2 border border-gray-100 rounded-lg p-3 bg-gray-50/30">
                        <label className="block text-[10px] uppercase font-bold text-gray-600 mb-1">Verified By:</label>
                        <input
                          type="text"
                          disabled={!isEditMode}
                          className="w-full text-sm p-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-smei-crimson"
                          value={verifiedBy}
                          onChange={(e) => setVerifiedBy(e.target.value)}
                          placeholder="Name of verifier"
                        />
                        <div className="mt-1.5">
                          <label className="block text-[10px] uppercase font-bold text-gray-400 mb-0.5">Position:</label>
                          <input
                            type="text"
                            disabled={!isEditMode}
                            className="w-full text-xs p-1.5 border border-gray-200 rounded-md outline-none focus:ring-1 focus:ring-smei-crimson"
                            value={verifiedByPosition}
                            onChange={(e) => setVerifiedByPosition(e.target.value)}
                            placeholder="Position"
                          />
                        </div>
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
                        Save Changes
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
