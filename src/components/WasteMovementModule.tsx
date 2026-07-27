import React, { useState, useEffect } from "react";
import { 
  Plus, 
  ArrowRight, 
  ClipboardList, 
  Search, 
  Trash2, 
  Edit, 
  X, 
  CheckCircle, 
  FileSpreadsheet, 
  UploadCloud, 
  FileText, 
  Eye, 
  Save,
  Calendar,
  User,
  Info,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Shield,
  Trash
} from "lucide-react";
import { exportExcelWithTemplate } from "../utils/templateExport";
import { formatControlNumber } from "../utils/controlNumber";

export function formatQuantityDisplay(qty: any): string {
  if (qty === null || qty === undefined || String(qty).trim() === "") return "-";
  const num = Number(qty);
  if (isNaN(num)) return String(qty).trim() || "-";
  return String(num);
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
  method: string; // "Export for recovery", "Disposal", or "Recycling/Recovery"
  quantity: number; // in MT
  destination: string;
  remarks?: string;
}

export interface WasteMovementRecord {
  id: string;
  transportDate: string; // YYYY-MM-DD
  crdNo: string;
  rcNo: string;
  signedBy: string;
  notedBy: string;
  sourceFileName: string;
  sourceFileData: string; // Base64
  methods: WasteMovementMethodEntry[];
  totalQty: number; // dynamic sum of method quantities
  dateTime: string;
  status: string; // "Completed" etc.
}

export default function WasteMovementModule() {
  const [movements, setMovements] = useState<WasteMovementRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [methodFilter, setMethodFilter] = useState("All");
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);

  // Sorting state
  const [sortField, setSortField] = useState<keyof WasteMovementRecord>("transportDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

  // Modal Form Fields
  const [formTransportDate, setFormTransportDate] = useState("");
  const [formCrdNo, setFormCrdNo] = useState("");
  const [formRcNo, setFormRcNo] = useState("");
  const [formSignedBy, setFormSignedBy] = useState("ENGR. MARY ANN PEDROSO");
  const [formNotedBy, setFormNotedBy] = useState("APRILYN ROGADOR");
  const [formMethods, setFormMethods] = useState<WasteMovementMethodEntry[]>([]);
  const [formSourceFileName, setFormSourceFileName] = useState("");
  const [formSourceFileData, setFormSourceFileData] = useState("");

  // Inner form "Add Method" state
  const [selectedMethod, setSelectedMethod] = useState("");
  const [methodQty, setMethodQty] = useState<number | "">("");
  const [methodDest, setMethodDest] = useState("");
  const [methodRemarks, setMethodRemarks] = useState("");

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

  // Load ledger from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem("tsd_waste_movements");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as WasteMovementRecord[];
        setMovements(parsed);
        if (parsed.length > 0) {
          setSelectedMovementId(parsed[0].id);
        }
      } catch (e) {
        console.error("Failed to load waste movements", e);
      }
    } else {
      const initial: WasteMovementRecord[] = [
        {
          id: "wm-1",
          transportDate: "2026-07-13",
          crdNo: "CRD-06-1309-26",
          rcNo: "N/A",
          signedBy: "ENGR. MARY ANN PEDROSO",
          notedBy: "APRILYN ROGADOR",
          sourceFileName: "Delivery_Slip_048.pdf",
          sourceFileData: "data:application/pdf;base64,JVBERi0xLjQK...", 
          totalQty: 2.974,
          dateTime: "2026-07-13 09:15 AM",
          status: "Completed",
          methods: [
            {
              method: "Export for recovery",
              quantity: 2.974,
              destination: "Off-shore Treater",
              remarks: "Original Delivery Slip"
            }
          ]
        },
        {
          id: "wm-2",
          transportDate: "2026-07-15",
          crdNo: "CRD-07-1422-26",
          rcNo: "RC-2026-T1",
          signedBy: "ENGR. MARY ANN PEDROSO",
          notedBy: "APRILYN ROGADOR",
          sourceFileName: "Receipt_991.png",
          sourceFileData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          totalQty: 6.342,
          dateTime: "2026-07-15 11:30 AM",
          status: "Completed",
          methods: [
            {
              method: "Export for recovery",
              quantity: 2.974,
              destination: "Off-shore Treater",
              remarks: "Batch loaded"
            },
            {
              method: "Disposal",
              quantity: 3.368,
              destination: "Disposal by SMEI",
              remarks: "Disposed"
            }
          ]
        }
      ];
      setMovements(initial);
      setSelectedMovementId(initial[0].id);
      try {
        localStorage.setItem("tsd_waste_movements", JSON.stringify(initial));
      } catch (err) {
        console.error("SMEI: Initial seed of movements failed", err);
      }

      // Asynchronously pre-seed files to IndexedDB
      initial.forEach(rec => {
        if (rec.sourceFileData) {
          saveFileToIndexedDB(`tsd_wm_file_${rec.id}`, rec.sourceFileData).catch(err => {
            console.warn("Seeding to IndexedDB failed, storing in localStorage as fallback", err);
            try {
              localStorage.setItem(`tsd_wm_file_${rec.id}`, rec.sourceFileData);
            } catch (e) {
              console.error("Storage fallback failed too", e);
            }
          });
        }
      });
    }
  }, []);

  const saveToStorage = (updated: WasteMovementRecord[]) => {
    setMovements(updated);
    try {
      localStorage.setItem("tsd_waste_movements", JSON.stringify(updated));
    } catch (error) {
      console.error("SMEI: Failed to save movements to localStorage:", error);
      const isQuota = error instanceof DOMException && (
        error.name === "QuotaExceededError" ||
        error.code === 22 ||
        error.name === "NS_ERROR_DOM_QUOTA_REACHED"
      );
      if (isQuota) {
        showNotification("Warning: Browser storage is full. Your list changes are saved in memory but could not be persisted.", "error");
      } else {
        showNotification("Warning: Failed to save record changes to browser storage.", "error");
      }
    }
  };

  // Method selector prefill
  useEffect(() => {
    if (selectedMethod === "Export for recovery") {
      setMethodDest("Off-shore Treater");
    } else if (selectedMethod === "Disposal") {
      setMethodDest("Disposal by SMEI");
    } else if (selectedMethod === "Recycling/Recovery") {
      setMethodDest("Local/Offshore");
    } else {
      setMethodDest("");
    }
  }, [selectedMethod]);

  // Format filename helper
  const getFormattedFilename = (dateStr: string): string => {
    if (!dateStr) return "COT & Waste Movement";
    const date = new Date(dateStr);
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const month = months[date.getMonth()] || "Month";
    const year = date.getFullYear() || "Year";
    return `COT & Waste Movement ${month}-${year}`;
  };

  // Validation checkers
  const validateCrdNumber = (num: string): boolean => {
    return /^CRD-\d{2}-\d{4}-\d{2}$/.test(num);
  };

  // Add a method entry to form list
  const handleAddMethodEntry = () => {
    if (!selectedMethod) return;
    const qtyVal = Number(methodQty);
    if (methodQty === "" || isNaN(qtyVal) || qtyVal < 0) {
      alert("Please enter a valid quantity of 0 or greater.");
      return;
    }
    if (!methodDest.trim()) {
      alert("Please specify a destination.");
      return;
    }
    if (formMethods.some(m => m.method === selectedMethod)) {
      alert("This method has already been added.");
      return;
    }

    const newEntry: WasteMovementMethodEntry = {
      method: selectedMethod,
      quantity: qtyVal,
      destination: methodDest.trim(),
      remarks: methodRemarks.trim()
    };

    const updatedMethods = [...formMethods, newEntry];
    setFormMethods(updatedMethods);

    // Manage RC No. transition directly
    const hasDisposalOrRecycle = updatedMethods.some(
      m => m.method === "Disposal" || m.method === "Recycling/Recovery"
    );
    if (!hasDisposalOrRecycle) {
      setFormRcNo("N/A");
    } else {
      setFormRcNo(prev => prev === "N/A" ? "" : prev);
    }

    setSelectedMethod("");
    setMethodQty("");
    setMethodDest("");
    setMethodRemarks("");
  };

  // Remove a method entry
  const handleRemoveMethodEntry = (methodName: string) => {
    const updatedMethods = formMethods.filter(m => m.method !== methodName);
    setFormMethods(updatedMethods);

    // Manage RC No. transition directly
    const hasDisposalOrRecycle = updatedMethods.some(
      m => m.method === "Disposal" || m.method === "Recycling/Recovery"
    );
    if (!hasDisposalOrRecycle) {
      setFormRcNo("N/A");
    } else {
      setFormRcNo(prev => prev === "N/A" ? "" : prev);
    }
  };

  // File Upload Drag & Drop handlers
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
    setEditingRecordId(null);
    setFormTransportDate(new Date().toISOString().split("T")[0]);
    setFormCrdNo("");
    setFormRcNo("N/A");
    setFormSignedBy("ENGR. MARY ANN PEDROSO");
    setFormNotedBy("APRILYN ROGADOR");
    setFormMethods([]);
    setFormSourceFileName("");
    setFormSourceFileData("");
    setShowFileWarning(false);
    setIsModalOpen(true);
  };

  // Edit record trigger
  const handleEditRecord = async (rec: WasteMovementRecord) => {
    setEditingRecordId(rec.id);
    setFormTransportDate(rec.transportDate);
    setFormCrdNo((rec.crdNo || "").toUpperCase());
    setFormRcNo((rec.rcNo || "").toUpperCase());
    setFormSignedBy(rec.signedBy);
    setFormNotedBy(rec.notedBy);
    setFormMethods(rec.methods);
    setFormSourceFileName(rec.sourceFileName);
    
    // Load file asynchronously from IndexedDB or fallback to localStorage
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

    // Required File validation
    if (!formSourceFileName) {
      setShowFileWarning(true);
      return;
    }

    // Required CRD Validation
    if (!validateCrdNumber(formCrdNo)) {
      alert("Invalid CRD Number format. Please use the format: CRD-XX-XXXX-XX");
      return;
    }

    // Check if RC No is required and filled
    const hasDisposalOrRecycle = formMethods.some(
      m => m.method === "Disposal" || m.method === "Recycling/Recovery"
    );
    if (hasDisposalOrRecycle && (!formRcNo.trim() || formRcNo === "N/A")) {
      alert("RC Number is required because Disposal or Recycling/Recovery method is added.");
      return;
    }

    // Check if at least one method is added
    if (formMethods.length === 0) {
      alert("Please add at least one waste movement method.");
      return;
    }

    const calculatedTotal = formMethods.reduce((sum, m) => sum + m.quantity, 0);

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

    let fileSaved = false;
    try {
      // 1. Try to save to IndexedDB
      await saveFileToIndexedDB(fileKey, formSourceFileData);
      fileSaved = true;
    } catch (idbErr) {
      console.warn("IndexedDB save failed, falling back to localStorage", idbErr);
      try {
        // 2. Fallback to localStorage
        localStorage.setItem(fileKey, formSourceFileData);
        fileSaved = true;
      } catch (lsErr) {
        console.error("localStorage save failed", lsErr);
        const isQuota = lsErr instanceof DOMException && (
          lsErr.name === "QuotaExceededError" ||
          lsErr.code === 22 ||
          lsErr.name === "NS_ERROR_DOM_QUOTA_REACHED"
        );
        if (isQuota) {
          alert("Unable to save this source document because the file is too large for browser storage. Please use a smaller file or compress the document.");
        } else {
          alert(`Failed to save source file: ${lsErr instanceof Error ? lsErr.message : "Storage quota exceeded"}`);
        }
        return; // Prevent partially saved states
      }
    }

    if (!fileSaved) {
      alert("Error: File could not be saved to browser storage.");
      return;
    }

    const finalSignedBy = formSignedBy.trim().toUpperCase() || "ENGR. MARY ANN PEDROSO";
    const finalNotedBy = formNotedBy.trim().toUpperCase() || "APRILYN ROGADOR";

    if (editingRecordId) {
      const updated = movements.map(m => {
        if (m.id === editingRecordId) {
          return {
            ...m,
            transportDate: formTransportDate,
            crdNo: formCrdNo,
            rcNo: formRcNo,
            signedBy: finalSignedBy,
            notedBy: finalNotedBy,
            methods: formMethods,
            totalQty: calculatedTotal,
            sourceFileName: formSourceFileName
          };
        }
        return m;
      });
      saveToStorage(updated);
      showNotification("Waste movement transaction updated successfully.", "success");
    } else {
      const newRec: WasteMovementRecord = {
        id: targetId,
        transportDate: formTransportDate,
        crdNo: formCrdNo,
        rcNo: formRcNo,
        signedBy: finalSignedBy,
        notedBy: finalNotedBy,
        sourceFileName: formSourceFileName,
        sourceFileData: "", // Keep main array light
        methods: formMethods,
        totalQty: calculatedTotal,
        dateTime: formattedDateTime,
        status: "Completed"
      };
      saveToStorage([newRec, ...movements]);
      setSelectedMovementId(targetId);
      showNotification("Waste movement transaction created successfully.", "success");
    }

    setIsModalOpen(false);
  };

  // Delete transaction
  const handleDeleteRecord = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to permanently delete this waste movement transaction?")) {
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
      showNotification("Waste movement transaction deleted successfully.", "success");
    }
  };



  // Export Excel handler
  const handleExportExcel = async (rec: WasteMovementRecord) => {
    const methodsList = rec.methods || [];
    const m1 = methodsList.find(m => m.method === "Export for recovery");
    const m2 = methodsList.find(m => m.method === "Disposal");
    const m3 = methodsList.find(m => m.method === "Recycling/Recovery");

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
      QUANTITY_1: formatQuantityDisplay(m1?.quantity),
      DESTINATION_1: m1?.destination || "Off-shore Treater",
      REMARKS_1: m1 ? (m1.remarks || rec.sourceFileName || "") : "",

      METHOD_2: "Disposal",
      QUANTITY_2: formatQuantityDisplay(m2?.quantity),
      DESTINATION_2: m2?.destination || "Disposal by SMEI",
      REMARKS_2: m2 ? (m2.remarks || rec.sourceFileName || "") : "",

      METHOD_3: "Recycling/Recovery",
      QUANTITY_3: formatQuantityDisplay(m3?.quantity),
      DESTINATION_3: m3?.destination || "Local/Offshore",
      REMARKS_3: m3 ? (m3.remarks || rec.sourceFileName || "") : ""
    };

    const outputFilename = getFormattedFilename(rec.transportDate) + ".xlsm";

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
    setIsExportingPdf(true);
    try {
      if (rec.sourceFileName?.toLowerCase().endsWith(".docx")) {
        showNotification("High-fidelity DOCX to PDF conversion is not supported in the current browser architecture. Please upload the source document as a PDF or image instead.", "error");
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
        alert("The original source file could not be retrieved from local storage. Please re-upload or edit the entry.");
        setIsExportingPdf(false);
        return;
      }
      
      const { mergeSourceAndExcelPdf } = await import("../utils/pdfMerger");
      const { blob: mergedPdfBlob, hasMultiplePages } = await mergeSourceAndExcelPdf(rec.sourceFileName, fileData, rec);
      
      const { saveAs } = await import("file-saver");
      const filename = getFormattedFilename(rec.transportDate) + ".pdf";
      saveAs(mergedPdfBlob, filename);
      
      if (hasMultiplePages) {
        showNotification("Multi-page combined PDF generated successfully. All source document pages have been fully preserved with the Waste Movement page attached at the end.", "success");
      } else {
        showNotification("Combined PDF generated successfully. The source document and Waste Movement page have been merged.", "success");
      }
    } catch (error) {
      console.error("Failed to generate combined PDF:", error);
      alert("Failed to compile and merge combined PDF. Please verify document formatting.");
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
    const safeMethods = m.methods || [];
    const term = (searchTerm || "").toLowerCase();

    const matchesSearch = 
      safeCrdNo.toLowerCase().includes(term) ||
      safeRcNo.toLowerCase().includes(term) ||
      safeSourceFileName.toLowerCase().includes(term) ||
      safeMethods.some(method => (method.method || "").toLowerCase().includes(term));
    const matchesMethod = methodFilter === "All" || safeMethods.some(method => method.method === methodFilter);
    return matchesSearch && matchesMethod;
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

  // Available options for Inner Method Addition
  const availableMethods = [
    "Export for recovery",
    "Disposal",
    "Recycling/Recovery"
  ].filter(m => !formMethods.some(added => added.method === m));

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

      {/* Header matching Hazardous Waste Layout */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white tracking-tight font-display uppercase">
            Internal Material Loop & Waste Movement Ledger
          </h2>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Log, validate, and compute precise quantities of waste movement with high-fidelity Excel report macros.
          </p>
        </div>
      </div>

      {/* Standard Management Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCreateNew}
            className="bg-smei-crimson hover:bg-smei-darkred text-white text-xs font-semibold h-[38px] px-4 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all hover:scale-[1.02] active:scale-95 cursor-pointer font-sans"
          >
            <Plus className="w-4 h-4" />
            <span>Create Waste Movement</span>
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
              <span className="text-[10px] font-bold text-gray-500 uppercase font-mono tracking-wider">Selected:</span>
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
            placeholder="Search CRD, RC, or Reference..."
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
            <span>Material Transfer Registry</span>
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
              {filteredMovements.length} Entries
            </span>
          </h3>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
              Method:
            </label>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-gray-200 dark:border-slate-800 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-smei-crimson cursor-pointer font-medium"
            >
              <option value="All">All Methods</option>
              <option value="Export for recovery">Export for recovery</option>
              <option value="Disposal">Disposal</option>
              <option value="Recycling/Recovery">Recycling/Recovery</option>
            </select>
          </div>
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
                  <th 
                    onClick={() => { setSortField("rcNo"); setSortDirection(prev => prev === "asc" ? "desc" : "asc"); }}
                    className="py-3 px-4 font-display cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Recycle Number</span>
                      {sortField === "rcNo" && (sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-smei-crimson" /> : <ArrowDown className="w-3 h-3 text-smei-crimson" />)}
                    </div>
                  </th>
                  <th className="py-3 px-4 font-display">Methods Selected</th>
                  <th 
                    onClick={() => { setSortField("totalQty"); setSortDirection(prev => prev === "asc" ? "desc" : "asc"); }}
                    className="py-3 px-4 font-display text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Total Qty (MT)</span>
                      {sortField === "totalQty" && (sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-smei-crimson" /> : <ArrowDown className="w-3 h-3 text-smei-crimson" />)}
                    </div>
                  </th>
                  <th className="py-3 px-4 font-display truncate">Attached Document</th>
                  <th className="py-3 px-4 font-display text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80">
                {sortedMovements.length > 0 ? (
                  sortedMovements.map((rec, index) => {
                    const uniqueMethods = Array.from(new Set((rec.methods || []).map(item => item.method)));
                    const methodsStr = uniqueMethods.join(" | ");

                    return (
                      <tr
                        key={rec.id}
                        onClick={() => setSelectedMovementId(rec.id)}
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
                        <td className="py-3 px-4 font-mono text-gray-600 dark:text-slate-400">
                          <span className={rec.rcNo === "N/A" ? "text-gray-400" : ""}>
                            {rec.rcNo}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {uniqueMethods.map((m) => (
                              <span
                                key={m}
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide border ${
                                  m === "Export for recovery"
                                    ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                                    : m === "Disposal"
                                    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                }`}
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-right font-bold text-slate-700 dark:text-slate-300">
                          {formatQuantityDisplay(rec.totalQty)}
                        </td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 truncate max-w-[150px]" title={rec.sourceFileName}>
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
                    <td colSpan={7} className="py-12 text-center text-gray-400 dark:text-slate-500">
                      No waste movement entries found. Click "Create Waste Movement" to register.
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
                <span>{editingRecordId ? "Modify Waste Movement Transaction" : "Create Waste Movement"}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1 rounded-full hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveRecord} className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
              
              {/* Form Validation Alert Box */}
              {showFileWarning && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-900/30 dark:text-red-400 rounded-lg flex items-start gap-2.5 animate-fadeIn">
                  <AlertCircle className="w-4.5 h-4.5 shrink-0 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-xs">Missing Original Source Document</p>
                    <p className="text-[10px] mt-0.5 opacity-90 leading-normal">
                      A validated original source file (PDF, DOCX, or Image) must be attached before saving or exporting.
                    </p>
                  </div>
                </div>
              )}

              {/* Grid 1: Basic Fields & Source Document Drag zone */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Drag Zone */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Original Source Document (PDF/DOCX/Image) *
                  </label>
                  
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center min-h-[160px] transition-all relative ${
                      showFileWarning 
                        ? "border-red-500 bg-red-50/20 dark:bg-red-950/10"
                        : isDragOver
                        ? "border-smei-crimson bg-red-50/50 dark:bg-red-950/20"
                        : "border-gray-200 dark:border-slate-800 hover:border-smei-crimson bg-slate-50/20 dark:bg-slate-950/30"
                    }`}
                  >
                    {formSourceFileName ? (
                      <div className="w-full space-y-3">
                        <div className="flex items-center justify-between gap-2 p-2 bg-slate-100/50 dark:bg-slate-950 rounded-lg border border-gray-100 dark:border-slate-800">
                          <div className="flex items-center gap-2 truncate text-left">
                            <FileText className="w-8 h-8 text-rose-500 shrink-0" />
                            <div className="truncate">
                              <p className="text-xs font-semibold text-gray-700 dark:text-slate-200 truncate">{formSourceFileName}</p>
                              <p className="text-[9px] text-gray-400 font-mono uppercase">Attached</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setFormSourceFileName("");
                              setFormSourceFileData("");
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg cursor-pointer transition-colors"
                            title="Clear file"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center gap-2 cursor-pointer text-center py-4 w-full h-full">
                        <UploadCloud className="w-10 h-10 text-gray-400" />
                        <span className="text-xs font-semibold text-gray-600 dark:text-slate-300">
                          Drag and drop source document here, or click to select
                        </span>
                        <span className="text-[10px] text-gray-400">
                          Accepts PDF, DOCX, PNG, JPG, JPEG (Max 10MB)
                        </span>
                        <input 
                          type="file" 
                          accept=".pdf,.docx,.png,.jpg,.jpeg" 
                          className="hidden" 
                          onChange={handleFileChange} 
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Date and CRD/RC Inputs */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Transport Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formTransportDate}
                      onChange={(e) => setFormTransportDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-gray-200 dark:border-slate-800 text-xs rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-smei-crimson font-mono cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                        CRD Number (CRD No.) *
                      </label>
                      {formCrdNo && !validateCrdNumber(formCrdNo) && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-500 font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Format must be CRD-XX-XXXX-XX
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CRD-06-1309-26"
                      value={formCrdNo}
                      onChange={(e) => setFormCrdNo(formatControlNumber(e.target.value, "crdNumber"))}
                      className={`w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-smei-crimson font-mono ${
                        formCrdNo && !validateCrdNumber(formCrdNo)
                          ? "border-amber-400 dark:border-amber-500"
                          : "border-gray-200 dark:border-slate-800"
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Recycle Number: *
                    </label>
                    <input
                      type="text"
                      disabled={formRcNo === "N/A"}
                      required={formRcNo !== "N/A"}
                      placeholder={formRcNo === "N/A" ? "Auto set to N/A (Disposal/Recycle not added)" : "e.g. R-123"}
                      value={formRcNo}
                      onChange={(e) => setFormRcNo(formatControlNumber(e.target.value, "rcNumber"))}
                      className="w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-gray-200 dark:border-slate-800 text-xs rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-smei-crimson font-mono disabled:opacity-50"
                    />
                  </div>
                </div>

              </div>

              {/* Section 2: Dynamic Method Adder Area */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-gray-100 dark:border-slate-800/80 space-y-4">
                <h4 className="text-[10px] font-bold text-smei-crimson dark:text-rose-400 uppercase tracking-widest font-mono flex items-center gap-1.5 border-b border-gray-100 dark:border-slate-800 pb-2">
                  <ClipboardList className="w-4 h-4 text-smei-crimson" />
                  <span>Allocate Waste Movement Methods</span>
                </h4>

                {/* Sub-form inputs */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Method *
                    </label>
                    <select
                      value={selectedMethod}
                      onChange={(e) => setSelectedMethod(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-gray-200 dark:border-slate-800 text-xs rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-smei-crimson cursor-pointer"
                    >
                      <option value="">Select Method...</option>
                      {availableMethods.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Quantity (MT) *
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      placeholder="MT Quantity..."
                      value={methodQty}
                      onChange={(e) => setMethodQty(e.target.value !== "" ? parseFloat(e.target.value) : "")}
                      className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-gray-200 dark:border-slate-800 text-xs rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-smei-crimson font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Destination *
                    </label>
                    <input
                      type="text"
                      placeholder="Destination facility..."
                      value={methodDest}
                      onChange={(e) => setMethodDest(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-gray-200 dark:border-slate-800 text-xs rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-smei-crimson"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={!selectedMethod}
                    onClick={handleAddMethodEntry}
                    className="bg-smei-crimson disabled:opacity-40 hover:bg-smei-darkred text-white text-xs font-semibold h-[36px] rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Method</span>
                  </button>
                </div>

                {/* List of currently added methods */}
                {formMethods.length > 0 ? (
                  <div className="border border-gray-100 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800 font-bold text-slate-500">
                          <th className="p-2">Method Name</th>
                          <th className="p-2 text-right">Quantity (MT)</th>
                          <th className="p-2">Destination</th>
                          <th className="p-2 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80">
                        {formMethods.map((m, idx) => (
                          <tr key={idx}>
                            <td className="p-2 font-medium">{m.method}</td>
                            <td className="p-2 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                              {formatQuantityDisplay(m.quantity)}
                            </td>
                            <td className="p-2 truncate max-w-[150px]">{m.destination}</td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveMethodEntry(m.method)}
                                className="p-1 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 rounded transition-all cursor-pointer"
                                title="Remove method"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Calculated Grand Total Indicator */}
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-950 text-right border-t border-gray-100 dark:border-slate-800 font-mono font-bold flex justify-between items-center text-xs">
                      <span className="text-gray-400 font-sans font-semibold">Grand Total:</span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {formatQuantityDisplay(formMethods.reduce((sum, m) => sum + (m.quantity || 0), 0))} MT
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center text-[11px] text-gray-400 bg-white dark:bg-slate-900 rounded-lg border border-gray-100 dark:border-slate-800">
                    No methods allocated. Select a method from the dropdown and click "Add Method" to allocate quantities.
                  </div>
                )}
              </div>

              {/* Section 3: Signatures */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-gray-100 dark:border-slate-800/80 space-y-3">
                <h4 className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest font-mono">Signatures & Approvals</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Signed By (Pollution Control Officer) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formSignedBy}
                      onChange={(e) => setFormSignedBy(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-gray-200 dark:border-slate-800 text-xs rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-smei-crimson uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Noted By (Asst. Admin/Technical Manager) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formNotedBy}
                      onChange={(e) => setFormNotedBy(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-gray-200 dark:border-slate-800 text-xs rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-smei-crimson uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold h-[38px] rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-smei-crimson hover:bg-smei-darkred text-white text-xs font-semibold h-[38px] rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer hover:scale-[1.02] active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingRecordId ? "Save Changes" : "Create Record"}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
