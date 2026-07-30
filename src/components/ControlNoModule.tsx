import React, { useState, useEffect, useRef } from "react";
import { 
  UploadCloud, 
  Search, 
  Download, 
  Trash2, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  File, 
  Loader2,
  X,
  Sparkles,
  Layers,
  Pencil
} from "lucide-react";
import { attachCaNoToPdf } from "../utils/pdfStamper";
import { formatControlNumber, validateControlNumber, getNextCaNo, normalizeControlNo, isControlNumberDuplicate } from "../utils/controlNumber";
import { saveDocumentBinary, deleteDocumentBinary, getDocumentBinary } from "../utils/documentStorage";
import { processManifestDocument } from "../utils/manifestParser";
import { saveManifestRecord, deleteManifestRecordByDocId, getAllManifestRecords, saveAllManifestRecords } from "../utils/manifestStorage";
import { attachRecordToWorkflow, setActiveWorkflow, getActiveWorkflow, getAllWorkflows, propagateControlNoToWorkflowDocs, saveWorkflows } from "../utils/workflowManager";
import { notificationRepository } from "../services/notificationRepository";
import { uploadDocumentFile, deleteDocumentFile, getDocumentUrl } from "../services/storageService";
import { WorkflowRepository } from "../services/workflowRepository";

interface UploadedDocument {
  id: string;
  fileName: string;
  fileSize: string;
  fileType: string;
  uploadedAt: string;
  caNumber: string;
  fileData?: string; // Base64 data URL
  workflowId?: string;
  storagePath?: string;
  downloadUrl?: string;
  uploadedBy?: string;
}

/**
 * Auto-formats numeric input into MM-####-YY format as user types.
 */
export function formatCaNoInput(val: string): string {
  return formatControlNumber(val, "caNo");
}

/**
 * Validates CA No. format MM-####-YY
 */
export function isValidCaNo(caNo: string): boolean {
  return validateControlNumber(caNo, "caNo").isValid;
}

export default function ControlNoModule() {
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File pending CA No. input modal state
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showCaNoModal, setShowCaNoModal] = useState(false);
  const [caNoInput, setCaNoInput] = useState("");
  const [validationError, setValidationError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    currentFileName: string;
    currentCaNo: string;
  } | null>(null);

  // Preview modal state (disabled - replaced with workflow selection)
  const [previewDoc, setPreviewDoc] = useState<UploadedDocument | null>(null);
  const [activeDocData, setActiveDocData] = useState<string>("");

  // Active tracking code state
  const [activeControlNo, setActiveControlNo] = useState<string>(() => {
    return localStorage.getItem("tsd_active_control_no") || "";
  });

  useEffect(() => {
    const syncActiveNo = () => {
      const active = localStorage.getItem("tsd_active_control_no") || "";
      setActiveControlNo(active);
    };
    window.addEventListener("storage", syncActiveNo);
    window.addEventListener("tsd_data_changed", syncActiveNo);
    window.addEventListener("tsd_storage_updated", syncActiveNo);
    return () => {
      window.removeEventListener("storage", syncActiveNo);
      window.removeEventListener("tsd_data_changed", syncActiveNo);
      window.removeEventListener("tsd_storage_updated", syncActiveNo);
    };
  }, []);

  const handleSelectWorkflow = (doc: UploadedDocument) => {
    const code = doc.caNumber ? normalizeControlNo(doc.caNumber) : undefined;
    const activeWf = getActiveWorkflow();
    const allWorkflows = getAllWorkflows();

    let targetWf = doc.workflowId ? allWorkflows.find((w) => w.id === doc.workflowId) : null;
    if (!targetWf && code) {
      targetWf = allWorkflows.find((w) => w.controlNo && normalizeControlNo(w.controlNo) === code) || null;
    }

    if (!targetWf) {
      targetWf = attachRecordToWorkflow("control-no", doc, code);
    }

    if (targetWf && targetWf.id) {
      if (!activeWf || targetWf.id !== activeWf.id) {
        setActiveWorkflow(targetWf.id, targetWf.controlNo);
      }
    }

    if (code) {
      localStorage.setItem("tsd_active_control_no", code);
      setActiveControlNo(code);
    }
    window.dispatchEvent(new Event("tsd_data_changed"));
    window.dispatchEvent(new Event("tsd_workflows_updated"));
  };

  // Edit Control Number modal state
  const [editingDoc, setEditingDoc] = useState<UploadedDocument | null>(null);
  const [editCaNoInput, setEditCaNoInput] = useState("");
  const [editValidationError, setEditValidationError] = useState("");

  // Load uploaded compliance documents from localStorage on mount
  useEffect(() => {
    loadDocsFromStorage();
  }, []);

  const loadDocsFromStorage = () => {
    const savedDocs = localStorage.getItem("tsd_uploaded_compliance_docs");
    if (savedDocs) {
      try {
        const parsed = JSON.parse(savedDocs) as UploadedDocument[];
        const docsWithData = parsed.map(doc => {
          const fileData = localStorage.getItem(`tsd_doc_data_${doc.id}`) || doc.fileData || "";
          return { ...doc, fileData };
        });
        setUploadedDocs(docsWithData);
      } catch (e) {
        console.error("Failed to parse compliance documents", e);
      }
    }
  };

  const saveDocsToStorage = (updated: UploadedDocument[]) => {
    setUploadedDocs(updated);
    // Strip inline fileData when saving main metadata list to prevent storage overflow
    const safeDocs = updated.map(({ fileData, ...rest }) => rest);
    localStorage.setItem("tsd_uploaded_compliance_docs", JSON.stringify(safeDocs));
    window.dispatchEvent(new Event("tsd_data_changed"));
  };

  /**
   * Safely append a single document to localStorage reading fresh data to prevent stale closure data loss
   */
  const appendDocToStorage = async (newDoc: UploadedDocument) => {
    try {
      attachRecordToWorkflow("control-no", newDoc, newDoc.caNumber);
    } catch (err: any) {
      alert(err.message || "No active workflow is selected. Please select or create a workflow before saving this document.");
      throw err;
    }
    if (newDoc.caNumber) {
      localStorage.setItem("tsd_active_control_no", normalizeControlNo(newDoc.caNumber));
    }
    const existingRaw = localStorage.getItem("tsd_uploaded_compliance_docs");
    let existingDocs: UploadedDocument[] = [];
    if (existingRaw) {
      try {
        existingDocs = JSON.parse(existingRaw);
      } catch (e) {
        console.error("Failed to parse existing compliance docs", e);
      }
    }

    // Defensive check: ensure caNumber does not conflict with another document
    const normNewCa = normalizeControlNo(newDoc.caNumber);
    if (normNewCa) {
      const existingConflict = existingDocs.find(
        (d) => d.id !== newDoc.id && normalizeControlNo(d.caNumber) === normNewCa
      );
      if (existingConflict) {
        throw new Error(`A Control Number with identifier "${newDoc.caNumber}" already exists.`);
      }
    }

    // Save metadata to Firestore
    try {
      const safeDocToSave = { ...newDoc };
      delete safeDocToSave.fileData;
      await WorkflowRepository.saveComplianceDoc(safeDocToSave);
    } catch (fsErr: any) {
      console.error("[ControlNoModule] Failed to save compliance doc to Firestore:", fsErr);
      alert(`Firestore Persistence Error: Unable to save document ${newDoc.fileName} to database. ${fsErr?.message || ''}`);
      throw fsErr;
    }

    const updated = [newDoc, ...existingDocs.filter(d => d.id !== newDoc.id)];
    saveDocsToStorage(updated);
  };

  // Handle PDF file selection / drop
  const handleFilesSelected = (files: File[]) => {
    console.log(`[FORENSIC STAGE 1] File Selection triggered. Total files received: ${files.length}`);
    files.forEach((f, idx) => {
      console.log(`  File ${idx + 1}: name="${f.name}", size=${f.size} bytes, type="${f.type}"`);
    });

    const pdfFiles = files.filter(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    console.log(`[FORENSIC STAGE 1] Valid PDF files filtered: ${pdfFiles.length} / ${files.length}`);

    if (pdfFiles.length === 0) {
      alert("Please select valid PDF files.");
      return;
    }

    setPendingFiles(pdfFiles);
    setCaNoInput("");
    setValidationError("");
    setBatchProgress(null);
    setShowCaNoModal(true);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesSelected(Array.from(e.target.files));
    }
    // Reset file input value so the same files can be re-selected if cancelled
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle CA No. text input with auto-dash formatting
  const handleCaNoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const formatted = formatCaNoInput(rawVal);
    setCaNoInput(formatted);

    if (validationError) {
      if (isValidCaNo(formatted)) {
        setValidationError("");
      }
    }
  };

  /**
   * Process pending PDF batch (Save or Download+Save)
   */
  const handleBatchProcess = async (downloadPdf: boolean = false) => {
    if (!pendingFiles || pendingFiles.length === 0) return;

    if (!isValidCaNo(caNoInput)) {
      setValidationError("Please enter a valid starting CA No. using the format MM-####-YY.");
      return;
    }

    setValidationError("");

    const totalFiles = pendingFiles.length;
    const seenInBatch = new Set<string>();

    for (let i = 0; i < totalFiles; i++) {
      const checkCaNo = getNextCaNo(caNoInput, i);
      const norm = normalizeControlNo(checkCaNo);

      if (seenInBatch.has(norm)) {
        setValidationError(`Duplicate Control Number "${checkCaNo}" generated within batch. Please specify a unique starting number.`);
        return;
      }
      seenInBatch.add(norm);

      const dupCheck = isControlNumberDuplicate(checkCaNo);
      if (dupCheck.isDuplicate) {
        const dupMsg = `A Control Number with identifier "${dupCheck.matchedNumber || checkCaNo}" already exists. Please use a different Control Number.`;
        setValidationError(dupMsg);

        notificationRepository.createNotification({
          portal: "TSD",
          module: "control-no",
          title: "Duplicate Control Number Creation Blocked",
          message: `Attempted creation of duplicate Control Number: ${dupCheck.matchedNumber || checkCaNo}`,
          priority: "HIGH"
        }).catch(() => {});

        return;
      }
    }

    setIsProcessing(true);

    let successCount = 0;
    let failCount = 0;
    const errorDetails: string[] = [];

    console.log(`[FORENSIC STAGE 2] Starting batch processing for ${totalFiles} file(s) with starting CA No. ${caNoInput}`);

    for (let i = 0; i < totalFiles; i++) {
      const file = pendingFiles[i];
      const currentCaNo = getNextCaNo(caNoInput, i);

      setBatchProgress({
        current: i + 1,
        total: totalFiles,
        currentFileName: file.name,
        currentCaNo,
      });

      try {
        console.log(`[FORENSIC STAGE 3] File ${i + 1}/${totalFiles} (${file.name}): Extraction started with CA No ${currentCaNo}`);

        let arrayBuffer: ArrayBuffer;
        const downloadFileName = `${currentCaNo}_${file.name}`;

        // Stamp CA No. onto PDF using exact same stamping logic
        const { blob } = await attachCaNoToPdf(file, currentCaNo);
        arrayBuffer = await blob.arrayBuffer();

        if (downloadPdf) {
          // Trigger download
          const downloadLink = document.createElement("a");
          downloadLink.href = URL.createObjectURL(blob);
          downloadLink.download = downloadFileName;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
        }

        const docId = `doc-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`;

        // 1. Save binary in IndexedDB
        await saveDocumentBinary(docId, downloadFileName, "application/pdf", arrayBuffer);

        // 2. Extract data from PDF
        const extraction = await processManifestDocument(arrayBuffer, currentCaNo);

        console.log(`[FORENSIC STAGE 4] Extracted Record for File ${i + 1} (${file.name}):`, {
          fileName: file.name,
          companyName: extraction.companyName,
          controlNo: currentCaNo,
          tpNumber: extraction.tpNumber,
          manifestNo: extraction.manifestNo,
          deliveryDate: extraction.deliveryDate,
          quantity: extraction.quantity,
          extractionMethod: extraction.extractionMethod,
        });

        // 3. Save Manifest Record
        const validQty =
          extraction.quantity !== null &&
          extraction.quantity !== undefined &&
          !isNaN(Number(extraction.quantity)) &&
          Number(extraction.quantity) >= 0
            ? Number(extraction.quantity)
            : 0;

        const newRecord = {
          id: `manifest-${docId}`,
          controlNo: currentCaNo, // Authoritative CA No.
          companyName: extraction.companyName || "",
          tpNumber: extraction.tpNumber || "",
          manifestNo: extraction.manifestNo || "",
          deliveryDate: extraction.deliveryDate || new Date().toISOString().split("T")[0],
          quantity: validQty,
          extractionMethod: extraction.extractionMethod,
          confidence: extraction.confidence,
          warnings: extraction.warnings,
          docId: docId,
          createdAt: new Date().toISOString(),
        };

        console.log(`[FORENSIC STAGE 5] Creating ManifestRecord object: id=${newRecord.id}, docId=${docId}, deliveryDate=${newRecord.deliveryDate}`);

        saveManifestRecord(newRecord);
        await WorkflowRepository.saveModuleRecord("tsd_manifests", newRecord);

        // 4. Upload PDF binary to Firebase Storage for cloud persistence
        const uploadMeta = await uploadDocumentFile(
          arrayBuffer,
          `control-number/${currentCaNo}`,
          downloadFileName,
          "system"
        );

        const newDoc: UploadedDocument = {
          id: docId,
          fileName: downloadFileName,
          fileSize: uploadMeta.fileSize,
          fileType: "PDF",
          uploadedAt: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          caNumber: currentCaNo,
          storagePath: uploadMeta.storagePath,
          downloadUrl: uploadMeta.downloadUrl,
          uploadedBy: uploadMeta.uploadedBy
        };

        await appendDocToStorage(newDoc);
        successCount++;
        console.log(`[FORENSIC STAGE 5 Success] File ${i + 1}/${totalFiles}: ${file.name} -> docId=${docId}`);

      } catch (err: any) {
        failCount++;
        const errMsg = err?.message || "Extraction or saving error";
        errorDetails.push(`${file.name}: ${errMsg}`);
        console.error(`[FORENSIC STAGE 3/5 Failure] File ${i + 1}/${totalFiles} Failed (${file.name}):`, err);
      }
    }

    setIsProcessing(false);
    setShowCaNoModal(false);
    setPendingFiles([]);
    setCaNoInput("");
    setBatchProgress(null);

    console.log(`[FORENSIC STAGE 7 Storage Verification] Batch Finish: ${successCount} succeeded, ${failCount} failed out of ${totalFiles} total.`);
    const postBatchDocsRaw = localStorage.getItem("tsd_uploaded_compliance_docs");
    const postBatchDocs = postBatchDocsRaw ? JSON.parse(postBatchDocsRaw) : [];
    console.log(`[FORENSIC STAGE 7 Storage Verification] Post-Batch total compliance docs in storage = ${postBatchDocs.length}`);

    if (successCount > 0) {
      const activeWfId = localStorage.getItem("tsd_active_workflow_id") || undefined;
      notificationRepository.createNotification({
        portal: "TSD",
        module: "control-no",
        workflowId: activeWfId,
        documentNumber: caNoInput,
        title: "Control Number Created",
        message: `${successCount} compliance document(s) generated and stamped with Control Number(s).`,
        priority: "MEDIUM"
      }).catch(() => {});
    }

    if (failCount > 0) {
      alert(`Batch upload complete.\n\nSuccessfully processed: ${successCount}/${totalFiles}\nFailed: ${failCount}\n\nFailures:\n${errorDetails.join("\n")}`);
    } else if (totalFiles > 1) {
      alert(`Successfully processed all ${totalFiles} compliance documents!`);
    }
  };

  const handleCancelModal = () => {
    setShowCaNoModal(false);
    setPendingFiles([]);
    setCaNoInput("");
    setValidationError("");
    setBatchProgress(null);
  };

  const handleDeleteDoc = async (id: string) => {
    if (confirm("Are you sure you want to delete this document?")) {
      const targetDoc = uploadedDocs.find(d => d.id === id);
      if (targetDoc && targetDoc.storagePath) {
        try {
          await deleteDocumentFile(targetDoc.storagePath);
        } catch (e) {
          console.warn("[ControlNoModule] Storage file deletion warning:", e);
        }
      }
      try {
        await WorkflowRepository.deleteComplianceDoc(id);
        await WorkflowRepository.deleteModuleRecord("tsd_manifests", `manifest-${id}`);
      } catch (fsErr) {
        console.error("[ControlNoModule] Firestore delete document error:", fsErr);
      }
      const updated = uploadedDocs.filter(d => d.id !== id);
      saveDocsToStorage(updated);
      localStorage.removeItem(`tsd_doc_data_${id}`);
      await deleteDocumentBinary(id);
      deleteManifestRecordByDocId(id);
    }
  };

  const handleDownloadDoc = async (doc: UploadedDocument) => {
    try {
      let finalUrl = doc.downloadUrl;
      if (!finalUrl && doc.storagePath) {
        finalUrl = await getDocumentUrl(doc.storagePath);
      }
      if (!finalUrl) {
        finalUrl = doc.fileData || localStorage.getItem(`tsd_doc_data_${doc.id}`);
      }
      let blobUrl = "";

      if (!finalUrl) {
        const arrayBuffer = await getDocumentBinary(doc.id);
        if (arrayBuffer) {
          const blob = new Blob([arrayBuffer], { type: "application/pdf" });
          blobUrl = URL.createObjectURL(blob);
          finalUrl = blobUrl;
        }
      }

      if (!finalUrl) {
        alert("Source PDF file data not available.");
        return;
      }

      const link = document.createElement("a");
      link.href = finalUrl;
      link.download = doc.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (blobUrl) {
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      }
    } catch (err) {
      console.error("Failed to download document:", err);
      alert("Unable to download document.");
    }
  };

  const handlePreviewDoc = async (doc: UploadedDocument) => {
    handleSelectWorkflow(doc);
  };

  const handleOpenEditModal = (doc: UploadedDocument) => {
    setEditingDoc(doc);
    setEditCaNoInput(doc.caNumber);
    setEditValidationError("");
  };

  const handleEditCaNoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const formatted = formatCaNoInput(rawVal);
    setEditCaNoInput(formatted);

    if (editValidationError) {
      if (isValidCaNo(formatted)) {
        setEditValidationError("");
      }
    }
  };

  const handleSaveEditCaNo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc) return;

    const trimmedInput = editCaNoInput.trim();

    if (!trimmedInput) {
      setEditValidationError("Control Number cannot be empty.");
      return;
    }

    if (!isValidCaNo(trimmedInput)) {
      setEditValidationError("Please enter a valid CA No. using the format MM-####-YY.");
      return;
    }

    // Prevent duplicates across compliance documents, manifests, and workflows
    const dupCheck = isControlNumberDuplicate(trimmedInput, editingDoc.id);

    if (dupCheck.isDuplicate) {
      const dupMsg = `A Control Number with identifier "${dupCheck.matchedNumber || trimmedInput}" already exists. Please use a different Control Number.`;
      setEditValidationError(dupMsg);

      notificationRepository.createNotification({
        portal: "TSD",
        module: "control-no",
        title: "Duplicate Control Number Edit Blocked",
        message: `Attempted edit to duplicate Control Number: ${dupCheck.matchedNumber || trimmedInput}`,
        priority: "HIGH"
      }).catch(() => {});

      return;
    }

    const oldCaNumber = editingDoc.caNumber;
    const newFileName = `${trimmedInput}_${editingDoc.fileName.replace(/^.*?_/, "")}`;

    // 1. Re-stamp PDF with new Control Number and update stored binary
    let newUrl = "";
    try {
      let existingBuffer = await getDocumentBinary(editingDoc.id);
      let dataUrl = editingDoc.fileData || localStorage.getItem(`tsd_doc_data_${editingDoc.id}`);

      if (!existingBuffer && dataUrl) {
        const base64Data = dataUrl.replace(/^data:.*?;base64,/, "");
        const binaryStr = atob(base64Data);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        existingBuffer = bytes.buffer;
      }

      if (existingBuffer) {
        const stamped = await attachCaNoToPdf(existingBuffer, trimmedInput);
        newUrl = stamped.dataUrl;
        const newArrayBuffer = await stamped.blob.arrayBuffer();

        // Save updated binary in IndexedDB
        await saveDocumentBinary(editingDoc.id, newFileName, "application/pdf", newArrayBuffer);

        if (localStorage.getItem(`tsd_doc_data_${editingDoc.id}`)) {
          localStorage.setItem(`tsd_doc_data_${editingDoc.id}`, newUrl);
        }
      }
    } catch (err) {
      console.error("Error re-stamping PDF during Control Number edit:", err);
    }

    // 2. Update uploaded compliance documents metadata
    const updatedDocs = uploadedDocs.map((doc) => {
      if (doc.id === editingDoc.id) {
        return { 
          ...doc, 
          caNumber: trimmedInput,
          fileName: newFileName,
          fileData: newUrl || doc.fileData
        };
      }
      return doc;
    });

    saveDocsToStorage(updatedDocs);
    localStorage.setItem("tsd_active_control_no", normalizeControlNo(trimmedInput));

    const editedDocTarget = updatedDocs.find(d => d.id === editingDoc.id);
    if (editedDocTarget) {
      try {
        const safeDocToSave = { ...editedDocTarget };
        delete safeDocToSave.fileData;
        await WorkflowRepository.saveComplianceDoc(safeDocToSave);
      } catch (fsErr) {
        console.error("[ControlNoModule] Failed to update edited compliance doc in Firestore:", fsErr);
      }
    }

    // 3. Update associated manifest records in localStorage
    try {
      const allManifests = getAllManifestRecords();
      let recordsUpdatedCount = 0;

      const updatedManifests = allManifests.map((rec) => {
        if (rec.docId === editingDoc.id || rec.controlNo === oldCaNumber || rec.id === `manifest-${editingDoc.id}`) {
          recordsUpdatedCount++;
          return {
            ...rec,
            controlNo: trimmedInput,
            updatedAt: new Date().toISOString(),
          };
        }
        return rec;
      });

      if (recordsUpdatedCount > 0) {
        saveAllManifestRecords(updatedManifests);
      }
    } catch (err) {
      console.error("Failed to update associated manifest records:", err);
    }

    // 4. Update workflow controlNo and document mapping if applicable
    try {
      const workflows = getAllWorkflows();
      const normOld = normalizeControlNo(oldCaNumber);
      const normNew = normalizeControlNo(trimmedInput);

      let wfUpdated = false;
      workflows.forEach((w) => {
        if (
          (w.controlNo && normalizeControlNo(w.controlNo) === normOld) ||
          w.documentIds?.["control-no"] === editingDoc.id ||
          w.documentIds?.controlNumber === editingDoc.id
        ) {
          w.controlNo = normNew;
          if (!w.documentIds) w.documentIds = {};
          w.documentIds["control-no"] = editingDoc.id;
          w.documentIds.controlNumber = editingDoc.id;
          w.updatedAt = new Date().toISOString();
          wfUpdated = true;
        }
      });

      if (wfUpdated) {
        saveWorkflows(workflows);
      }

      if (editingDoc.workflowId) {
        propagateControlNoToWorkflowDocs(editingDoc.workflowId, trimmedInput);
      }
    } catch (err) {
      console.error("Failed to update workflow control number:", err);
    }

    const targetWfId = editingDoc.workflowId || localStorage.getItem("tsd_active_workflow_id") || undefined;
    notificationRepository.createNotification({
      portal: "TSD",
      module: "control-no",
      workflowId: targetWfId,
      documentId: editingDoc.id,
      documentNumber: trimmedInput,
      title: "Control Number Updated",
      message: `Control Number updated from ${oldCaNumber} to ${trimmedInput}.`,
      priority: "MEDIUM"
    }).catch(() => {});

    window.dispatchEvent(new Event("tsd_workflows_updated"));
    window.dispatchEvent(new Event("tsd_data_changed"));

    setEditingDoc(null);
    alert("Control Number updated successfully.");
  };

  const filteredDocs = uploadedDocs.filter(d => {
    const term = searchTerm.toLowerCase();
    return d.caNumber.toLowerCase().includes(term) || d.fileName.toLowerCase().includes(term);
  });

  return (
    <div id="smei-controlno-portal" className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto w-full">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white tracking-tight font-display uppercase">
            Control No. Manager
          </h2>
          <p className="text-xs md:text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            Upload PDF compliance documents to attach CA Numbers seamlessly and extract manifest records automatically.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Upload PDF Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 font-display uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-3">
            Upload PDF Documents (Supports Batch Uploads)
          </h3>

          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              dragActive 
                ? "border-smei-crimson bg-red-500/5" 
                : "border-gray-200 dark:border-slate-800 hover:border-smei-crimson hover:bg-slate-50/50 dark:hover:bg-slate-800/20"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileInputChange}
              accept=".pdf"
              multiple
            />
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/20 flex items-center justify-center border border-red-100 dark:border-red-900/30">
                <UploadCloud className="w-6 h-6 text-smei-crimson dark:text-rose-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Drag PDF file(s) here or browse
                </p>
                <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1 font-mono">
                  Supports single or multiple PDF documents at once
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Compliance Documents Directory */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 font-display uppercase tracking-wider">
              Document Registry
            </h3>
            <span className="text-[10px] font-mono text-gray-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-800">
              Total Documents: {filteredDocs.length}
            </span>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by CA No. or File Name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-smei-crimson text-gray-700 dark:text-slate-200"
            />
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-800">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono text-[9px] border-b border-slate-100 dark:border-slate-800">
                  <th className="py-3 px-4 font-display">CA No. Reference</th>
                  <th className="py-3 px-4 font-display">File Details</th>
                  <th className="py-3 px-4 font-display">Uploaded Date</th>
                  <th className="py-3 px-4 font-display text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {filteredDocs.length > 0 ? (
                  filteredDocs.map((doc) => {
                    const isSelected = Boolean(
                      doc.caNumber &&
                      activeControlNo &&
                      normalizeControlNo(doc.caNumber) === normalizeControlNo(activeControlNo)
                    );
                    return (
                      <tr 
                        key={doc.id}
                        onClick={() => handleSelectWorkflow(doc)}
                        className={`transition-all cursor-pointer select-none ${
                          isSelected
                            ? "bg-red-50/90 dark:bg-red-950/40 border-l-4 border-l-smei-crimson dark:border-l-rose-500 font-medium"
                            : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                        }`}
                        title="Click to set as Active Tracking Code in COA Document Progress Panel"
                      >
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-xs px-2.5 py-1 rounded font-mono transition-colors ${
                              isSelected
                                ? "bg-smei-crimson text-white border border-smei-crimson shadow-xs"
                                : "bg-red-50 text-smei-crimson border border-red-100 dark:bg-red-950/20 dark:text-rose-400 dark:border-red-900/30"
                            }`}>
                              CA No. {doc.caNumber}
                            </span>
                            {isSelected && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-smei-crimson dark:text-rose-400 bg-red-100/80 dark:bg-red-950/60 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-900/40 font-sans">
                                <CheckCircle className="w-3 h-3 text-smei-crimson dark:text-rose-400" />
                                Active Workflow
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <FileText className={`w-4 h-4 shrink-0 ${isSelected ? "text-smei-crimson dark:text-rose-400" : "text-red-500"}`} />
                            <div>
                              <p 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectWorkflow(doc);
                                }}
                                className="font-sans font-bold text-slate-800 dark:text-slate-200 hover:text-smei-crimson dark:hover:text-rose-400 cursor-pointer truncate max-w-xs" 
                                title={doc.fileName}
                              >
                                {doc.fileName}
                              </p>
                              <span className="text-[10px] text-gray-400 dark:text-slate-500">
                                {doc.fileSize}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-gray-500 dark:text-slate-400 whitespace-nowrap">
                          {doc.uploadedAt}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditModal(doc);
                              }}
                              className="p-1.5 text-gray-500 hover:text-smei-crimson border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 transition-all cursor-pointer hover:scale-105 active:scale-95"
                              title="Edit Control Number"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadDoc(doc);
                              }}
                              className="p-1.5 text-gray-500 hover:text-smei-crimson border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 transition-all cursor-pointer hover:scale-105 active:scale-95"
                              title="Download Modified PDF"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteDoc(doc.id);
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-600 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 transition-all cursor-pointer hover:scale-105 active:scale-95"
                              title="Delete Document"
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
                    <td colSpan={4} className="text-center py-8 text-gray-400 dark:text-slate-500 font-sans">
                      No compliance documents available. Upload PDF files to attach CA Numbers and generate manifest records.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ---------------- ENTER CA NO. POPUP MODAL ---------------- */}
      {showCaNoModal && (
        <div id="enter-cano-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-smei-crimson" />
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider font-mono">
                  {pendingFiles.length > 1 ? `BATCH UPLOAD (${pendingFiles.length} FILES)` : "ENTER CA NO."}
                </h3>
              </div>
              <button
                onClick={handleCancelModal}
                disabled={isProcessing}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <div className="p-5 space-y-4">
              {/* Selected Files Preview List */}
              {pendingFiles.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider block">
                    Selected Documents ({pendingFiles.length})
                  </label>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 dark:divide-slate-800/50">
                    {pendingFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800/80">
                        <FileText className="w-4 h-4 text-red-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate font-sans">
                            {file.name}
                          </p>
                          <p className="text-[10px] text-gray-400 font-mono">
                            {(file.size / 1024).toFixed(0)} KB • PDF
                            {caNoInput && isValidCaNo(caNoInput) && (
                              <span className="ml-2 font-bold text-smei-crimson dark:text-rose-400">
                                → CA No. {getNextCaNo(caNoInput, idx)}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Progress Indicator */}
              {isProcessing && batchProgress && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono font-bold text-smei-crimson dark:text-rose-400">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      Processing {batchProgress.current} of {batchProgress.total}
                    </span>
                    <span>{Math.round((batchProgress.current / batchProgress.total) * 100)}%</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate font-sans">
                    {batchProgress.currentFileName}
                  </p>
                  <div className="w-full bg-red-200 dark:bg-red-900/50 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-smei-crimson h-full transition-all duration-300"
                      style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* CA No. Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider block">
                  {pendingFiles.length > 1 ? "Starting CA No. *" : "CA No. *"}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  disabled={isProcessing}
                  value={caNoInput}
                  onChange={handleCaNoInputChange}
                  placeholder="06-1234-26"
                  maxLength={10}
                  className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-smei-crimson text-slate-800 dark:text-slate-200 font-bold ${
                    validationError 
                      ? "border-red-400 dark:border-red-500 focus:ring-red-500" 
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                />

                {validationError ? (
                  <p className="text-[10px] text-red-600 dark:text-rose-400 font-semibold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationError}</span>
                  </p>
                ) : (
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 font-sans mt-1">
                    Format: <span className="font-mono font-bold text-gray-600 dark:text-slate-300">MM-####-YY</span> (e.g. 06-1234-26)
                    {pendingFiles.length > 1 && (
                      <span className="block text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                        Sequential CA Numbers will be auto-assigned across all {pendingFiles.length} documents.
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleCancelModal}
                  disabled={isProcessing}
                  className="px-3.5 py-2 text-xs font-bold text-gray-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all font-mono uppercase tracking-wider cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={() => handleBatchProcess(false)}
                  disabled={isProcessing}
                  className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-all cursor-pointer hover:scale-[1.01] active:scale-95 disabled:opacity-50"
                >
                  <CheckCircle className="w-3.5 h-3.5 text-slate-500" />
                  <span>{pendingFiles.length > 1 ? `SAVE ALL (${pendingFiles.length})` : "SAVE"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleBatchProcess(true)}
                  disabled={isProcessing}
                  className="bg-smei-crimson hover:bg-smei-darkred text-white px-5 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>PROCESSING...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>{pendingFiles.length > 1 ? `DOWNLOAD & SAVE ALL (${pendingFiles.length})` : "DOWNLOAD PDF"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- EDIT CONTROL NUMBER POPUP MODAL ---------------- */}
      {editingDoc && (
        <div id="edit-controlno-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-smei-crimson" />
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider font-mono">
                  Edit Control Number
                </h3>
              </div>
              <button
                onClick={() => setEditingDoc(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEditCaNo} className="p-5 space-y-4">
              {/* Document Info Summary */}
              <div className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800">
                <FileText className="w-4 h-4 text-red-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate font-sans">
                    {editingDoc.fileName}
                  </p>
                  <p className="text-[10px] text-gray-400 font-mono">
                    Current CA No: <span className="font-bold text-smei-crimson">{editingDoc.caNumber}</span>
                  </p>
                </div>
              </div>

              {/* CA No. Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider block">
                  CA Number *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={editCaNoInput}
                  onChange={handleEditCaNoInputChange}
                  placeholder="06-1234-26"
                  maxLength={10}
                  className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-smei-crimson text-slate-800 dark:text-slate-200 font-bold ${
                    editValidationError 
                      ? "border-red-400 dark:border-red-500 focus:ring-red-500" 
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                />

                {editValidationError ? (
                  <p className="text-[10px] text-red-600 dark:text-rose-400 font-semibold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{editValidationError}</span>
                  </p>
                ) : (
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 font-sans mt-1">
                    Format: <span className="font-mono font-bold text-gray-600 dark:text-slate-300">MM-####-YY</span> (e.g. 06-1234-26)
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingDoc(null)}
                  className="px-3.5 py-2 text-xs font-bold text-gray-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all font-mono uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-smei-crimson hover:bg-smei-darkred text-white px-5 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
