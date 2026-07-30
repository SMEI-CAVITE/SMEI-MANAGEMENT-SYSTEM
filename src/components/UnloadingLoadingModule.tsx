import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Search, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Trash2, 
  UploadCloud, 
  Calendar, 
  Edit,
  X
} from "lucide-react";
import { exportExcelWithTemplate } from "../utils/templateExport";
import { getTsdExportFilename } from "../utils/tsdFilename";
import { ExportExcelButton, CreateButton } from "./SharedButtons";
import { validateManifestNumber } from "../utils/manifestHelper";
import { formatControlNumber, normalizeControlNo } from "../utils/controlNumber";
import { attachRecordToWorkflow, setActiveWorkflow, getActiveWorkflow, getAllWorkflows, WorkflowRecord } from "../utils/workflowManager";
import { getHeavyPayload, saveHeavyPayload, deleteHeavyPayload, safeSetLocalStorage } from "../utils/heavyStorage";
import { notificationRepository } from "../services/notificationRepository";
import { uploadDocumentFile, deleteDocumentFile, getDocumentUrl } from "../services/storageService";
import { WorkflowRepository } from "../services/workflowRepository";

interface ComplianceRecord {
  id: string;
  workflowId?: string;
  caNumber: string;
  title: string;
  date: string;
  unloadingFileName?: string;
  unloadingFileData?: string; // base64 placeholder or data
  unloadingStoragePath?: string;
  unloadingDownloadUrl?: string;
  loadingFileName?: string;
  loadingFileData?: string; // base64 placeholder or data
  loadingStoragePath?: string;
  loadingDownloadUrl?: string;
  createdAt: string;
  uploadedBy?: string;
}

const PLACEHOLDER_GIF = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";

export default function UnloadingLoadingModule() {
  const [compRecords, setCompRecords] = useState<ComplianceRecord[]>([]);
  const [compSearch, setCompSearch] = useState("");
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ComplianceRecord | null>(null);

  // Form states
  const [compCA, setCompCA] = useState("");
  
  const [compUnloadingFileName, setCompUnloadingFileName] = useState("");
  const [compUnloadingData, setCompUnloadingData] = useState("");

  const [compLoadingFileName, setCompLoadingFileName] = useState("");
  const [compLoadingData, setCompLoadingData] = useState("");

  const [isUnloadingDragOver, setIsUnloadingDragOver] = useState(false);
  const [isLoadingDragOver, setIsLoadingDragOver] = useState(false);

  const [activeUnloadingData, setActiveUnloadingData] = useState<string>("");
  const [activeLoadingData, setActiveLoadingData] = useState<string>("");

  const handleRecordSelect = (rec: ComplianceRecord) => {
    setSelectedRecordId(rec.id);
    const activeWf = getActiveWorkflow();
    const allWorkflows = getAllWorkflows();
    const code = rec.caNumber;

    let targetWf = rec.workflowId ? allWorkflows.find((w) => w.id === rec.workflowId) : null;
    if (!targetWf && code) {
      targetWf = allWorkflows.find((w) => w.controlNo && normalizeControlNo(w.controlNo) === normalizeControlNo(code)) || null;
    }

    if (!targetWf) {
      targetWf = attachRecordToWorkflow("unloading-loading", rec, code);
    }

    if (targetWf && targetWf.id) {
      if (!activeWf || targetWf.id !== activeWf.id) {
        setActiveWorkflow(targetWf.id, targetWf.controlNo);
        window.dispatchEvent(new Event("tsd_data_changed"));
        window.dispatchEvent(new Event("tsd_workflows_updated"));
      }
    }
  };

  // Lazy-load data on selected record change
  useEffect(() => {
    if (selectedRecordId) {
      const rec = compRecords.find(r => r.id === selectedRecordId);
      if (rec) {
        const savedUnloading = getHeavyPayload(`tsd_unloading_data_${rec.id}`);
        setActiveUnloadingData(savedUnloading || (rec.unloadingFileData !== PLACEHOLDER_GIF ? rec.unloadingFileData : "") || "");

        const savedLoading = getHeavyPayload(`tsd_loading_data_${rec.id}`);
        setActiveLoadingData(savedLoading || (rec.loadingFileData !== PLACEHOLDER_GIF ? rec.loadingFileData : "") || "");
      } else {
        setActiveUnloadingData("");
        setActiveLoadingData("");
      }
    } else {
      setActiveUnloadingData("");
      setActiveLoadingData("");
    }
  }, [selectedRecordId, compRecords]);

  // Load from local storage with self-healing migration of legacy Base64 payloads
  useEffect(() => {
    const savedComp = localStorage.getItem("tsd_compliance_records");
    if (savedComp) {
      try {
        let parsed = JSON.parse(savedComp) as ComplianceRecord[];
        let migrated = false;

        parsed = parsed.map(rec => {
          let updated = false;
          if (rec.unloadingFileData && rec.unloadingFileData !== PLACEHOLDER_GIF) {
            saveHeavyPayload(`tsd_unloading_data_${rec.id}`, rec.unloadingFileData);
            updated = true;
            migrated = true;
          }
          if (rec.loadingFileData && rec.loadingFileData !== PLACEHOLDER_GIF) {
            saveHeavyPayload(`tsd_loading_data_${rec.id}`, rec.loadingFileData);
            updated = true;
            migrated = true;
          }
          if (updated) {
            return {
              ...rec,
              unloadingFileData: rec.unloadingFileName ? PLACEHOLDER_GIF : undefined,
              loadingFileData: rec.loadingFileName ? PLACEHOLDER_GIF : undefined
            };
          }
          return rec;
        });

        if (migrated) {
          safeSetLocalStorage("tsd_compliance_records", JSON.stringify(parsed));
        }

        setCompRecords(parsed);
        if (parsed.length > 0) {
          const activeWf = getActiveWorkflow();
          const match = activeWf
            ? parsed.find(
                (r) =>
                  r.workflowId === activeWf.id ||
                  (activeWf.controlNo && r.caNumber && normalizeControlNo(r.caNumber) === normalizeControlNo(activeWf.controlNo))
              )
            : null;
          setSelectedRecordId(match ? match.id : parsed[0].id);
        }
      } catch (e) {
        console.error("Failed to parse compliance records", e);
      }
    } else {
      const initial: ComplianceRecord[] = [
        {
          id: "comp-1",
          caNumber: "M-R3-2026-07-632758",
          title: "Inbound Acid Digestion Consignment Checklist",
          date: new Date().toISOString().split("T")[0],
          unloadingFileName: "inbound_leak_test_report.pdf",
          unloadingFileData: PLACEHOLDER_GIF,
          loadingFileName: "treated_ash_consignment_receipt.pdf",
          loadingFileData: PLACEHOLDER_GIF,
          createdAt: new Date().toLocaleDateString() + " 10:00 AM"
        }
      ];
      setCompRecords(initial);
      setSelectedRecordId(initial[0].id);
      safeSetLocalStorage("tsd_compliance_records", JSON.stringify(initial));
    }
  }, []);

  const saveCompToStorage = (updated: ComplianceRecord[]) => {
    // Keep metadata registry lightweight by replacing binary payloads with PLACEHOLDER_GIF
    const sanitized = updated.map(rec => ({
      ...rec,
      unloadingFileData: rec.unloadingFileName ? PLACEHOLDER_GIF : undefined,
      loadingFileData: rec.loadingFileName ? PLACEHOLDER_GIF : undefined
    }));

    setCompRecords(sanitized);
    safeSetLocalStorage("tsd_compliance_records", JSON.stringify(sanitized));
    if (sanitized && sanitized.length > 0 && sanitized[0].caNumber) {
      safeSetLocalStorage("tsd_active_control_no", sanitized[0].caNumber.toUpperCase());
    }

    window.dispatchEvent(new Event("tsd_data_changed"));
    window.dispatchEvent(new Event("tsd_workflows_updated"));
    window.dispatchEvent(new Event("tsd_storage_updated"));
  };

  const processUnloadingFile = (file: File) => {
    const allowedExtensions = ["pdf", "png", "jpg", "jpeg"];
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!allowedExtensions.includes(ext)) {
      alert("Invalid file format. Supported formats are PDF, PNG, JPG, and JPEG.");
      return;
    }
    
    const maxSize = 5 * 1024 * 1024; // 5MB limit
    if (file.size > maxSize) {
      alert("File size exceeds 5MB limit. Please upload a smaller file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setCompUnloadingFileName(file.name);
      setCompUnloadingData(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUnloadingFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUnloadingFile(file);
    }
  };

  const handleUnloadingDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsUnloadingDragOver(true);
  };

  const handleUnloadingDragLeave = () => {
    setIsUnloadingDragOver(false);
  };

  const handleUnloadingDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsUnloadingDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processUnloadingFile(file);
    }
  };

  const processLoadingFile = (file: File) => {
    const allowedExtensions = ["pdf", "png", "jpg", "jpeg"];
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!allowedExtensions.includes(ext)) {
      alert("Invalid file format. Supported formats are PDF, PNG, JPG, and JPEG.");
      return;
    }
    
    const maxSize = 5 * 1024 * 1024; // 5MB limit
    if (file.size > maxSize) {
      alert("File size exceeds 5MB limit. Please upload a smaller file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setCompLoadingFileName(file.name);
      setCompLoadingData(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleLoadingFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processLoadingFile(file);
    }
  };

  const handleLoadingDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsLoadingDragOver(true);
  };

  const handleLoadingDragLeave = () => {
    setIsLoadingDragOver(false);
  };

  const handleLoadingDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsLoadingDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processLoadingFile(file);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRecord(null);
    setCompCA("");
    setCompUnloadingFileName("");
    setCompUnloadingData("");
    setCompLoadingFileName("");
    setCompLoadingData("");
  };

  const handleCreateNew = () => {
    handleCloseModal();
    setIsModalOpen(true);
  };

  const handleSaveCompliance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compCA.trim()) {
      alert("Manifest Number is a required field.");
      return;
    }

    let updatedDocs = [...compRecords];
    const recordId = editingRecord ? editingRecord.id : `comp-${Date.now()}`;
    const cleanCA = compCA.toUpperCase();

    // Upload unloading file to Firebase Storage if provided
    let unloadingStoragePath = editingRecord?.unloadingStoragePath;
    let unloadingDownloadUrl = editingRecord?.unloadingDownloadUrl;
    if (compUnloadingData && compUnloadingData !== PLACEHOLDER_GIF) {
      saveHeavyPayload(`tsd_unloading_data_${recordId}`, compUnloadingData);
      try {
        const uRes = await uploadDocumentFile(compUnloadingData, `unloading-loading/${cleanCA}`, compUnloadingFileName || "unloading.png");
        unloadingStoragePath = uRes.storagePath;
        unloadingDownloadUrl = uRes.downloadUrl;
      } catch (e) {
        console.warn("[UnloadingStorage] Firebase storage upload fallback:", e);
      }
    }

    // Upload loading file to Firebase Storage if provided
    let loadingStoragePath = editingRecord?.loadingStoragePath;
    let loadingDownloadUrl = editingRecord?.loadingDownloadUrl;
    if (compLoadingData && compLoadingData !== PLACEHOLDER_GIF) {
      saveHeavyPayload(`tsd_loading_data_${recordId}`, compLoadingData);
      try {
        const lRes = await uploadDocumentFile(compLoadingData, `unloading-loading/${cleanCA}`, compLoadingFileName || "loading.png");
        loadingStoragePath = lRes.storagePath;
        loadingDownloadUrl = lRes.downloadUrl;
      } catch (e) {
        console.warn("[LoadingStorage] Firebase storage upload fallback:", e);
      }
    }

    let targetRecord: ComplianceRecord;
    let targetWf: WorkflowRecord;

    if (editingRecord) {
      // Edit mode
      targetRecord = {
        ...editingRecord,
        caNumber: cleanCA,
        unloadingFileName: compUnloadingFileName || editingRecord.unloadingFileName,
        unloadingFileData: compUnloadingFileName ? PLACEHOLDER_GIF : undefined,
        unloadingStoragePath,
        unloadingDownloadUrl,
        loadingFileName: compLoadingFileName || editingRecord.loadingFileName,
        loadingFileData: compLoadingFileName ? PLACEHOLDER_GIF : undefined,
        loadingStoragePath,
        loadingDownloadUrl
      };
      try {
        targetWf = attachRecordToWorkflow("unloading-loading", targetRecord, targetRecord.caNumber);
      } catch (err: any) {
        alert(err.message || "No active workflow is selected. Please select or create a workflow before saving this document.");
        return;
      }

      // Save to Firestore FIRST
      try {
        await WorkflowRepository.saveUnloadingRecord(targetRecord);
      } catch (fsErr: any) {
        console.error("[UnloadingLoadingModule] Failed to save record to Firestore:", fsErr);
        alert("Firestore Persistence Error: Unable to save record to database. Please check your network connection and try again.");
        return;
      }

      updatedDocs = compRecords.map(r => r.id === editingRecord.id ? targetRecord : r);
      saveCompToStorage(updatedDocs);
      setSelectedRecordId(editingRecord.id);
    } else {
      // New record
      targetRecord = {
        id: recordId,
        caNumber: cleanCA,
        title: "Geotagged Loading and Unloading Photograph Record",
        date: new Date().toISOString().split("T")[0],
        unloadingFileName: compUnloadingFileName || undefined,
        unloadingFileData: compUnloadingFileName ? PLACEHOLDER_GIF : undefined,
        unloadingStoragePath,
        unloadingDownloadUrl,
        loadingFileName: compLoadingFileName || undefined,
        loadingFileData: compLoadingFileName ? PLACEHOLDER_GIF : undefined,
        loadingStoragePath,
        loadingDownloadUrl,
        createdAt: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      try {
        targetWf = attachRecordToWorkflow("unloading-loading", targetRecord, targetRecord.caNumber);
      } catch (err: any) {
        alert(err.message || "No active workflow is selected. Please select or create a workflow before saving this document.");
        return;
      }

      // Save to Firestore FIRST
      try {
        await WorkflowRepository.saveUnloadingRecord(targetRecord);
      } catch (fsErr: any) {
        console.error("[UnloadingLoadingModule] Failed to save record to Firestore:", fsErr);
        alert("Firestore Persistence Error: Unable to save record to database. Please check your network connection and try again.");
        return;
      }

      updatedDocs = [targetRecord, ...compRecords];
      saveCompToStorage(updatedDocs);
      setSelectedRecordId(targetRecord.id);
    }

    notificationRepository.createNotification({
      portal: "TSD",
      module: "unloading-loading",
      workflowId: targetWf.id,
      documentId: targetRecord.id,
      documentNumber: targetRecord.caNumber,
      title: editingRecord ? "Unloading / Loading Record Updated" : "Unloading / Loading Record Completed",
      message: `Unloading/Loading photograph record ${editingRecord ? 'updated' : 'saved'} for Workflow ${targetWf.workflowCode || targetWf.id} (Control No: ${compCA.toUpperCase()}).`,
      priority: "MEDIUM"
    }).catch(() => {});

    handleCloseModal();
  };

  const handleEditComp = (record: ComplianceRecord) => {
    setEditingRecord(record);
    setCompCA((record.caNumber || "").toUpperCase());
    
    setCompUnloadingFileName(record.unloadingFileName || "");
    const savedUnloading = getHeavyPayload(`tsd_unloading_data_${record.id}`);
    setCompUnloadingData(savedUnloading || (record.unloadingFileData !== PLACEHOLDER_GIF ? record.unloadingFileData : "") || "");

    setCompLoadingFileName(record.loadingFileName || "");
    const savedLoading = getHeavyPayload(`tsd_loading_data_${record.id}`);
    setCompLoadingData(savedLoading || (record.loadingFileData !== PLACEHOLDER_GIF ? record.loadingFileData : "") || "");

    setIsModalOpen(true);
  };

  const handleDeleteComp = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm("Are you sure you want to permanently delete this unloading/loading compliance record?")) {
      try {
        await WorkflowRepository.deleteUnloadingRecord(id);
      } catch (fsErr) {
        console.error("[UnloadingLoadingModule] Failed to delete record from Firestore:", fsErr);
      }
      const updated = compRecords.filter(r => r.id !== id);
      saveCompToStorage(updated);
      deleteHeavyPayload(`tsd_unloading_data_${id}`);
      deleteHeavyPayload(`tsd_loading_data_${id}`);
      if (selectedRecordId === id) {
        setSelectedRecordId(updated.length > 0 ? updated[0].id : null);
      }
      if (editingRecord?.id === id) {
        handleCloseModal();
      }
    }
  };

  const handleExportExcel = async (record: ComplianceRecord) => {
    try {
      const FALLBACK_1X1_PNG = "data:image/png;base64,iVBOR000KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
      const unloadingPayload = getHeavyPayload(`tsd_unloading_data_${record.id}`) || (record.unloadingFileData !== PLACEHOLDER_GIF ? record.unloadingFileData : "") || FALLBACK_1X1_PNG;
      const loadingPayload = getHeavyPayload(`tsd_loading_data_${record.id}`) || (record.loadingFileData !== PLACEHOLDER_GIF ? record.loadingFileData : "") || FALLBACK_1X1_PNG;

      const exportData = {
        CONTROL_NO: record.caNumber,
        CA_NO: record.caNumber,
        UNLOADING_IMAGE: unloadingPayload,
        LOADING_IMAGE: loadingPayload
      };

      const exportFileName = getTsdExportFilename("unloading-loading", record.date || record.createdAt, "xlsm");

      await exportExcelWithTemplate(
        "UNLOADING_LOADING_TEMPLATE.xlsm",
        exportData,
        "items",
        [],
        exportFileName
      );
    } catch (err) {
      console.error("Excel Export failed", err);
      alert("Failed to export Excel file. Please verify UNLOADING_LOADING_TEMPLATE.xlsm exists in /templates.");
    }
  };

  const handleExportExcelSelected = () => {
    const selected = compRecords.find(r => r.id === selectedRecordId);
    if (selected) {
      handleExportExcel(selected);
    } else {
      alert("Please select a record from the table first.");
    }
  };

  const handleDownloadAttachment = (fileData: string | undefined, fileName: string | undefined) => {
    if (!fileData || !fileName) {
      alert("No attachment file is associated with this section.");
      return;
    }
    const link = document.createElement("a");
    link.href = fileData;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredComp = compRecords.filter(r => {
    const safeCaNumber = r.caNumber || "";
    const safeTitle = r.title || "";
    const term = (compSearch || "").toLowerCase();
    return safeCaNumber.toLowerCase().includes(term) ||
           safeTitle.toLowerCase().includes(term);
  });

  const selectedRecord = compRecords.find(r => r.id === selectedRecordId);

  return (
    <div id="smei-loading-portal" className="p-4 md:p-6 space-y-6 max-w-[130rem] mx-auto w-full text-gray-800 dark:text-slate-100">
      {/* Header Block matching Purchase Order Portal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white tracking-tight font-display uppercase">
            Unloading & Loading Compliance Portal
          </h2>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage receiving checklists, unloading procedures, and loading compliance clearances with Microsoft Word report exports.
          </p>
        </div>
      </div>

      {/* Standard Management Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <CreateButton
            onClick={handleCreateNew}
            label="+ New Unloading / Loading Log"
          />

          <ExportExcelButton
            onClick={handleExportExcelSelected}
            disabled={!selectedRecordId}
          />

          {selectedRecord && (
            <div className="flex items-center gap-2 ml-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase font-mono tracking-wider">Selected:</span>
              <span className="text-[11px] font-bold font-mono text-smei-crimson bg-red-50 border border-red-200 px-2.5 py-1 rounded-md">
                {selectedRecord.caNumber}
              </span>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Manifest Number or Title..."
            value={compSearch}
            onChange={(e) => setCompSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent focus:bg-white dark:focus:bg-slate-900 transition-all text-gray-700 dark:text-slate-200 font-mono"
          />
        </div>
      </div>

      {/* Records Table and Selected Summary Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Table Column */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-gray-800 dark:text-slate-200 font-display uppercase tracking-wider flex items-center gap-2">
              <span>Safety Compliance Records</span>
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                {filteredComp.length} Records
              </span>
            </h3>
          </div>

          <div className="border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4 font-display">Manifest Number</th>
                    <th className="py-3 px-4 font-display">Title / Header</th>
                    <th className="py-3 px-4 font-display">Date</th>
                    <th className="py-3 px-4 font-display">Attachments</th>
                    <th className="py-3 px-4 font-display text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80">
                  {filteredComp.length > 0 ? (
                    filteredComp.map((rec, index) => (
                      <tr
                        key={rec.id}
                        onClick={() => handleRecordSelect(rec)}
                        onDoubleClick={() => handleEditComp(rec)}
                        className={`cursor-pointer transition-all group ${
                          selectedRecordId === rec.id
                            ? "bg-red-600/10 border-l-4 border-l-smei-crimson font-medium"
                            : index % 2 === 1
                            ? "bg-gray-50/45 hover:bg-red-600/5"
                            : "bg-white dark:bg-slate-900 hover:bg-red-600/5"
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-smei-crimson dark:text-rose-400">
                          {rec.caNumber}
                        </td>
                        <td className="py-3 px-4 text-gray-800 dark:text-slate-200 font-medium truncate max-w-[180px]">
                          {rec.title}
                        </td>
                        <td className="py-3 px-4 text-gray-500 dark:text-slate-400 font-mono">
                          {rec.date}
                        </td>
                        <td className="py-3 px-4 text-gray-500 dark:text-slate-400">
                          <div className="flex gap-1.5">
                            {rec.unloadingFileName && (
                              <span className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-rose-400 text-[9px] font-mono px-1.5 py-0.5 rounded border border-red-100 dark:border-red-900/30">
                                Unload
                              </span>
                            )}
                            {rec.loadingFileName && (
                              <span className="bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 text-[9px] font-mono px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-900/30">
                                Load
                              </span>
                            )}
                            {!rec.unloadingFileName && !rec.loadingFileName && (
                              <span className="text-gray-400 dark:text-slate-600 font-mono text-[10px]">None</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleEditComp(rec)}
                              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-smei-crimson text-gray-400 dark:text-slate-500 rounded-lg transition-all"
                              title="Edit Log"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteComp(rec.id, e)}
                              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-smei-crimson text-gray-400 dark:text-slate-500 rounded-lg transition-all"
                              title="Delete Log"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-400 dark:text-slate-500">
                        <span>No records found. Click </span>
                        <button
                          type="button"
                          onClick={handleCreateNew}
                          className="text-smei-crimson dark:text-rose-400 font-bold hover:underline cursor-pointer inline-flex items-center gap-1 mx-1"
                        >
                          + New Unloading / Loading Log
                        </button>
                        <span> to create a new record.</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Selected Record Detail Panel */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-gray-400 dark:text-slate-500 font-mono uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-3">
            Active Selection Summary
          </h3>

          {selectedRecord ? (
            <div className="space-y-4">
              <div className="space-y-1 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-gray-100 dark:border-slate-800">
                <div className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">SELECTED MANIFEST NUMBER</div>
                <div className="text-sm font-bold text-smei-crimson dark:text-rose-400 font-mono select-all">
                  {selectedRecord.caNumber}
                </div>
                <div className="text-xs font-semibold text-gray-800 dark:text-white mt-1">
                  {selectedRecord.title}
                </div>
                <div className="text-[10px] text-gray-400 dark:text-slate-500 font-mono pt-1">
                  Date: {selectedRecord.date}
                </div>
              </div>

              {/* Unloading */}
              <div className="space-y-2 text-xs bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-gray-100 dark:border-slate-800">
                <div className="text-[10px] font-mono font-bold text-smei-crimson dark:text-rose-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1 flex justify-between items-center">
                  <span>Unloading Compliance</span>
                  {selectedRecord.unloadingFileName && (
                    <button
                      onClick={() => handleDownloadAttachment(activeUnloadingData, selectedRecord.unloadingFileName)}
                      className="text-gray-400 hover:text-smei-crimson dark:hover:text-rose-400 font-mono text-[9px] lowercase flex items-center gap-1 cursor-pointer"
                    >
                      Download Attachment
                    </button>
                  )}
                </div>
                {selectedRecord.unloadingFileName && (
                  <div className="text-[9px] font-mono text-gray-400 dark:text-slate-500 truncate bg-white dark:bg-slate-900 p-1.5 rounded border border-gray-100 dark:border-slate-800">
                    File: {selectedRecord.unloadingFileName}
                  </div>
                )}
                {activeUnloadingData && activeUnloadingData.startsWith("data:image/") ? (
                  <div className="mt-2 relative w-full aspect-video rounded-lg overflow-hidden border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center shadow-xs">
                    <img 
                      src={activeUnloadingData} 
                      alt="Unloading Preview"
                      referrerPolicy="no-referrer"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                ) : selectedRecord.unloadingFileName ? (
                  <div className="mt-2 p-3 rounded-lg border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-slate-500 shadow-xs">
                    <FileText className="w-8 h-8 text-amber-500" />
                    <span className="text-[10px] font-sans truncate max-w-full">{selectedRecord.unloadingFileName} (PDF)</span>
                  </div>
                ) : (
                  <div className="mt-2 h-20 rounded-lg border border-dashed border-gray-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-slate-500">
                    <UploadCloud className="w-5 h-5 opacity-40" />
                    <span className="text-[10px] font-sans text-gray-400">No unloading image uploaded</span>
                  </div>
                )}
              </div>

              {/* Loading */}
              <div className="space-y-2 text-xs bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-gray-100 dark:border-slate-800">
                <div className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1 flex justify-between items-center">
                  <span>Loading Compliance</span>
                  {selectedRecord.loadingFileName && (
                    <button
                      onClick={() => handleDownloadAttachment(activeLoadingData, selectedRecord.loadingFileName)}
                      className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 font-mono text-[9px] lowercase flex items-center gap-1 cursor-pointer"
                    >
                      Download Attachment
                    </button>
                  )}
                </div>
                {selectedRecord.loadingFileName && (
                  <div className="text-[9px] font-mono text-gray-400 dark:text-slate-500 truncate bg-white dark:bg-slate-900 p-1.5 rounded border border-gray-100 dark:border-slate-800">
                    File: {selectedRecord.loadingFileName}
                  </div>
                )}
                {activeLoadingData && activeLoadingData.startsWith("data:image/") ? (
                  <div className="mt-2 relative w-full aspect-video rounded-lg overflow-hidden border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center shadow-xs">
                    <img 
                      src={activeLoadingData} 
                      alt="Loading Preview"
                      referrerPolicy="no-referrer"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                ) : selectedRecord.loadingFileName ? (
                  <div className="mt-2 p-3 rounded-lg border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-slate-500 shadow-xs">
                    <FileText className="w-8 h-8 text-blue-500" />
                    <span className="text-[10px] font-sans truncate max-w-full">{selectedRecord.loadingFileName} (PDF)</span>
                  </div>
                ) : (
                  <div className="mt-2 h-20 rounded-lg border border-dashed border-gray-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-slate-500">
                    <UploadCloud className="w-5 h-5 opacity-40" />
                    <span className="text-[10px] font-sans text-gray-400">No loading image uploaded</span>
                  </div>
                )}
              </div>


            </div>
          ) : (
            <div className="py-16 text-center text-gray-400 dark:text-slate-500 text-xs">
              Select a record from the safety registry table to view details and trigger export controls.
            </div>
          )}
        </div>

      </div>

      {/* Form Dialog Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-100 dark:border-slate-800 max-w-lg w-full overflow-hidden animate-fadeIn flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800 dark:text-slate-200 font-display flex items-center gap-1.5 uppercase tracking-wider">
                <span>{editingRecord ? "EDIT UNLOADING/LOADING LOG" : "NEW UNLOADING/LOADING LOG"}</span>
              </h3>
              <button 
                type="button"
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1 rounded-full hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveCompliance} className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Manifest Number */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    MANIFEST NUMBER *
                  </label>
                  {compCA && !validateManifestNumber(compCA) && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-500 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Invalid format
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={compCA}
                  onChange={(e) => setCompCA(formatControlNumber(e.target.value, "manifestNo"))}
                  placeholder="e.g. M-R3-2026-07-632758"
                  className={`w-full bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 border rounded-lg text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent font-mono ${
                    compCA && !validateManifestNumber(compCA)
                      ? "border-amber-400 dark:border-amber-500 focus:ring-amber-500"
                      : "border-gray-200 dark:border-slate-800"
                  }`}
                />
                {compCA && !validateManifestNumber(compCA) && (
                  <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 leading-normal space-y-0.5">
                    <p className="font-semibold">Use the format M-{"{"}REGION{"}"}-YYYY-MM-#</p>
                    <p className="text-gray-500 dark:text-slate-400 font-normal">
                      For example: M-R3-2026-07-632758. The region (e.g. R1, R2, R4A, NCR) must remain dynamic.
                    </p>
                  </div>
                )}
              </div>

              {/* Introductory Static Description */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950/80 rounded-xl border border-gray-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs leading-relaxed font-sans">
                In compliance with the Permit to Transport provision no. 5, below are the geotagged photograph of actual loading and unloading of Hazardous Wastes.
              </div>

              {/* Loading Section */}
              <div className="space-y-2.5 bg-blue-50/30 dark:bg-blue-950/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/20">
                <h4 className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide font-mono">
                  LOADING PHOTO ( Generator's Plant )
                </h4>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">
                    UPLOAD FILE (PDF/IMAGE)
                  </label>
                  <div
                    onDragOver={handleLoadingDragOver}
                    onDragLeave={handleLoadingDragLeave}
                    onDrop={handleLoadingDrop}
                    className={`relative flex flex-col items-center justify-center p-3 border-2 border-dashed rounded-lg transition-all ${
                      isLoadingDragOver
                        ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                        : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500"
                    }`}
                  >
                    {compLoadingData ? (
                      <div className="w-full space-y-2">
                        <div className="flex items-center justify-between gap-2 p-2 bg-slate-50 dark:bg-slate-950 rounded-lg">
                          <div className="flex items-center gap-2 truncate">
                            {compLoadingData.startsWith("data:image/") ? (
                              <img src={compLoadingData} alt="Loading Preview" className="w-8 h-8 object-cover rounded border shrink-0" />
                            ) : (
                              <FileText className="w-6 h-6 text-blue-500 shrink-0" />
                            )}
                            <span className="text-xs font-mono truncate text-gray-700 dark:text-slate-300">{compLoadingFileName}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setCompLoadingFileName("");
                              setCompLoadingData("");
                            }}
                            className="p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer shrink-0"
                            title="Remove file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {compLoadingData.startsWith("data:image/") && (
                          <div className="relative aspect-video rounded overflow-hidden border bg-black/5 dark:bg-white/5 flex items-center justify-center">
                            <img src={compLoadingData} alt="Preview" className="max-h-[100px] object-contain" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <label className="flex flex-col items-center gap-1.5 cursor-pointer text-center w-full py-3">
                        <UploadCloud className="w-6 h-6 text-gray-400" />
                        <span className="text-xs font-semibold text-gray-600 dark:text-slate-300">
                          Drag file here, or click to browse
                        </span>
                        <span className="text-[9px] text-gray-400">
                          PDF, PNG, JPG, JPEG (Max 5MB)
                        </span>
                        <input 
                          type="file" 
                          accept=".pdf,.png,.jpg,.jpeg" 
                          className="hidden" 
                          onChange={handleLoadingFileChange} 
                        />
                      </label>
                    )}
                  </div>
                </div>

                <p className="text-xs text-gray-600 dark:text-slate-300 font-sans italic">
                  Material placed in pallets/bags are being loaded in the truck.
                </p>
              </div>

              {/* Unloading Section */}
              <div className="space-y-2.5 bg-red-50/30 dark:bg-red-950/10 p-4 rounded-xl border border-red-100 dark:border-red-900/20">
                <h4 className="text-[11px] font-bold text-smei-crimson dark:text-rose-400 uppercase tracking-wide font-mono">
                  UNLOADING PHOTO ( Treater's Plant )
                </h4>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">
                    UPLOAD FILE (PDF/IMAGE)
                  </label>
                  <div
                    onDragOver={handleUnloadingDragOver}
                    onDragLeave={handleUnloadingDragLeave}
                    onDrop={handleUnloadingDrop}
                    className={`relative flex flex-col items-center justify-center p-3 border-2 border-dashed rounded-lg transition-all ${
                      isUnloadingDragOver
                        ? "border-smei-crimson bg-red-50/50 dark:bg-red-950/20"
                        : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-smei-crimson"
                    }`}
                  >
                    {compUnloadingData ? (
                      <div className="w-full space-y-2">
                        <div className="flex items-center justify-between gap-2 p-2 bg-slate-50 dark:bg-slate-950 rounded-lg">
                          <div className="flex items-center gap-2 truncate">
                            {compUnloadingData.startsWith("data:image/") ? (
                              <img src={compUnloadingData} alt="Unloading Preview" className="w-8 h-8 object-cover rounded border shrink-0" />
                            ) : (
                              <FileText className="w-6 h-6 text-rose-500 shrink-0" />
                            )}
                            <span className="text-xs font-mono truncate text-gray-700 dark:text-slate-300">{compUnloadingFileName}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setCompUnloadingFileName("");
                              setCompUnloadingData("");
                            }}
                            className="p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer shrink-0"
                            title="Remove file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {compUnloadingData.startsWith("data:image/") && (
                          <div className="relative aspect-video rounded overflow-hidden border bg-black/5 dark:bg-white/5 flex items-center justify-center">
                            <img src={compUnloadingData} alt="Preview" className="max-h-[100px] object-contain" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <label className="flex flex-col items-center gap-1.5 cursor-pointer text-center w-full py-3">
                        <UploadCloud className="w-6 h-6 text-gray-400" />
                        <span className="text-xs font-semibold text-gray-600 dark:text-slate-300">
                          Drag file here, or click to browse
                        </span>
                        <span className="text-[9px] text-gray-400">
                          PDF, PNG, JPG, JPEG (Max 5MB)
                        </span>
                        <input 
                          type="file" 
                          accept=".pdf,.png,.jpg,.jpeg" 
                          className="hidden" 
                          onChange={handleUnloadingFileChange} 
                        />
                      </label>
                    )}
                  </div>
                </div>

                <p className="text-xs text-gray-600 dark:text-slate-300 font-sans italic">
                  Materials placed in pallets/bags are being unloaded in the truck.
                </p>
              </div>

              {/* Form Actions */}
              <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold h-[38px] rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-smei-crimson hover:bg-smei-darkred text-white text-xs font-semibold h-[38px] rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer hover:scale-[1.02] active:scale-95 uppercase tracking-wider"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{editingRecord ? "SAVE" : "CREATE / SAVE"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
