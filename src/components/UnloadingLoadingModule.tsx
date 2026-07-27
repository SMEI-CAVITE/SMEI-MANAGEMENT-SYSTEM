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
import { ExportExcelButton } from "./SharedButtons";
import { validateManifestNumber } from "../utils/manifestHelper";
import { formatControlNumber } from "../utils/controlNumber";

interface ComplianceRecord {
  id: string;
  caNumber: string;
  title: string;
  date: string;
  unloadingFileName?: string;
  unloadingFileData?: string; // base64
  loadingFileName?: string;
  loadingFileData?: string; // base64
  createdAt: string;
}

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

  // Lazy-load data on selected record change
  useEffect(() => {
    if (selectedRecordId) {
      const rec = compRecords.find(r => r.id === selectedRecordId);
      if (rec) {
        setActiveUnloadingData(localStorage.getItem(`tsd_unloading_data_${rec.id}`) || rec.unloadingFileData || "");
        setActiveLoadingData(localStorage.getItem(`tsd_loading_data_${rec.id}`) || rec.loadingFileData || "");
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
          if (rec.unloadingFileData) {
            localStorage.setItem(`tsd_unloading_data_${rec.id}`, rec.unloadingFileData);
            updated = true;
            migrated = true;
          }
          if (rec.loadingFileData) {
            localStorage.setItem(`tsd_loading_data_${rec.id}`, rec.loadingFileData);
            updated = true;
            migrated = true;
          }
          if (updated) {
            const { unloadingFileData, loadingFileData, ...rest } = rec;
            return rest;
          }
          return rec;
        });

        if (migrated) {
          localStorage.setItem("tsd_compliance_records", JSON.stringify(parsed));
        }

        setCompRecords(parsed);
        if (parsed.length > 0) {
          setSelectedRecordId(parsed[0].id);
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
          loadingFileName: "treated_ash_consignment_receipt.pdf",
          createdAt: new Date().toLocaleDateString() + " 10:00 AM"
        }
      ];
      setCompRecords(initial);
      setSelectedRecordId(initial[0].id);
      localStorage.setItem("tsd_compliance_records", JSON.stringify(initial));
    }
  }, []);

  const saveCompToStorage = (updated: ComplianceRecord[]) => {
    setCompRecords(updated);
    localStorage.setItem("tsd_compliance_records", JSON.stringify(updated));
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

  const handleCreateNew = () => {
    setEditingRecord(null);
    setCompCA("");
    setCompUnloadingFileName("");
    setCompUnloadingData("");
    setCompLoadingFileName("");
    setCompLoadingData("");
    setIsModalOpen(true);
  };

  const handleSaveCompliance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!compCA.trim()) {
      alert("Manifest Number is a required field.");
      return;
    }

    let updatedDocs = [...compRecords];

    if (editingRecord) {
      // Edit mode
      if (compUnloadingData && compUnloadingData !== editingRecord.unloadingFileData) {
        localStorage.setItem(`tsd_unloading_data_${editingRecord.id}`, compUnloadingData);
      }
      if (compLoadingData && compLoadingData !== editingRecord.loadingFileData) {
        localStorage.setItem(`tsd_loading_data_${editingRecord.id}`, compLoadingData);
      }

      updatedDocs = compRecords.map(r => {
        if (r.id === editingRecord.id) {
          return {
            ...r,
            caNumber: compCA.toUpperCase(),
            unloadingFileName: compUnloadingFileName || r.unloadingFileName,
            loadingFileName: compLoadingFileName || r.loadingFileName
          };
        }
        return r;
      });
      saveCompToStorage(updatedDocs);
      setSelectedRecordId(editingRecord.id);
    } else {
      // New record
      const newRecordId = `comp-${Date.now()}`;
      if (compUnloadingData) {
        localStorage.setItem(`tsd_unloading_data_${newRecordId}`, compUnloadingData);
      }
      if (compLoadingData) {
        localStorage.setItem(`tsd_loading_data_${newRecordId}`, compLoadingData);
      }

      const newRec: ComplianceRecord = {
        id: newRecordId,
        caNumber: compCA.toUpperCase(),
        title: "Geotagged Loading and Unloading Photograph Record",
        date: new Date().toISOString().split("T")[0],
        unloadingFileName: compUnloadingFileName,
        loadingFileName: compLoadingFileName,
        createdAt: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      updatedDocs = [newRec, ...compRecords];
      saveCompToStorage(updatedDocs);
      setSelectedRecordId(newRec.id);
    }

    setIsModalOpen(false);
  };

  const handleEditComp = (record: ComplianceRecord) => {
    setEditingRecord(record);
    setCompCA((record.caNumber || "").toUpperCase());
    setCompUnloadingFileName(record.unloadingFileName || "");
    setCompUnloadingData(localStorage.getItem(`tsd_unloading_data_${record.id}`) || record.unloadingFileData || "");
    setCompLoadingFileName(record.loadingFileName || "");
    setCompLoadingData(localStorage.getItem(`tsd_loading_data_${record.id}`) || record.loadingFileData || "");
    setIsModalOpen(true);
  };

  const handleDeleteComp = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm("Are you sure you want to permanently delete this unloading/loading compliance record?")) {
      const updated = compRecords.filter(r => r.id !== id);
      saveCompToStorage(updated);
      localStorage.removeItem(`tsd_unloading_data_${id}`);
      localStorage.removeItem(`tsd_loading_data_${id}`);
      if (selectedRecordId === id) {
        setSelectedRecordId(updated.length > 0 ? updated[0].id : null);
      }
      if (editingRecord?.id === id) {
        setEditingRecord(null);
      }
    }
  };

  const handleExportExcel = async (record: ComplianceRecord) => {
    try {
      const FALLBACK_1X1_PNG = "data:image/png;base64,iVBOR000KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
      const exportData = {
        CONTROL_NO: record.caNumber,
        CA_NO: record.caNumber,
        UNLOADING_IMAGE: localStorage.getItem(`tsd_unloading_data_${record.id}`) || record.unloadingFileData || FALLBACK_1X1_PNG,
        LOADING_IMAGE: localStorage.getItem(`tsd_loading_data_${record.id}`) || record.loadingFileData || FALLBACK_1X1_PNG
      };

      await exportExcelWithTemplate(
        "UNLOADING_LOADING_TEMPLATE.xlsm",
        exportData,
        "items",
        [],
        `${record.caNumber}_UNLOADING_LOADING.xlsm`
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
          <button
            onClick={handleCreateNew}
            className="bg-smei-crimson hover:bg-smei-darkred text-white text-xs font-semibold h-[38px] px-4 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Unloading / Loading Log</span>
          </button>

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
                        onClick={() => setSelectedRecordId(rec.id)}
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
                        No records found. Click "+ New Unloading / Loading Log" to create a new record.
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
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-100 dark:border-slate-800 max-w-lg w-full overflow-hidden animate-fadeIn flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800 dark:text-slate-200 font-display flex items-center gap-1.5 uppercase tracking-wider">
                <span>NEW UNLOADING/LOADING LOG</span>
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
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
                  onClick={() => setIsModalOpen(false)}
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
