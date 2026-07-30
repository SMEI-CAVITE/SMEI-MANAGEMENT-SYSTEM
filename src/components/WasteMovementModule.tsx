import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  X, 
  CheckCircle, 
  FileSpreadsheet, 
  FileText, 
  AlertCircle,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Shield,
  Layers
} from "lucide-react";
import { exportExcelWithTemplate } from "../utils/templateExport";
import { getTsdExportFilename } from "../utils/tsdFilename";
import { formatControlNumber, validateControlNumber, getTrackingCode, normalizeControlNo } from "../utils/controlNumber";
import { RcNumberInput } from "./RcNumberInput";
import { attachRecordToWorkflow, setActiveWorkflow, getActiveWorkflow, getAllWorkflows, WorkflowRecord } from "../utils/workflowManager";
import { notificationRepository } from "../services/notificationRepository";
import { safeSetLocalStorage } from "../utils/heavyStorage";
import { uploadDocumentFile, deleteDocumentFile, getDocumentUrl } from "../services/storageService";
import { WorkflowRepository } from "../services/workflowRepository";

export function formatQuantityDisplay(qty: any): string {
  if (qty === null || qty === undefined || String(qty).trim() === "") return "-";
  const num = Number(qty);
  if (isNaN(num)) return String(qty).trim() || "-";
  return num.toFixed(5);
}

// Self-contained IndexedDB utility inside WasteMovementModule.tsx
const DB_NAME = "smei_waste_movement_db";
const STORE_NAME = "files";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB is not supported in this environment."));
        return;
      }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
}

async function saveFileToIndexedDB(key: string, value: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getFileFromIndexedDB(key: string): Promise<string> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result || "");
    request.onerror = () => reject(request.error);
  });
}

async function deleteFileFromIndexedDB(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export interface WasteMovementMethodEntry {
  method: string;
  quantity: number;
  destination: string;
  remarks?: string;
}

export interface WasteMovementRecord {
  id: string;
  breakdownId: string;
  breakdownManifestNo: string;
  controlNo?: string;
  caNumber?: string;
  breakdownClient: string;
  breakdownDate: string;
  transportDate: string; // YYYY-MM-DD
  crdNo: string;
  rcNo: string;
  signedBy: string;
  notedBy: string;
  sourceFileName: string; // COA Document
  sourceFileData: string; // Base64
  storagePath?: string;
  downloadUrl?: string;
  uploadedBy?: string;
  uploadedAt?: string;
  quantity1: number; // Export for recovery (MT)
  quantity2: number; // Disposal (MT)
  quantity3: number; // Recycling/Recovery (MT)
  totalQty: number;  // Computed sum of quantity1 + quantity2 + quantity3
  dateTime: string;
  status: string; // "Completed" etc.
  methods?: WasteMovementMethodEntry[]; // Legacy compatibility
  workflowId?: string;
}

// Compute authoritative quantities from Hazardous Waste Breakdown record
export function computeBreakdownQuantities(breakdown: any) {
  if (!breakdown) {
    return { quantity1: 0, quantity2: 0, quantity3: 0, totalQty: 0 };
  }

  let totalHazKg = 0;
  let totalTsdKg = 0;
  let totalNonHazKg = 0;

  if (Array.isArray(breakdown.items) && breakdown.items.length > 0) {
    totalHazKg = breakdown.items.reduce((sum: number, item: any) => sum + (Number(item.haz_waste) || 0), 0);
    totalTsdKg = breakdown.items.reduce((sum: number, item: any) => sum + (Number(item.local_tsd) || 0), 0);
    totalNonHazKg = breakdown.items.reduce((sum: number, item: any) => sum + (Number(item.non_haz) || 0), 0);
  } else {
    totalHazKg = Number(breakdown.totalHaz ?? breakdown.totalHazWaste ?? breakdown.haz_waste ?? (breakdown.quantity1 ? breakdown.quantity1 * 1000 : 0));
    totalTsdKg = Number(breakdown.totalTsd ?? breakdown.totalLocalTsd ?? breakdown.local_tsd ?? (breakdown.quantity2 ? breakdown.quantity2 * 1000 : 0));
    totalNonHazKg = Number(breakdown.totalNonHaz ?? breakdown.non_haz ?? (breakdown.quantity3 ? breakdown.quantity3 * 1000 : 0));
  }

  // QUANTITY_1 = TOTAL_HAZ_WASTE ÷ 1000 (Conversion to Metric Tons only, no business rounding)
  // QUANTITY_2 = TOTAL_LOCAL_TSD ÷ 1000
  // QUANTITY_3 = TOTAL_NON_HAZ ÷ 1000
  const qty1 = totalHazKg / 1000;
  const qty2 = totalTsdKg / 1000;
  const qty3 = totalNonHazKg / 1000;

  // TOTAL_QTY = QUANTITY_1 + QUANTITY_2 + QUANTITY_3 (direct sum)
  const totalQty = Number((qty1 + qty2 + qty3).toFixed(5));

  return {
    quantity1: qty1,
    quantity2: qty2,
    quantity3: qty3,
    totalQty: totalQty
  };
}

// Helper function to determine if RC Number is required based on breakdown contents
export function requiresRcNumber(breakdown: any): boolean {
  if (!breakdown) return false;

  // If breakdown has items array (raw breakdown object)
  if (Array.isArray(breakdown.items)) {
    const totalTsdKg = breakdown.items.reduce((sum: number, item: any) => sum + (Number(item.local_tsd) || 0), 0);
    const totalNonHazKg = breakdown.items.reduce((sum: number, item: any) => sum + (Number(item.non_haz) || 0), 0);
    return totalTsdKg > 0 || totalNonHazKg > 0;
  }

  // Check calculated or direct properties
  const totalLocalTsd = Number(
    breakdown.totalLocalTsd ??
    breakdown.quantity2 ??
    breakdown.totalTsd ??
    breakdown.local_tsd ??
    0
  );
  const totalNonHaz = Number(
    breakdown.totalNonHaz ??
    breakdown.quantity3 ??
    breakdown.non_haz ??
    0
  );

  return totalLocalTsd > 0 || totalNonHaz > 0;
}

export default function WasteMovementModule() {
  const [movements, setMovements] = useState<WasteMovementRecord[]>([]);
  const [breakdownRecords, setBreakdownRecords] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);

  // Sorting state
  const [sortField, setSortField] = useState<keyof WasteMovementRecord>("transportDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

  // Modal Form Fields
  const [formBreakdownId, setFormBreakdownId] = useState("");
  const [formBreakdownDetails, setFormBreakdownDetails] = useState<any | null>(null);
  const [isBreakdownDropdownOpen, setIsBreakdownDropdownOpen] = useState(false);
  const [breakdownSearchQuery, setBreakdownSearchQuery] = useState("");
  const breakdownDropdownRef = React.useRef<HTMLDivElement>(null);

  // Auto-selection state
  const [isAutoSelected, setIsAutoSelected] = useState(false);
  const [autoSelectedControlNo, setAutoSelectedControlNo] = useState("");

  const [formQuantity1, setFormQuantity1] = useState(0);
  const [formQuantity2, setFormQuantity2] = useState(0);
  const [formQuantity3, setFormQuantity3] = useState(0);
  const [formTotalQty, setFormTotalQty] = useState(0);

  const [formTransportDate, setFormTransportDate] = useState("");
  const [formCrdNo, setFormCrdNo] = useState("");
  const [formRcNo, setFormRcNo] = useState("N/A");
  const [rcError, setRcError] = useState("");
  const [formSignedBy, setFormSignedBy] = useState("ENGR. MARY ANN PEDROSO");
  const [formNotedBy, setFormNotedBy] = useState("APRILYN ROGADOR");
  const [formSourceFileName, setFormSourceFileName] = useState("");
  const [formSourceFileData, setFormSourceFileData] = useState("");

  // Close breakdown dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (breakdownDropdownRef.current && !breakdownDropdownRef.current.contains(event.target as Node)) {
        setIsBreakdownDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Real-time synchronization event listener
  useEffect(() => {
    const handleDataChanged = () => {
      loadBreakdownRecords();
    };
    window.addEventListener("tsd_data_changed", handleDataChanged);
    return () => window.removeEventListener("tsd_data_changed", handleDataChanged);
  }, []);

  // Warnings / Error messages
  const [showFileWarning, setShowFileWarning] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Local Notifications state
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
  };

  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Load Breakdown records from localStorage
  const loadBreakdownRecords = () => {
    const saved = localStorage.getItem("tsd_hazwaste_records");
    if (saved) {
      try {
        setBreakdownRecords(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse hazardous waste breakdown records", e);
      }
    }
  };

  useEffect(() => {
    loadBreakdownRecords();
  }, []);

  const handleMovementSelect = (rec: WasteMovementRecord) => {
    setSelectedMovementId(rec.id);
    const activeWf = getActiveWorkflow();
    const allWorkflows = getAllWorkflows();
    const code = rec.controlNo || rec.caNumber || rec.breakdownManifestNo;

    let targetWf = rec.workflowId ? allWorkflows.find((w) => w.id === rec.workflowId) : null;
    if (!targetWf && code) {
      targetWf = allWorkflows.find((w) => w.controlNo && normalizeControlNo(w.controlNo) === normalizeControlNo(code)) || null;
    }

    if (!targetWf) {
      targetWf = attachRecordToWorkflow("waste-movement", rec, code);
    }

    if (targetWf && targetWf.id) {
      if (!activeWf || targetWf.id !== activeWf.id) {
        setActiveWorkflow(targetWf.id, targetWf.controlNo);
        window.dispatchEvent(new Event("tsd_data_changed"));
        window.dispatchEvent(new Event("tsd_workflows_updated"));
      }
    }
  };

  // Load ledger from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem("tsd_waste_movements");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as WasteMovementRecord[];
        setMovements(parsed);
        if (parsed.length > 0) {
          const activeWf = getActiveWorkflow();
          const match = activeWf
            ? parsed.find(
                (r: any) =>
                  r.workflowId === activeWf.id ||
                  (activeWf.controlNo &&
                    (r.controlNo || r.caNumber || r.breakdownManifestNo) &&
                    normalizeControlNo(r.controlNo || r.caNumber || r.breakdownManifestNo) === normalizeControlNo(activeWf.controlNo))
              )
            : null;
          setSelectedMovementId(match ? match.id : parsed[0].id);
        }
      } catch (e) {
        console.error("Failed to load waste movements", e);
      }
    } else {
      const initial: WasteMovementRecord[] = [
        {
          id: "wm-1",
          breakdownId: "MAN-2026-018",
          breakdownManifestNo: "M-R4A-2026-07-0028",
          breakdownClient: "Cavite Semiconductor Corp.",
          breakdownDate: "2026-07-13",
          transportDate: "2026-07-13",
          crdNo: "CRD-06-1309-26",
          rcNo: "N/A",
          signedBy: "ENGR. MARY ANN PEDROSO",
          notedBy: "APRILYN ROGADOR",
          sourceFileName: "COA_Delivery_Slip_048.pdf",
          sourceFileData: "data:application/pdf;base64,JVBERi0xLjQK...", 
          quantity1: 0,
          quantity2: 3.600,
          quantity3: 0.900,
          totalQty: 4.500,
          dateTime: "2026-07-13 09:15 AM",
          status: "Completed"
        }
      ];
      setMovements(initial);
      setSelectedMovementId(initial[0].id);
      try {
        localStorage.setItem("tsd_waste_movements", JSON.stringify(initial));
      } catch (err) {
        console.error("Initial seed of movements failed", err);
      }
    }
  }, []);

  const saveToStorage = (updated: WasteMovementRecord[]) => {
    setMovements(updated);
    safeSetLocalStorage("tsd_waste_movements", JSON.stringify(updated));
    if (updated && updated.length > 0) {
      const activeCa = updated[0].controlNo || updated[0].caNumber || updated[0].breakdownManifestNo;
      if (activeCa) {
        safeSetLocalStorage("tsd_active_control_no", activeCa.toUpperCase());
      }
    }

    window.dispatchEvent(new Event("tsd_data_changed"));
    window.dispatchEvent(new Event("tsd_workflows_updated"));
    window.dispatchEvent(new Event("tsd_storage_updated"));
  };

  // Format filename helper
  const getFormattedFilename = (dateStr: string, ext: string = "xlsm"): string => {
    return getTsdExportFilename("waste-movement", dateStr, ext);
  };

  // Validation checkers
  const validateCrdNumber = (num: string): boolean => {
    return /^CRD-\d{2}-\d{4}-\d{2}$/.test(num);
  };

  // Dropdown selection handler for Breakdown Record
  const handleSelectBreakdown = (breakdownId: string, isAuto: boolean = false) => {
    setFormBreakdownId(breakdownId);
    setIsAutoSelected(isAuto);
    if (!isAuto) {
      setAutoSelectedControlNo("");
    }
    const selected = breakdownRecords.find(b => b.id === breakdownId);
    if (selected) {
      const totals = computeBreakdownQuantities(selected);
      setFormQuantity1(totals.quantity1);
      setFormQuantity2(totals.quantity2);
      setFormQuantity3(totals.quantity3);
      setFormTotalQty(totals.totalQty);
      setFormBreakdownDetails(selected);

      if (!requiresRcNumber(selected)) {
        setFormRcNo("N/A");
      } else {
        if (formRcNo === "N/A") {
          setFormRcNo("");
        }
      }
    } else {
      setFormQuantity1(0);
      setFormQuantity2(0);
      setFormQuantity3(0);
      setFormTotalQty(0);
      setFormBreakdownDetails(null);
      setFormRcNo("N/A");
    }
  };

  // Auto-selection effect when modal opens for new records or breakdown records update
  useEffect(() => {
    if (isModalOpen && !editingRecordId && !formBreakdownId && breakdownRecords.length > 0) {
      const activeControlNo = localStorage.getItem("tsd_active_control_no") || "";
      let autoMatch = null;
      if (activeControlNo) {
        autoMatch = breakdownRecords.find(b => getTrackingCode(b) === activeControlNo);
      }
      if (!autoMatch && breakdownRecords.length > 0) {
        autoMatch = breakdownRecords[0];
      }
      if (autoMatch) {
        handleSelectBreakdown(autoMatch.id, true);
        setIsAutoSelected(true);
        setAutoSelectedControlNo(activeControlNo || getTrackingCode(autoMatch));
      }
    }
  }, [isModalOpen, editingRecordId, breakdownRecords, formBreakdownId]);

  // File Upload Drag & Drop handlers for COA
  const processSourceFile = (file: File) => {
    const allowedExtensions = ["pdf", "docx", "png", "jpg", "jpeg"];
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!allowedExtensions.includes(ext)) {
      alert("Invalid file format. Supported formats are PDF, DOCX, PNG, JPG, and JPEG.");
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB limit
    if (file.size > maxSize) {
      alert("File size exceeds 10MB limit. Please upload a smaller file.");
      return;
    }

    setFormSourceFileName(file.name);
    setShowFileWarning(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      setFormSourceFileData(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSourceFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSourceFile(file);
    }
  };

  // Create new record modal trigger
  const handleCreateNew = () => {
    loadBreakdownRecords();
    setEditingRecordId(null);
    setIsBreakdownDropdownOpen(false);
    setBreakdownSearchQuery("");
    setIsAutoSelected(false);
    setAutoSelectedControlNo("");

    // Determine active Control Number
    const activeControlNo = localStorage.getItem("tsd_active_control_no") || "";
    const savedHaz = localStorage.getItem("tsd_hazwaste_records");
    const currentHaz: any[] = savedHaz ? JSON.parse(savedHaz) : [];

    let autoMatch = null;
    if (activeControlNo && currentHaz.length > 0) {
      autoMatch = currentHaz.find(b => getTrackingCode(b) === activeControlNo);
    }
    if (!autoMatch && currentHaz.length > 0) {
      autoMatch = currentHaz[0];
    }

    if (autoMatch) {
      handleSelectBreakdown(autoMatch.id, true);
      setIsAutoSelected(true);
      setAutoSelectedControlNo(activeControlNo || getTrackingCode(autoMatch));
    } else {
      setFormBreakdownId("");
      setFormBreakdownDetails(null);
      setFormQuantity1(0);
      setFormQuantity2(0);
      setFormQuantity3(0);
      setFormTotalQty(0);
      setFormRcNo("N/A");
    }

    setFormTransportDate(new Date().toISOString().split("T")[0]);
    setFormCrdNo("");
    setRcError("");
    setFormSignedBy("ENGR. MARY ANN PEDROSO");
    setFormNotedBy("APRILYN ROGADOR");
    setFormSourceFileName("");
    setFormSourceFileData("");
    setShowFileWarning(false);
    setIsModalOpen(true);
  };

  // Edit record trigger
  const handleEditRecord = async (rec: WasteMovementRecord) => {
    loadBreakdownRecords();
    setEditingRecordId(rec.id);
    setFormBreakdownId(rec.breakdownId || "");
    setIsBreakdownDropdownOpen(false);
    setBreakdownSearchQuery("");
    setIsAutoSelected(false);
    setAutoSelectedControlNo("");
    
    const matchedBreakdown = breakdownRecords.find(b => b.id === rec.breakdownId);
    const breakdownData = matchedBreakdown || (rec.breakdownManifestNo ? {
      manifestNo: rec.breakdownManifestNo,
      client: rec.breakdownClient,
      date: rec.breakdownDate,
      quantity2: rec.quantity2,
      quantity3: rec.quantity3
    } : { quantity2: rec.quantity2, quantity3: rec.quantity3 });

    if (matchedBreakdown) {
      setFormBreakdownDetails(matchedBreakdown);
    } else if (rec.breakdownManifestNo) {
      setFormBreakdownDetails(breakdownData);
    }

    setFormQuantity1(rec.quantity1 || 0);
    setFormQuantity2(rec.quantity2 || 0);
    setFormQuantity3(rec.quantity3 || 0);
    setFormTotalQty(rec.totalQty || 0);

    setFormTransportDate(rec.transportDate);
    setFormCrdNo((rec.crdNo || "").toUpperCase());

    const rcNeeded = requiresRcNumber(breakdownData);
    if (!rcNeeded) {
      setFormRcNo("N/A");
      setRcError("");
    } else {
      const existingRc = (rec.rcNo || "").toUpperCase();
      const loadedRc = existingRc === "N/A" ? "" : existingRc;
      setFormRcNo(loadedRc);
      if (loadedRc) {
        const rcVal = validateControlNumber(loadedRc, "rcNumber");
        setRcError(rcVal.isValid ? "" : rcVal.error || "Invalid Recycle Cert No. Expected format: R-123 (e.g., R-932, R-15402).");
      } else {
        setRcError("");
      }
    }

    setFormSignedBy(rec.signedBy);
    setFormNotedBy(rec.notedBy);
    setFormSourceFileName(rec.sourceFileName);
    
    let fileData = "";
    try {
      fileData = await getFileFromIndexedDB(`tsd_wm_file_${rec.id}`);
    } catch (err) {
      console.warn("IndexedDB fetch failed, falling back", err);
    }
    if (!fileData) {
      fileData = localStorage.getItem(`tsd_wm_file_${rec.id}`) || rec.sourceFileData || "";
    }
    setFormSourceFileData(fileData);
    setShowFileWarning(false);
    setIsModalOpen(true);
  };

  // Save changes/Submit form
  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();

    // RULE 1: Hazardous Waste Breakdown MUST be selected
    if (!formBreakdownId) {
      alert("Validation Error: A Hazardous Waste Breakdown record must be selected as the authoritative source.");
      showNotification("Validation Error: Hazardous Waste Breakdown selection is required.", "error");
      return;
    }

    // RULE 2: COA Document MUST be uploaded
    if (!formSourceFileName) {
      setShowFileWarning(true);
      alert("Validation Error: A COA (Certificate of Analysis) source document must be uploaded.");
      showNotification("Validation Error: COA document upload is required.", "error");
      return;
    }

    // RULE 3: Signatories MUST be provided
    if (!formSignedBy.trim() || !formNotedBy.trim()) {
      alert("Validation Error: Document must be signed by required signatories (Signed By & Noted By).");
      showNotification("Validation Error: Required signatories missing.", "error");
      return;
    }

    // RULE 4: CRD Number validation
    if (!validateCrdNumber(formCrdNo)) {
      alert("Validation Error: Invalid CRD Number format. Please use the pattern: CRD-XX-XXXX-XX");
      return;
    }

    // RULE 5: RC Number validation based on selected breakdown methods
    const selectedBreakdown = breakdownRecords.find(b => b.id === formBreakdownId);
    const currentBreakdownData = selectedBreakdown || formBreakdownDetails || { quantity2: formQuantity2, quantity3: formQuantity3 };
    const isRcRequired = requiresRcNumber(currentBreakdownData);

    if (isRcRequired) {
      if (!formRcNo.trim() || formRcNo.trim().toUpperCase() === "N/A") {
        setRcError("RC Number is required because the selected breakdown contains Disposal or Recycling/Recovery quantities.");
        alert("RC Number is required because the selected breakdown contains Disposal or Recycling/Recovery quantities.");
        showNotification("RC Number is required because the selected breakdown contains Disposal or Recycling/Recovery quantities.", "error");
        return;
      }
      const rcVal = validateControlNumber(formRcNo, "rcNumber");
      if (!rcVal.isValid) {
        const err = rcVal.error || "Invalid Recycle Cert No. Expected format: R-123 (e.g., R-932, R-15402).";
        setRcError(err);
        alert(`Validation Error: ${err}`);
        showNotification(err, "error");
        return;
      }
    }

    const finalRcNo = isRcRequired ? formRcNo.trim().toUpperCase() : "N/A";

    const now = new Date();
    const formattedDateTime = now.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric"
    }) + " " + now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });

    const targetId = editingRecordId || `wm-${Date.now()}`;
    const fileKey = `tsd_wm_file_${targetId}`;

    try {
      await saveFileToIndexedDB(fileKey, formSourceFileData);
    } catch (idbErr) {
      try {
        localStorage.setItem(fileKey, formSourceFileData);
      } catch (lsErr) {
        console.error("Storage save failed", lsErr);
      }
    }

    const finalSignedBy = formSignedBy.trim().toUpperCase() || "ENGR. MARY ANN PEDROSO";
    const finalNotedBy = formNotedBy.trim().toUpperCase() || "APRILYN ROGADOR";

    const breakdownManifestNo = selectedBreakdown?.manifestNo || formBreakdownDetails?.manifestNo || "N/A";
    const resolvedControlNo = getTrackingCode(selectedBreakdown) || getTrackingCode(formBreakdownDetails) || breakdownManifestNo;
    const breakdownClient = selectedBreakdown?.client || formBreakdownDetails?.client || "N/A";
    const breakdownDate = selectedBreakdown?.date || formBreakdownDetails?.date || formTransportDate;

    // Methods structure for backward compatibility
    const methodsList: WasteMovementMethodEntry[] = [
      { method: "Export for recovery", quantity: formQuantity1, destination: "Off-shore Treater", remarks: "" },
      { method: "Disposal", quantity: formQuantity2, destination: "Disposal by SMEI", remarks: "" },
      { method: "Recycling/Recovery", quantity: formQuantity3, destination: "Local/Offshore", remarks: "" }
    ].filter(m => m.quantity > 0);

    let storagePath = "";
    let downloadUrl = "";
    if (formSourceFileData) {
      try {
        const uRes = await uploadDocumentFile(
          formSourceFileData,
          `waste-movement/${resolvedControlNo}`,
          formSourceFileName || "COA_Document.pdf",
          "system"
        );
        storagePath = uRes.storagePath;
        downloadUrl = uRes.downloadUrl;
      } catch (uErr) {
        console.warn("[WasteMovementStorage] Firebase Storage upload fallback:", uErr);
      }
    }

    let targetRecord: WasteMovementRecord;
    let targetWf: WorkflowRecord;

    if (editingRecordId) {
      const existing = movements.find(m => m.id === editingRecordId);
      targetRecord = {
        ...(existing || {} as WasteMovementRecord),
        id: editingRecordId,
        breakdownId: formBreakdownId,
        breakdownManifestNo,
        controlNo: resolvedControlNo,
        caNumber: resolvedControlNo,
        breakdownClient,
        breakdownDate,
        transportDate: formTransportDate,
        crdNo: formCrdNo,
        rcNo: finalRcNo,
        signedBy: finalSignedBy,
        notedBy: finalNotedBy,
        quantity1: formQuantity1,
        quantity2: formQuantity2,
        quantity3: formQuantity3,
        totalQty: formTotalQty,
        sourceFileName: formSourceFileName,
        storagePath: storagePath || existing?.storagePath,
        downloadUrl: downloadUrl || existing?.downloadUrl,
        uploadedAt: new Date().toISOString(),
        methods: methodsList
      };
      try {
        targetWf = attachRecordToWorkflow("waste-movement", targetRecord, resolvedControlNo);
      } catch (err: any) {
        alert(err.message || "No active workflow is selected. Please select or create a workflow before saving this document.");
        return;
      }

      // Save to Firestore FIRST
      try {
        await WorkflowRepository.saveWasteMovementRecord(targetRecord);
      } catch (fsErr: any) {
        console.error("[WasteMovementModule] Failed to save record to Firestore:", fsErr);
        alert("Firestore Persistence Error: Unable to save waste movement record to database. Please check your network connection and try again.");
        return;
      }

      const updated = movements.map(m => m.id === editingRecordId ? targetRecord : m);
      saveToStorage(updated);
      showNotification("Waste movement summary document updated successfully.", "success");
    } else {
      targetRecord = {
        id: targetId,
        breakdownId: formBreakdownId,
        breakdownManifestNo,
        controlNo: resolvedControlNo,
        caNumber: resolvedControlNo,
        breakdownClient,
        breakdownDate,
        transportDate: formTransportDate,
        crdNo: formCrdNo,
        rcNo: finalRcNo,
        signedBy: finalSignedBy,
        notedBy: finalNotedBy,
        sourceFileName: formSourceFileName,
        sourceFileData: "",
        storagePath,
        downloadUrl,
        uploadedAt: new Date().toISOString(),
        quantity1: formQuantity1,
        quantity2: formQuantity2,
        quantity3: formQuantity3,
        totalQty: formTotalQty,
        methods: methodsList,
        dateTime: formattedDateTime,
        status: "Completed"
      };
      try {
        targetWf = attachRecordToWorkflow("waste-movement", targetRecord, resolvedControlNo);
      } catch (err: any) {
        alert(err.message || "No active workflow is selected. Please select or create a workflow before saving this document.");
        return;
      }

      // Save to Firestore FIRST
      try {
        await WorkflowRepository.saveWasteMovementRecord(targetRecord);
      } catch (fsErr: any) {
        console.error("[WasteMovementModule] Failed to save record to Firestore:", fsErr);
        alert("Firestore Persistence Error: Unable to save waste movement record to database. Please check your network connection and try again.");
        return;
      }

      saveToStorage([targetRecord, ...movements]);
      setSelectedMovementId(targetId);
      showNotification("Waste movement summary document created successfully.", "success");
    }

    notificationRepository.createNotification({
      portal: "TSD",
      module: "waste-movement",
      workflowId: targetWf.id,
      documentId: targetRecord.id,
      documentNumber: resolvedControlNo,
      title: editingRecordId ? "Waste Movement Record Updated" : "Waste Movement Summary Completed",
      message: `Waste movement summary ${editingRecordId ? 'updated' : 'completed'} for Workflow ${targetWf.workflowCode || targetWf.id} (Control No: ${resolvedControlNo}).`,
      priority: "HIGH"
    }).catch(() => {});

    setIsModalOpen(false);
  };

  // Delete transaction
  const handleDeleteRecord = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to permanently delete this waste movement summary document?")) {
      const targetDoc = movements.find(m => m.id === id);
      if (targetDoc?.storagePath) {
        try {
          await deleteDocumentFile(targetDoc.storagePath);
        } catch (storageErr) {
          console.warn("[WasteMovementModule] Storage file deletion warning:", storageErr);
        }
      }
      try {
        await WorkflowRepository.deleteWasteMovementRecord(id);
      } catch (fsErr) {
        console.error("[WasteMovementModule] Failed to delete record from Firestore:", fsErr);
      }
      const updated = movements.filter(m => m.id !== id);
      saveToStorage(updated);
      try {
        await deleteFileFromIndexedDB(`tsd_wm_file_${id}`);
      } catch (err) {
        console.warn("IndexedDB delete failed", err);
      }
      localStorage.removeItem(`tsd_wm_file_${id}`);
      if (selectedMovementId === id) {
        setSelectedMovementId(updated.length > 0 ? updated[0].id : null);
      }
      showNotification("Waste movement summary document deleted successfully.", "success");
    }
  };

  // Export Excel handler
  const handleExportExcel = async (rec: WasteMovementRecord) => {
    // Validate required fields before exporting
    if (!rec.breakdownId && !rec.breakdownManifestNo) {
      alert("Export Blocked: This Waste Movement document lacks a reference to an authoritative Hazardous Waste Breakdown record.");
      return;
    }
    if (!rec.sourceFileName) {
      alert("Export Blocked: A COA source document must be uploaded before exporting.");
      return;
    }
    if (!rec.signedBy || !rec.notedBy) {
      alert("Export Blocked: Document must be signed by required signatories before exporting.");
      return;
    }

    const q1 = rec.quantity1 || 0;
    const q2 = rec.quantity2 || 0;
    const q3 = rec.quantity3 || 0;

    const exportData = {
      TRANSPORT_DATE: rec.transportDate || "",
      RECYCLE_NO: rec.rcNo || "N/A",
      CRD_NO: rec.crdNo || "",
      SIGNED_BY: rec.signedBy || "ENGR. MARY ANN PEDROSO",
      SIGNED_POSITION: "Pollution Control Officer",
      NOTED_BY: rec.notedBy || "APRILYN ROGADOR",
      NOTED_POSITION: "Asst. Admin/Technical Manager",
      TOTAL_QTY: formatQuantityDisplay(rec.totalQty),
      
      METHOD_1: "Export for recovery",
      QUANTITY_1: formatQuantityDisplay(q1),
      DESTINATION_1: "Off-shore Treater",
      REMARKS_1: q1 > 0 ? (rec.sourceFileName || "COA Verified") : "",

      METHOD_2: "Disposal",
      QUANTITY_2: formatQuantityDisplay(q2),
      DESTINATION_2: "Disposal by SMEI",
      REMARKS_2: q2 > 0 ? (rec.sourceFileName || "COA Verified") : "",

      METHOD_3: "Recycling/Recovery",
      QUANTITY_3: formatQuantityDisplay(q3),
      DESTINATION_3: "Local/Offshore",
      REMARKS_3: q3 > 0 ? (rec.sourceFileName || "COA Verified") : ""
    };

    const outputFilename = getFormattedFilename(rec.transportDate, "xlsm");

    try {
      await exportExcelWithTemplate(
        "WASTE_MOVEMENT_TEMPLATE.xlsm",
        exportData,
        "items",
        [],
        outputFilename
      );
    } catch (error) {
      console.error("Export template execution error:", error);
      alert("Failed to export. Please ensure that public/templates/WASTE_MOVEMENT_TEMPLATE.xlsm exists.");
    }
  };

  const handleExportSelected = () => {
    if (!selectedMovementId) return;
    const rec = movements.find(m => m.id === selectedMovementId);
    if (rec) {
      handleExportExcel(rec);
    }
  };

  const handleExportPdf = async (rec: WasteMovementRecord) => {
    if (isExportingPdf) return;

    if (!rec.breakdownId && !rec.breakdownManifestNo) {
      alert("Export Blocked: This Waste Movement document lacks a reference to an authoritative Hazardous Waste Breakdown record.");
      return;
    }
    if (!rec.sourceFileName) {
      alert("Export Blocked: A COA source document must be uploaded before exporting.");
      return;
    }
    if (!rec.signedBy || !rec.notedBy) {
      alert("Export Blocked: Document must be signed by required signatories before exporting.");
      return;
    }

    setIsExportingPdf(true);
    try {
      if (rec.sourceFileName?.toLowerCase().endsWith(".docx")) {
        showNotification("DOCX format is not supported for combined PDF conversion. Please use PDF or image instead.", "error");
        setIsExportingPdf(false);
        return;
      }

      let fileData = "";
      try {
        fileData = await getFileFromIndexedDB(`tsd_wm_file_${rec.id}`);
      } catch (err) {
        console.warn("IndexedDB fetch failed during export:", err);
      }
      if (!fileData) {
        fileData = localStorage.getItem(`tsd_wm_file_${rec.id}`) || rec.sourceFileData || "";
      }
      
      if (!fileData) {
        alert("The original source file could not be retrieved from storage. Please re-upload the COA document.");
        setIsExportingPdf(false);
        return;
      }
      
      const { mergeSourceAndExcelPdf } = await import("../utils/pdfMerger");
      const { blob: mergedPdfBlob, hasMultiplePages } = await mergeSourceAndExcelPdf(rec.sourceFileName, fileData, rec);
      
      const { saveAs } = await import("file-saver");
      const filename = getFormattedFilename(rec.transportDate, "pdf");
      saveAs(mergedPdfBlob, filename);
      
      showNotification("Combined PDF generated successfully.", "success");
    } catch (error) {
      console.error("Failed to generate combined PDF:", error);
      alert("Failed to compile combined PDF. Please verify document formatting.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportSelectedPdf = () => {
    if (!selectedMovementId) return;
    const rec = movements.find(m => m.id === selectedMovementId);
    if (rec) {
      handleExportPdf(rec);
    }
  };

  // Search filtering
  const filteredMovements = movements.filter(m => {
    const safeCrdNo = m.crdNo || "";
    const safeRcNo = m.rcNo || "";
    const safeSourceFileName = m.sourceFileName || "";
    const safeManifest = m.breakdownManifestNo || "";
    const safeClient = m.breakdownClient || "";
    const term = (searchTerm || "").toLowerCase();

    return safeCrdNo.toLowerCase().includes(term) ||
           safeRcNo.toLowerCase().includes(term) ||
           safeSourceFileName.toLowerCase().includes(term) ||
           safeManifest.toLowerCase().includes(term) ||
           safeClient.toLowerCase().includes(term);
  });

  // Sorting
  const sortedMovements = [...filteredMovements].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (typeof valA === "number" && typeof valB === "number") {
      return sortDirection === "asc" ? valA - valB : valB - valA;
    }
    const strA = String(valA).toLowerCase();
    const strB = String(valB).toLowerCase();
    if (strA < strB) return sortDirection === "asc" ? -1 : 1;
    if (strA > strB) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const selectedRecord = movements.find(m => m.id === selectedMovementId);

  return (
    <div id="smei-wastemovement-portal" className="p-4 md:p-6 space-y-6 max-w-[130rem] mx-auto w-full text-slate-800 dark:text-slate-100">
      
      {/* Local Notification Banner */}
      {notification && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 shadow-md animate-fadeIn ${
          notification.type === "success" 
            ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900/40 dark:text-emerald-400" 
            : "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900/40 dark:text-rose-400"
        }`}>
          <div className="flex items-center gap-2.5 text-xs">
            {notification.type === "success" ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span className="font-semibold">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white tracking-tight font-display uppercase">
            Waste Movement Summary Ledger
          </h2>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Automated waste movement summary documents generated directly from authoritative Hazardous Waste Breakdown records.
          </p>
        </div>
      </div>

      {/* Management Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCreateNew}
            className="bg-smei-crimson hover:bg-smei-darkred text-white text-xs font-semibold h-[38px] px-4 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all hover:scale-[1.02] active:scale-95 cursor-pointer font-sans"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Waste Movement Summary</span>
          </button>

          <button
            onClick={handleExportSelected}
            disabled={!selectedMovementId}
            className={`text-xs font-semibold h-[38px] px-4 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all whitespace-nowrap font-sans ${
              !selectedMovementId
                ? "bg-gray-100 dark:bg-slate-800/80 text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-700 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600 hover:scale-[1.02] active:scale-95 cursor-pointer shadow-[0_2px_8px_rgba(16,185,129,0.15)]"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handleExportSelectedPdf}
            disabled={!selectedMovementId || isExportingPdf}
            className="bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white text-xs font-semibold h-[38px] px-4 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all hover:scale-[1.02] active:scale-95 cursor-pointer font-sans"
          >
            <FileText className="w-4 h-4" />
            <span>{isExportingPdf ? "Exporting PDF..." : "Export Combined PDF"}</span>
          </button>

          {selectedRecord && (
            <div className="flex items-center gap-2 ml-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase font-mono tracking-wider">Selected CRD:</span>
              <span className="text-[11px] font-bold font-mono text-smei-crimson bg-red-50 border border-red-200 px-2.5 py-1 rounded-md">
                {selectedRecord.crdNo}
              </span>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search CRD, Breakdown, Client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent focus:bg-white dark:focus:bg-slate-900 transition-all text-gray-700 dark:text-slate-200 font-mono"
          />
        </div>
      </div>

      {/* Central Records Table */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-gray-800 dark:text-slate-200 font-display uppercase tracking-wider flex items-center gap-2">
            <span>Waste Movement Summary Registry</span>
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
              {filteredMovements.length} Entries
            </span>
          </h3>
        </div>

        <div className="border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider select-none">
                  <th 
                    onClick={() => { setSortField("transportDate"); setSortDirection(prev => prev === "asc" ? "desc" : "asc"); }}
                    className="py-3 px-4 font-display cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Transport Date</span>
                      {sortField === "transportDate" && (sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-smei-crimson" /> : <ArrowDown className="w-3 h-3 text-smei-crimson" />)}
                    </div>
                  </th>
                  <th 
                    onClick={() => { setSortField("crdNo"); setSortDirection(prev => prev === "asc" ? "desc" : "asc"); }}
                    className="py-3 px-4 font-display cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>CRD Number</span>
                      {sortField === "crdNo" && (sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-smei-crimson" /> : <ArrowDown className="w-3 h-3 text-smei-crimson" />)}
                    </div>
                  </th>
                  <th className="py-3 px-4 font-display">Authoritative Breakdown Record</th>
                  <th className="py-3 px-4 font-display text-right">Export Qty (MT)</th>
                  <th className="py-3 px-4 font-display text-right">Disposal Qty (MT)</th>
                  <th className="py-3 px-4 font-display text-right">Recycle Qty (MT)</th>
                  <th 
                    onClick={() => { setSortField("totalQty"); setSortDirection(prev => prev === "asc" ? "desc" : "asc"); }}
                    className="py-3 px-4 font-display text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Total Qty (MT)</span>
                      {sortField === "totalQty" && (sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-smei-crimson" /> : <ArrowDown className="w-3 h-3 text-smei-crimson" />)}
                    </div>
                  </th>
                  <th className="py-3 px-4 font-display truncate">COA Document</th>
                  <th className="py-3 px-4 font-display text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80">
                {sortedMovements.length > 0 ? (
                  sortedMovements.map((rec, index) => {
                    return (
                      <tr
                        key={rec.id}
                        onClick={() => handleMovementSelect(rec)}
                        onDoubleClick={() => handleEditRecord(rec)}
                        className={`cursor-pointer transition-all group ${
                          selectedMovementId === rec.id
                            ? "bg-red-600/10 border-l-4 border-l-smei-crimson font-medium"
                            : index % 2 === 1
                            ? "bg-gray-50/45 hover:bg-red-600/5"
                            : "bg-white dark:bg-slate-900 hover:bg-red-600/5"
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-semibold text-gray-700 dark:text-slate-300">
                          {rec.transportDate}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-smei-crimson dark:text-rose-400">
                          {rec.crdNo}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              {rec.breakdownManifestNo || rec.breakdownId || "Manifest Reference"}
                            </span>
                            <span className="text-[10px] text-slate-500 truncate max-w-[160px]">
                              {rec.breakdownClient || "Authoritative Breakdown"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-right text-blue-600 dark:text-blue-400 font-semibold">
                          {formatQuantityDisplay(rec.quantity1)}
                        </td>
                        <td className="py-3 px-4 font-mono text-right text-amber-600 dark:text-amber-400 font-semibold">
                          {formatQuantityDisplay(rec.quantity2)}
                        </td>
                        <td className="py-3 px-4 font-mono text-right text-emerald-600 dark:text-emerald-400 font-semibold">
                          {formatQuantityDisplay(rec.quantity3)}
                        </td>
                        <td className="py-3 px-4 font-mono text-right font-bold text-slate-800 dark:text-slate-100">
                          {formatQuantityDisplay(rec.totalQty)}
                        </td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 truncate max-w-[130px]" title={rec.sourceFileName}>
                          <span className="flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span className="truncate">{rec.sourceFileName}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleEditRecord(rec)}
                              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-smei-crimson text-gray-400 dark:text-slate-500 rounded-lg transition-all"
                              title="Edit Entry"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteRecord(rec.id, e)}
                              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-smei-crimson text-gray-400 dark:text-slate-500 rounded-lg transition-all"
                              title="Delete Entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-400 dark:text-slate-500">
                      No waste movement entries found. Click "Generate Waste Movement Summary" to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Interactive Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-100 dark:border-slate-800 max-w-4xl w-full overflow-hidden animate-fadeIn flex flex-col max-h-[95vh]">

            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800 dark:text-slate-200 font-display flex items-center gap-1.5 uppercase tracking-wider">
                <span>{editingRecordId ? "Modify Waste Movement Summary" : "Generate Waste Movement Summary Document"}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1 rounded-full hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            {(() => {
              const selectedBreakdown = breakdownRecords.find(b => b.id === formBreakdownId);
              const currentBreakdownData = selectedBreakdown || formBreakdownDetails || { quantity2: formQuantity2, quantity3: formQuantity3 };
              const isRcRequired = requiresRcNumber(currentBreakdownData);

              return (
            <form onSubmit={handleSaveRecord} className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
              
              {/* Form Validation Alert Box */}
              {showFileWarning && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-900/30 dark:text-red-400 rounded-lg flex items-start gap-2.5 animate-fadeIn">
                  <AlertCircle className="w-4.5 h-4.5 shrink-0 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-xs">Missing Required COA Source Document</p>
                    <p className="text-[10px] mt-0.5 opacity-90 leading-normal">
                      A validated COA (Certificate of Analysis) source file (PDF, DOCX, or Image) must be attached before saving or exporting.
                    </p>
                  </div>
                </div>
              )}

              {/* SECTION 1: Hazardous Waste Breakdown Dropdown Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-gray-200 dark:border-slate-800">
                <div className="md:col-span-2 space-y-1">
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-smei-crimson" />
                    <span>Authoritative Hazardous Waste Breakdown Document *</span>
                  </label>

                  <div className="relative w-full" ref={breakdownDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsBreakdownDropdownOpen(!isBreakdownDropdownOpen)}
                      className={`w-full h-10 min-h-[40px] px-3.5 py-2 flex items-center justify-between gap-2 bg-white dark:bg-slate-900 border rounded-lg text-xs text-left transition-all cursor-pointer shadow-xs ${
                        !formBreakdownId
                          ? "border-gray-200 dark:border-slate-800 text-gray-400 dark:text-slate-500"
                          : "border-gray-200 dark:border-slate-800 text-gray-800 dark:text-slate-100 font-mono font-medium"
                      } focus:outline-none focus:ring-2 focus:ring-smei-crimson/20 focus:border-smei-crimson`}
                    >
                      <span className="truncate leading-tight block flex-1">
                        {selectedBreakdown ? (
                          `Control No: ${getTrackingCode(selectedBreakdown) || selectedBreakdown.manifestNo} | Client: ${selectedBreakdown.client} | Date: ${selectedBreakdown.date} | Total Qty: ${computeBreakdownQuantities(selectedBreakdown).totalQty} MT (MRR: ${selectedBreakdown.mrrNo || 'N/A'})`
                        ) : (
                          "-- Select Hazardous Waste Breakdown Record --"
                        )}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${isBreakdownDropdownOpen ? "rotate-180" : ""}`} />
                    </button>

                    {isBreakdownDropdownOpen && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg shadow-xl max-h-60 overflow-y-auto py-1 animate-fadeIn">
                        {breakdownRecords.length > 5 && (
                          <div className="p-2 border-b border-gray-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
                            <div className="relative flex items-center">
                              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 pointer-events-none" />
                              <input
                                type="text"
                                placeholder="Search manifest, client, or MRR..."
                                value={breakdownSearchQuery}
                                onChange={(e) => setBreakdownSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded focus:outline-none focus:ring-1 focus:ring-smei-crimson text-gray-800 dark:text-slate-200"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </div>
                        )}

                        {(() => {
                          const filtered = breakdownRecords.filter((b) => {
                            if (!breakdownSearchQuery.trim()) return true;
                            const q = breakdownSearchQuery.toLowerCase();
                            return (
                              (b.manifestNo || "").toLowerCase().includes(q) ||
                              (b.client || "").toLowerCase().includes(q) ||
                              (b.mrrNo || "").toLowerCase().includes(q) ||
                              (b.date || "").toLowerCase().includes(q)
                            );
                          });

                          if (filtered.length === 0) {
                            return (
                              <div className="px-3.5 py-3 text-xs text-gray-400 dark:text-slate-500 text-center">
                                No matching breakdown records found.
                              </div>
                            );
                          }

                          return filtered.map((b) => {
                            const totals = computeBreakdownQuantities(b);
                            const isSelected = b.id === formBreakdownId;
                            const displayLabel = `Control No: ${getTrackingCode(b) || b.manifestNo} | Client: ${b.client} | Date: ${b.date} | Total Qty: ${totals.totalQty} MT (MRR: ${b.mrrNo || 'N/A'})`;

                            return (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => {
                                  handleSelectBreakdown(b.id);
                                  setIsBreakdownDropdownOpen(false);
                                  setBreakdownSearchQuery("");
                                }}
                                className={`w-full text-left px-3.5 py-2.5 text-xs font-mono flex items-center justify-between gap-2 transition-colors cursor-pointer border-b last:border-b-0 border-gray-50 dark:border-slate-800/50 ${
                                  isSelected
                                    ? "bg-smei-crimson/10 text-smei-crimson dark:text-red-400 font-bold"
                                    : "text-gray-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                                }`}
                                title={displayLabel}
                              >
                                <span className="truncate flex-1">{displayLabel}</span>
                                {isSelected && <CheckCircle className="w-3.5 h-3.5 text-smei-crimson shrink-0" />}
                              </button>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>

                  {isAutoSelected && selectedBreakdown && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-semibold mt-1.5 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60 shadow-2xs">
                      <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>✓ Automatically selected based on Control Number ({autoSelectedControlNo || getTrackingCode(selectedBreakdown)})</span>
                    </div>
                  )}

                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    Select a saved Hazardous Waste Breakdown document. Quantities will be computed automatically and locked to preserve data integrity.
                  </p>
                </div>

                {/* Read-Only Computed Quantities Display */}
                {formBreakdownId ? (
                  <div className="md:col-span-2 bg-white dark:bg-slate-900 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/40 space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
                          Auto-Populated Breakdown Quantities (Read-Only)
                        </span>
                      </div>
                      <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 px-2.5 py-0.5 rounded font-bold">
                        Source: {formBreakdownDetails?.manifestNo || formBreakdownId}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-gray-200 dark:border-slate-800">
                        <span className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase">
                          QUANTITY 1 (Export)
                        </span>
                        <span className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400">
                          {formatQuantityDisplay(formQuantity1)} MT
                        </span>
                        <span className="block text-[9px] text-gray-400">Export for recovery</span>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-gray-200 dark:border-slate-800">
                        <span className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase">
                          QUANTITY 2 (Disposal)
                        </span>
                        <span className="text-sm font-mono font-bold text-amber-600 dark:text-amber-400">
                          {formatQuantityDisplay(formQuantity2)} MT
                        </span>
                        <span className="block text-[9px] text-gray-400">Local TSD Disposal</span>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-gray-200 dark:border-slate-800">
                        <span className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase">
                          QUANTITY 3 (Recycle)
                        </span>
                        <span className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatQuantityDisplay(formQuantity3)} MT
                        </span>
                        <span className="block text-[9px] text-gray-400">Recycling/Recovery</span>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-gray-200 dark:border-slate-800">
                        <span className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase">
                          TOTAL QUANTITY
                        </span>
                        <span className="text-sm font-mono font-bold text-slate-800 dark:text-slate-100">
                          {formatQuantityDisplay(formTotalQty)} MT
                        </span>
                        <span className="block text-[9px] text-gray-400">Authoritative Sum</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="md:col-span-2 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl text-amber-800 dark:text-amber-400 text-xs font-medium text-center">
                    Please select a Hazardous Waste Breakdown record above to auto-populate waste movement quantities.
                  </div>
                )}
              </div>

              {/* SECTION 2: General Document Headers & COA Upload */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Drag & Drop COA Upload Zone */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    COA / Certificate of Analysis Source File *
                  </label>
                  
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center min-h-[140px] transition-all relative ${
                      showFileWarning 
                        ? "border-red-500 bg-red-50/20 dark:bg-red-950/10"
                        : isDragOver
                        ? "border-smei-crimson bg-red-50/10"
                        : "border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-950/50"
                    }`}
                  >
                    <input
                      type="file"
                      accept=".pdf,.docx,.png,.jpg,.jpeg"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />

                    {formSourceFileName ? (
                      <div className="flex flex-col items-center text-center p-2 space-y-1">
                        <FileText className="w-8 h-8 text-blue-500" />
                        <span className="font-bold text-xs text-gray-800 dark:text-slate-200 font-mono truncate max-w-[200px]">
                          {formSourceFileName}
                        </span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> File Attached & Ready
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-center space-y-1.5">
                        <FileText className="w-7 h-7 text-gray-400" />
                        <span className="font-semibold text-xs text-gray-600 dark:text-slate-300">
                          Click or drag & drop COA source document
                        </span>
                        <span className="text-[10px] text-gray-400">
                          Supports PDF, DOCX, PNG, JPG (Max 10MB)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Form Fields: Dates, Numbers, Signatories */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Transport Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formTransportDate}
                      onChange={(e) => setFormTransportDate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-smei-crimson text-gray-800 dark:text-slate-200 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      CRD Control Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={formCrdNo}
                      onChange={(e) => setFormCrdNo(formatControlNumber(e.target.value, "crdNumber"))}
                      placeholder="e.g. CRD-06-1309-26"
                      className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-smei-crimson text-gray-800 dark:text-slate-200 font-mono uppercase"
                    />
                  </div>

                  <RcNumberInput
                    value={formRcNo}
                    onChange={(formatted) => {
                      setFormRcNo(formatted);
                      if (isRcRequired) {
                        const v = validateControlNumber(formatted, "rcNumber");
                        setRcError(v.isValid ? "" : v.error || "Invalid Recycle Cert No. Expected format: R-123 (e.g., R-932, R-15402).");
                      } else {
                        setRcError("");
                      }
                    }}
                    required={isRcRequired}
                    disabled={!isRcRequired}
                    label="RC Number (Recycle Cert No)"
                    placeholder={isRcRequired ? "e.g. R-123" : "N/A"}
                    helperText={
                      !isRcRequired
                        ? "Auto-set to N/A (Locked: Breakdown contains Export for Recovery only)."
                        : "Required format: R-123 (Breakdown contains Disposal or Recycling quantities)."
                    }
                    showError={!!rcError}
                    errorMessage={rcError}
                    id="waste-movement-rc-no"
                  />
                </div>

                {/* Signatories */}
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-gray-200 dark:border-slate-800">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Signed By (Pollution Control Officer) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formSignedBy}
                      onChange={(e) => setFormSignedBy(e.target.value.toUpperCase())}
                      placeholder="ENGR. MARY ANN PEDROSO"
                      className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-smei-crimson text-gray-800 dark:text-slate-200 font-sans uppercase font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Noted By (Technical Manager) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formNotedBy}
                      onChange={(e) => setFormNotedBy(e.target.value.toUpperCase())}
                      placeholder="APRILYN ROGADOR"
                      className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-smei-crimson text-gray-800 dark:text-slate-200 font-sans uppercase font-semibold"
                    />
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-smei-crimson hover:bg-smei-darkred text-white rounded-lg font-semibold shadow-sm transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                >
                  {editingRecordId ? "Save Changes" : "Create Summary Document"}
                </button>
              </div>

            </form>
              );
            })()}
          </div>
        </div>
      )}

    </div>
  );
}
