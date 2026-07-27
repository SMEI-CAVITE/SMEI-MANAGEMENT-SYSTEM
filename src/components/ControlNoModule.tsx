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
  Sparkles
} from "lucide-react";
import { attachCaNoToPdf } from "../utils/pdfStamper";
import { formatControlNumber, validateControlNumber } from "../utils/controlNumber";
import { saveDocumentBinary, deleteDocumentBinary } from "../utils/documentStorage";
import { processManifestDocument } from "../utils/manifestParser";
import { saveManifestRecord, deleteManifestRecordByDocId } from "../utils/manifestStorage";

interface UploadedDocument {
  id: string;
  fileName: string;
  fileSize: string;
  fileType: string;
  uploadedAt: string;
  caNumber: string;
  fileData?: string; // Base64 data URL
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
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showCaNoModal, setShowCaNoModal] = useState(false);
  const [caNoInput, setCaNoInput] = useState("");
  const [validationError, setValidationError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Preview modal state
  const [previewDoc, setPreviewDoc] = useState<UploadedDocument | null>(null);
  const [activeDocData, setActiveDocData] = useState<string>("");

  // Load uploaded compliance documents from localStorage on mount
  useEffect(() => {
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
  }, []);

  const saveDocsToStorage = (updated: UploadedDocument[]) => {
    setUploadedDocs(updated);
    // Strip inline fileData when saving main metadata list to prevent storage overflow
    const safeDocs = updated.map(({ fileData, ...rest }) => rest);
    localStorage.setItem("tsd_uploaded_compliance_docs", JSON.stringify(safeDocs));
  };

  // Handle PDF file selection / drop
  const handleFileSelect = (file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      alert("Please upload a PDF file.");
      return;
    }

    setPendingFile(file);
    setCaNoInput("");
    setValidationError("");
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
    // Reset file input value so the same file can be re-selected if cancelled
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

  // Save record only (without downloading PDF)
  const handleSaveOnly = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pendingFile) return;

    if (!isValidCaNo(caNoInput)) {
      setValidationError("Please enter a valid CA No. using the format MM-####-YY.");
      return;
    }

    setValidationError("");
    setIsProcessing(true);

    try {
      const arrayBuffer = await pendingFile.arrayBuffer();
      const docId = `doc-${Date.now()}`;

      // 1. Store PDF binary in IndexedDB
      await saveDocumentBinary(docId, pendingFile.name, pendingFile.type, arrayBuffer);

      // 2. Run Zero-Cost Extraction Pipeline
      const extraction = await processManifestDocument(arrayBuffer, caNoInput);

      // 3. Save Manifest Record to Manifest Ledger
      const validAttachQty =
        extraction.quantity !== null &&
        extraction.quantity !== undefined &&
        !isNaN(Number(extraction.quantity)) &&
        Number(extraction.quantity) >= 0
          ? Number(extraction.quantity)
          : 0;

      saveManifestRecord({
        id: `manifest-${docId}`,
        controlNo: caNoInput, // Authoritative CA No.
        companyName: extraction.companyName || "",
        tpNumber: extraction.tpNumber || "",
        manifestNo: extraction.manifestNo || "",
        deliveryDate: extraction.deliveryDate || new Date().toISOString().split("T")[0],
        quantity: validAttachQty,
        extractionMethod: extraction.extractionMethod,
        confidence: extraction.confidence,
        warnings: extraction.warnings,
        docId: docId,
        createdAt: new Date().toISOString(),
      });

      // 4. Save metadata in Control No. list
      const sizeStr = pendingFile.size > 1024 * 1024 
        ? (pendingFile.size / (1024 * 1024)).toFixed(1) + " MB" 
        : (pendingFile.size / 1024).toFixed(0) + " KB";

      const newDocName = `${caNoInput}_${pendingFile.name}`;
      const newDoc: UploadedDocument = {
        id: docId,
        fileName: newDocName,
        fileSize: sizeStr,
        fileType: "PDF",
        uploadedAt: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        caNumber: caNoInput,
      };

      const updated = [newDoc, ...uploadedDocs];
      saveDocsToStorage(updated);

      // Reset modal state
      setShowCaNoModal(false);
      setPendingFile(null);
      setCaNoInput("");

      if (extraction.warnings.length > 0) {
        alert(`Document attached with CA No. ${caNoInput}.\nNote: ${extraction.warnings.join(" ")}`);
      }
    } catch (err) {
      console.error("Failed to save document:", err);
      alert("An error occurred while saving the document record. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Stamp CA No. on PDF, trigger download, and save record
  const handleDownloadPdf = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!pendingFile) return;

    if (!isValidCaNo(caNoInput)) {
      setValidationError("Please enter a valid CA No. using the format MM-####-YY.");
      return;
    }

    setValidationError("");
    setIsProcessing(true);

    try {
      // Attach CA No. to uploaded PDF using Times New Roman Bold 14pt
      const { blob } = await attachCaNoToPdf(pendingFile, caNoInput);
      const arrayBuffer = await blob.arrayBuffer();
      const docId = `doc-${Date.now()}`;

      // Trigger automatic download of modified PDF
      const downloadFileName = `${caNoInput}_${pendingFile.name}`;
      const downloadLink = document.createElement("a");
      downloadLink.href = URL.createObjectURL(blob);
      downloadLink.download = downloadFileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      // 1. Save binary into IndexedDB
      await saveDocumentBinary(docId, downloadFileName, "application/pdf", arrayBuffer);

      // 2. Run Zero-Cost Extraction Pipeline
      const extraction = await processManifestDocument(arrayBuffer, caNoInput);

      // 3. Save Manifest Record to Manifest Ledger
      const validDownloadQty =
        extraction.quantity !== null &&
        extraction.quantity !== undefined &&
        !isNaN(Number(extraction.quantity)) &&
        Number(extraction.quantity) >= 0
          ? Number(extraction.quantity)
          : 0;

      saveManifestRecord({
        id: `manifest-${docId}`,
        controlNo: caNoInput, // Authoritative CA No.
        companyName: extraction.companyName || "",
        tpNumber: extraction.tpNumber || "",
        manifestNo: extraction.manifestNo || "",
        deliveryDate: extraction.deliveryDate || new Date().toISOString().split("T")[0],
        quantity: validDownloadQty,
        extractionMethod: extraction.extractionMethod,
        confidence: extraction.confidence,
        warnings: extraction.warnings,
        docId: docId,
        createdAt: new Date().toISOString(),
      });

      // 4. Save metadata in Control No list
      const sizeStr = pendingFile.size > 1024 * 1024 
        ? (pendingFile.size / (1024 * 1024)).toFixed(1) + " MB" 
        : (pendingFile.size / 1024).toFixed(0) + " KB";

      const newDoc: UploadedDocument = {
        id: docId,
        fileName: downloadFileName,
        fileSize: sizeStr,
        fileType: "PDF",
        uploadedAt: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        caNumber: caNoInput,
      };

      const updated = [newDoc, ...uploadedDocs];
      saveDocsToStorage(updated);

      // Reset modal state
      setShowCaNoModal(false);
      setPendingFile(null);
      setCaNoInput("");

      if (extraction.warnings.length > 0) {
        alert(`Document stamped with CA No. ${caNoInput}.\nNote: ${extraction.warnings.join(" ")}`);
      }
    } catch (err) {
      console.error("Failed to attach CA No. to PDF:", err);
      alert("An error occurred while attaching CA No. to the PDF. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelModal = () => {
    setShowCaNoModal(false);
    setPendingFile(null);
    setCaNoInput("");
    setValidationError("");
  };

  const handleDeleteDoc = async (id: string) => {
    if (confirm("Are you sure you want to delete this document?")) {
      const updated = uploadedDocs.filter(d => d.id !== id);
      saveDocsToStorage(updated);
      localStorage.removeItem(`tsd_doc_data_${id}`);
      await deleteDocumentBinary(id);
      deleteManifestRecordByDocId(id);
    }
  };

  const handleDownloadDoc = (doc: UploadedDocument) => {
    const dataUrl = doc.fileData || localStorage.getItem(`tsd_doc_data_${doc.id}`);
    if (!dataUrl) {
      alert("Source PDF file data not available.");
      return;
    }
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = doc.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePreviewDoc = (doc: UploadedDocument) => {
    const dataUrl = doc.fileData || localStorage.getItem(`tsd_doc_data_${doc.id}`) || "";
    if (!dataUrl) {
      alert("Source PDF file data not available for preview.");
      return;
    }
    setPreviewDoc(doc);
    setActiveDocData(dataUrl);
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
            Upload PDF compliance documents to attach CA Numbers seamlessly to the top-right corner.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Upload PDF Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 font-display uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-3">
            Upload PDF
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
            />
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/20 flex items-center justify-center border border-red-100 dark:border-red-900/30">
                <UploadCloud className="w-6 h-6 text-smei-crimson dark:text-rose-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Drag PDF here or browse
                </p>
                <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1 font-mono">
                  Supports PDF files only
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
                  filteredDocs.map((doc) => (
                    <tr 
                      key={doc.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-bold text-xs px-2.5 py-1 rounded bg-red-50 text-smei-crimson border border-red-100 dark:bg-red-950/20 dark:text-rose-400 dark:border-red-900/30 font-mono">
                          CA No. {doc.caNumber}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-red-500 shrink-0" />
                          <div>
                            <p 
                              onClick={() => handlePreviewDoc(doc)}
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
                            onClick={() => handleDownloadDoc(doc)}
                            className="p-1.5 text-gray-500 hover:text-smei-crimson border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 transition-all cursor-pointer hover:scale-105 active:scale-95"
                            title="Download Modified PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteDoc(doc.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 transition-all cursor-pointer hover:scale-105 active:scale-95"
                            title="Delete Document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-400 dark:text-slate-500 font-sans">
                      No compliance documents available. Upload a PDF file to attach a CA No.
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
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider font-mono">
                ENTER CA NO.
              </h3>
              <button
                onClick={handleCancelModal}
                disabled={isProcessing}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleDownloadPdf} className="p-5 space-y-4">
              {pendingFile && (
                <div className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                  <FileText className="w-5 h-5 text-red-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate font-sans">
                      {pendingFile.name}
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono">
                      {(pendingFile.size / 1024).toFixed(0)} KB • PDF
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider block">
                  CA No. *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
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
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
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
                  onClick={handleSaveOnly}
                  disabled={isProcessing}
                  className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-all cursor-pointer hover:scale-[1.01] active:scale-95 disabled:opacity-50"
                >
                  <CheckCircle className="w-3.5 h-3.5 text-slate-500" />
                  <span>SAVE</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isProcessing}
                  className="bg-smei-crimson hover:bg-smei-darkred text-white px-5 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>DOWNLOADING...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>DOWNLOAD PDF</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- DOCUMENT PREVIEW MODAL ---------------- */}
      {previewDoc && (
        <div id="document-preview-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full h-[80vh] mx-4 overflow-hidden flex flex-col">
            <div className="bg-slate-50 dark:bg-slate-950 p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-widest font-mono truncate">
                  Preview Document: {previewDoc.fileName}
                </h4>
                <p className="text-[10px] text-slate-400 font-mono">
                  {previewDoc.fileSize} • Ref: CA No. {previewDoc.caNumber}
                </p>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-bold uppercase tracking-wider font-mono cursor-pointer bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded"
              >
                Close
              </button>
            </div>
            <div className="p-4 flex-1 bg-slate-100 dark:bg-slate-950 overflow-auto flex items-center justify-center">
              <iframe 
                src={activeDocData} 
                title={previewDoc.fileName}
                className="w-full h-full rounded border border-slate-200 dark:border-slate-800 bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
