import React, { useState, useEffect, useRef } from "react";
import { 
  Trash2, 
  FileText, 
  FileSpreadsheet,
  Image as ImageIcon,
  Calendar, 
  Search,
  X,
  CheckCircle2,
  Camera,
  ZoomIn,
  RefreshCw
} from "lucide-react";
import { exportExcelWithTemplate } from "../utils/templateExport";

interface TimestampRecord {
  id: string;
  photoData: string; // base64 placeholder
  fileName: string;
  createdAt: string; // YYYY-MM-DD HH:MM:SS
  notes?: string; // Related timestamp information
  fileSize: string;
}

const PLACEHOLDER_GIF = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";

export default function TimestampModule() {
  const [records, setRecords] = useState<TimestampRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [isExportingId, setIsExportingId] = useState<string | null>(null);

  // New Record Dialog State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempPhoto, setTempPhoto] = useState<string | null>(null);
  const [tempFileName, setTempFileName] = useState("");
  const [tempFileSize, setTempFileSize] = useState("");
  const [customDate, setCustomDate] = useState("");

  // Lightbox Preview State
  const [lightboxPhoto, setLightboxPhoto] = useState<{ src: string; title: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const [replaceMode, setReplaceMode] = useState<"temp" | "selected">("selected");

  const [activePhoto, setActivePhoto] = useState<string | null>(null);

  // Load from local storage with self-healing migration of legacy Base64 payloads
  useEffect(() => {
    const saved = localStorage.getItem("tsd_timestamp_records");
    if (saved) {
      try {
        let parsed = JSON.parse(saved) as TimestampRecord[];
        let migrated = false;

        // Perform self-healing migration of any inline Base64 data to separate keys
        parsed = parsed.map(rec => {
          if (rec.photoData && rec.photoData !== PLACEHOLDER_GIF) {
            localStorage.setItem(`tsd_photo_${rec.id}`, rec.photoData);
            migrated = true;
            return { ...rec, photoData: PLACEHOLDER_GIF };
          }
          return rec;
        });

        if (migrated) {
          localStorage.setItem("tsd_timestamp_records", JSON.stringify(parsed));
        }

        setRecords(parsed);
        if (parsed.length > 0) {
          setSelectedRecordId(parsed[0].id);
        }
      } catch (e) {
        console.error("Failed to parse saved timestamp records", e);
      }
    } else {
      // Seed with initial mock data
      const initial: TimestampRecord[] = [
        {
          id: "TR-2026-001",
          photoData: PLACEHOLDER_GIF,
          fileName: "gate_arrival_truck_nqe2841.png",
          createdAt: "2026-07-16 08:32:15",
          notes: "Gate Arrival verification photo for Truck NQE-2841 - Manifest #TSD-2026-M-01824",
          fileSize: "142 KB"
        },
        {
          id: "TR-2026-002",
          photoData: PLACEHOLDER_GIF,
          fileName: "neutralization_chamber_vessel2.png",
          createdAt: "2026-07-16 10:15:40",
          notes: "Neutralization process completed for batch #TSD-2026-T-02481",
          fileSize: "215 KB"
        }
      ];
      setRecords(initial);
      setSelectedRecordId(initial[0].id);
      localStorage.setItem("tsd_timestamp_records", JSON.stringify(initial));
    }
  }, []);

  // Lazy-load photo on demand for the selected record
  useEffect(() => {
    if (selectedRecordId) {
      const savedPhoto = localStorage.getItem(`tsd_photo_${selectedRecordId}`);
      if (savedPhoto) {
        setActivePhoto(savedPhoto);
      } else {
        const rec = records.find(r => r.id === selectedRecordId);
        setActivePhoto(rec?.photoData || PLACEHOLDER_GIF);
      }
    } else {
      setActivePhoto(null);
    }
  }, [selectedRecordId, records]);

  const saveToStorage = (updated: TimestampRecord[]) => {
    setRecords(updated);
    localStorage.setItem("tsd_timestamp_records", JSON.stringify(updated));
  };

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleTriggerReplace = (target: "temp" | "selected") => {
    setReplaceMode(target);
    replaceFileInputRef.current?.click();
  };

  // Main Upload Handler (New Record)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase() || "";

    // Validation: Allowed image formats
    const allowedExtensions = ["jpg", "jpeg", "png", "webp"];
    if (!allowedExtensions.includes(ext) || !file.type.startsWith("image/")) {
      alert("Invalid file format! Only image files (.jpg, .jpeg, .png, .webp) are accepted.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Validation: Max size 5MB
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("File size exceeds the 5MB limit. Please upload a smaller image file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const sizeInKB = Math.round(file.size / 1024);
    const sizeStr = sizeInKB > 1024 ? `${(sizeInKB / 1024).toFixed(1)} MB` : `${sizeInKB} KB`;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target?.result as string;
      setTempPhoto(base64Data);
      setTempFileName(file.name);
      setTempFileSize(sizeStr);
      
      // Auto-set current local datetime
      const now = new Date();
      const dateString = now.toISOString().split("T")[0];
      const timeString = now.toTimeString().split(" ")[0];
      setCustomDate(`${dateString} ${timeString}`);

      setIsModalOpen(true);
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Replacement Handler (Double-Click or Replace Action)
  const handleReplaceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const allowedExtensions = ["jpg", "jpeg", "png", "webp"];
    if (!allowedExtensions.includes(ext) || !file.type.startsWith("image/")) {
      alert("Invalid file format! Only image files (.jpg, .jpeg, .png, .webp) are accepted.");
      if (replaceFileInputRef.current) replaceFileInputRef.current.value = "";
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("File size exceeds the 5MB limit. Please select a smaller image file.");
      if (replaceFileInputRef.current) replaceFileInputRef.current.value = "";
      return;
    }

    const sizeInKB = Math.round(file.size / 1024);
    const sizeStr = sizeInKB > 1024 ? `${(sizeInKB / 1024).toFixed(1)} MB` : `${sizeInKB} KB`;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target?.result as string;
      if (!base64Data) return;

      if (replaceMode === "temp") {
        // Replace temp photo in modal
        setTempPhoto(base64Data);
        setTempFileName(file.name);
        setTempFileSize(sizeStr);
      } else if (selectedRecordId) {
        // Replace existing record photo immediately
        localStorage.setItem(`tsd_photo_${selectedRecordId}`, base64Data);
        setActivePhoto(base64Data);

        const updated = records.map(r => {
          if (r.id === selectedRecordId) {
            return {
              ...r,
              fileName: file.name,
              fileSize: sizeStr
            };
          }
          return r;
        });
        saveToStorage(updated);
      }
    };
    reader.readAsDataURL(file);

    if (replaceFileInputRef.current) replaceFileInputRef.current.value = "";
  };

  const handleSaveRecord = () => {
    if (!tempPhoto) return;

    const newRecordId = `TR-${Date.now().toString().substring(7)}`;
    
    // Save photo separately to keep registry search and list load instant
    localStorage.setItem(`tsd_photo_${newRecordId}`, tempPhoto);

    const newRecord: TimestampRecord = {
      id: newRecordId,
      photoData: PLACEHOLDER_GIF,
      fileName: tempFileName,
      createdAt: customDate || new Date().toISOString().replace("T", " ").substring(0, 19),
      notes: "Compliance validation photo",
      fileSize: tempFileSize
    };

    const updated = [newRecord, ...records];
    saveToStorage(updated);
    setSelectedRecordId(newRecord.id);
    setIsModalOpen(false);
    setTempPhoto(null);
  };

  const handleDeleteRecord = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm("Are you sure you want to permanently delete this timestamp record from the compliance registry?")) {
      const updated = records.filter(r => r.id !== id);
      saveToStorage(updated);
      localStorage.removeItem(`tsd_photo_${id}`);
      if (selectedRecordId === id) {
        setSelectedRecordId(updated.length > 0 ? updated[0].id : null);
      }
    }
  };

  const formatExportDate = (dateStr: string): string => {
    if (!dateStr) return "01-01-2026";
    const dateOnly = dateStr.split(" ")[0].split("T")[0];
    const parts = dateOnly.split("-");
    if (parts.length === 3) {
      const [year, month, day] = parts;
      if (year.length === 4) {
        return `${month.padStart(2, "0")}-${day.padStart(2, "0")}-${year}`;
      }
    }
    return dateOnly;
  };

  const handleExportExcel = async (record: TimestampRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setIsExportingId(record.id);
      
      // On-demand resolution of the active photo
      const activePhotoData = localStorage.getItem(`tsd_photo_${record.id}`) || record.photoData || PLACEHOLDER_GIF;

      const exportDateStr = formatExportDate(record.createdAt);
      const exportFileName = `COPY OF TIMESTAMP ${exportDateStr}.xlsm`;

      await exportExcelWithTemplate(
        "TIME_STAMP_TEMPLATE.xlsm",
        {
          timestamp_photo: activePhotoData,
          ID: record.id,
          DATE: record.createdAt,
          NOTES: record.notes || "Compliance validation photo",
          FILENAME: record.fileName
        },
        "items",
        [],
        exportFileName
      );
    } catch (err) {
      console.error(err);
      alert("Failed to export template report. Please verify that public/templates/TIME_STAMP_TEMPLATE.xlsm exists.");
    } finally {
      setIsExportingId(null);
    }
  };

  // Filter logic
  const filteredRecords = records.filter(rec => {
    const matchesSearch = 
      rec.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDate = !dateFilter || rec.createdAt.startsWith(dateFilter);

    return matchesSearch && matchesDate;
  });

  const selectedRecord = records.find(r => r.id === selectedRecordId);

  return (
    <div id="smei-timestamp-portal" className="p-4 md:p-6 space-y-6 max-w-[130rem] mx-auto w-full text-slate-800 dark:text-slate-100">
      
      {/* Hidden File Inputs */}
      <input 
        type="file" 
        ref={fileInputRef}
        accept="image/*" 
        className="hidden" 
        onChange={handleFileChange} 
      />
      <input 
        type="file" 
        ref={replaceFileInputRef}
        accept="image/*" 
        className="hidden" 
        onChange={handleReplaceFileChange} 
      />

      {/* Upper Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white tracking-tight font-display uppercase">
            Compliance Timestamp Registry
          </h2>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Upload and archive timestamp validation photos with automated Excel report export.
          </p>
        </div>

        {selectedRecord && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase font-mono tracking-wider">Selected:</span>
            <span className="text-[11px] font-bold font-mono text-smei-crimson dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 px-2.5 py-1 rounded-md">
              {selectedRecord.id}
            </span>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleTriggerUpload}
            className="bg-smei-crimson hover:bg-smei-darkred text-white text-xs font-semibold h-[38px] px-4 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Upload Timestamp Photo</span>
          </button>

          <button
            onClick={(e) => selectedRecord && handleExportExcel(selectedRecord, e)}
            disabled={!selectedRecord || isExportingId === selectedRecord?.id}
            className={`text-xs font-semibold h-[38px] px-4 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all whitespace-nowrap ${
              !selectedRecord || isExportingId === selectedRecord?.id
                ? "bg-gray-100 dark:bg-slate-800/80 text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-700 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600 hover:scale-[1.02] active:scale-95 cursor-pointer shadow-[0_2px_8px_rgba(16,185,129,0.15)]"
            }`}
            title={selectedRecord ? `Export ${selectedRecord.id} to Excel` : "Select a record to export"}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isExportingId === selectedRecord?.id ? "Exporting..." : "Export Excel"}</span>
          </button>
        </div>

        {/* Searching & Filters */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search ID, filename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg text-xs pl-9 pr-4 py-2 h-[38px] focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent text-gray-700 dark:text-slate-200 font-mono"
            />
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 text-xs rounded-lg pl-9 pr-3 py-2 h-[38px] focus:outline-none focus:ring-1 focus:ring-smei-crimson transition-all cursor-pointer text-gray-700 dark:text-slate-200"
            />
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Records Table (Left 2 Columns) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800 dark:text-slate-200 font-display flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-smei-crimson" />
              <span>Timestamp Photo Registry</span>
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                {filteredRecords.length} Files
              </span>
            </h3>
          </div>

          <div className="border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3 font-display">Record ID</th>
                    <th className="py-2.5 px-3 font-display">Date & Time</th>
                    <th className="py-2.5 px-3 font-display">Filename</th>
                    <th className="py-2.5 px-3 font-display text-right">Size</th>
                    <th className="py-2.5 px-3 text-center font-display">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono">
                  {filteredRecords.length > 0 ? (
                    filteredRecords.map((rec, index) => (
                      <tr
                        key={rec.id}
                        onClick={() => setSelectedRecordId(rec.id)}
                        className={`cursor-pointer transition-colors ${
                          selectedRecordId === rec.id
                            ? "bg-red-500/10 border-l-4 border-l-smei-crimson font-medium dark:bg-red-950/30"
                            : index % 2 === 1
                            ? "bg-gray-50/45 hover:bg-red-500/10 dark:hover:bg-red-950/20"
                            : "bg-white dark:bg-slate-900 hover:bg-red-500/10 dark:hover:bg-red-950/20"
                        }`}
                      >
                        <td className="py-3.5 px-3 font-bold text-smei-crimson dark:text-red-400">
                          {rec.id}
                        </td>
                        <td className="py-3.5 px-3 text-gray-500 dark:text-slate-400">
                          {rec.createdAt}
                        </td>
                        <td className="py-3.5 px-3 font-sans font-semibold text-gray-700 dark:text-slate-200">
                          {rec.fileName}
                        </td>
                        <td className="py-3.5 px-3 text-right text-gray-400 dark:text-slate-500">
                          {rec.fileSize}
                        </td>
                        <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            {/* GREEN Export Button */}
                            <button
                              onClick={(e) => handleExportExcel(rec, e)}
                              disabled={isExportingId === rec.id}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 dark:text-emerald-400 rounded-lg transition-all cursor-pointer"
                              title="Export Excel Report"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteRecord(rec.id, e)}
                              className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-all cursor-pointer"
                              title="Delete Photo Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-gray-400 dark:text-slate-500 font-sans">
                        No timestamp files logged in compliance registry matching the criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar Details Panel (Right 1 Column) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
            <h3 className="text-xs font-bold text-gray-400 dark:text-slate-500 font-mono uppercase tracking-widest">
              Active Photo Inspection
            </h3>
            {selectedRecord && (
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                Double-click image to replace
              </span>
            )}
          </div>

          {selectedRecord ? (
            <div className="space-y-4">
              {/* Photo Canvas Container with Preview & Double-click to Replace */}
              <div 
                className="relative h-64 bg-slate-950 rounded-xl overflow-hidden border border-gray-200 dark:border-slate-800 shadow-inner group flex items-center justify-center cursor-pointer select-none"
                onDoubleClick={() => handleTriggerReplace("selected")}
                title="Double-click to change photo • Single click to view preview"
              >
                <img 
                  src={activePhoto || PLACEHOLDER_GIF} 
                  alt={selectedRecord.fileName} 
                  className="max-w-full max-h-full object-contain transition-transform duration-300 group-hover:scale-102"
                  referrerPolicy="no-referrer"
                />
                
                {/* Overlay Hint on Hover */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 text-white text-xs font-semibold p-4 text-center">
                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (activePhoto) setLightboxPhoto({ src: activePhoto, title: selectedRecord.fileName });
                      }}
                      className="bg-black/60 hover:bg-black/80 text-white px-2.5 py-1.5 rounded-md text-[11px] font-sans flex items-center gap-1 border border-white/20 transition-all"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTriggerReplace("selected");
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-md text-[11px] font-sans flex items-center gap-1 transition-all"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Change Photo</span>
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-300 font-mono">
                    💡 Double-click image to replace photo
                  </span>
                </div>

                <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-xs text-white font-mono text-[9px] px-2 py-0.5 rounded">
                  {selectedRecord.fileSize}
                </div>
              </div>

              {/* Photo Information & Instructions */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-800 text-[11px] space-y-1 font-mono">
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span className="font-bold">Filename:</span>
                  <span className="truncate max-w-[180px]" title={selectedRecord.fileName}>{selectedRecord.fileName}</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Timestamp:</span>
                  <span>{selectedRecord.createdAt}</span>
                </div>
              </div>

              {/* Action Buttons - GREEN EXPORT BUTTON */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={(e) => handleExportExcel(selectedRecord, e)}
                  disabled={isExportingId === selectedRecord.id}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-xs font-semibold h-[38px] rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all hover:scale-[1.01] active:scale-95 cursor-pointer font-sans"
                >
                  <FileText className="w-4 h-4" />
                  <span>{isExportingId === selectedRecord.id ? "Exporting..." : "Export Excel Report"}</span>
                </button>

                <button
                  onClick={() => handleTriggerReplace("selected")}
                  className="border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 p-2.5 rounded-lg transition-all cursor-pointer bg-white dark:bg-slate-900"
                  title="Replace Photo (Double-click image)"
                >
                  <RefreshCw className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </button>

                <button
                  onClick={(e) => handleDeleteRecord(selectedRecord.id, e)}
                  className="border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/25 text-red-600 p-2.5 rounded-lg transition-all cursor-pointer bg-white dark:bg-slate-900"
                  title="Delete Record"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="py-24 text-center text-gray-400 dark:text-slate-500 text-xs flex flex-col items-center justify-center space-y-2 border-2 border-dashed border-gray-100 dark:border-slate-800 rounded-xl h-64">
              <ImageIcon className="w-8 h-8 text-gray-300" />
              <span>Select a validation record to preview its image</span>
            </div>
          )}
        </div>

      </div>

      {/* New Timestamp Record Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-100 dark:border-slate-800 max-w-lg w-full overflow-hidden animate-fadeIn flex flex-col">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800 dark:text-slate-200 font-display flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-smei-crimson" />
                <span>Validate New Timestamp Photo</span>
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1 rounded-full hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              
              {/* Photo Preview with Double-click to Replace */}
              <div 
                className="relative h-56 bg-slate-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg overflow-hidden flex items-center justify-center cursor-pointer group"
                onDoubleClick={() => handleTriggerReplace("temp")}
                title="Double-click to replace photo"
              >
                {tempPhoto && (
                  <img 
                    src={tempPhoto} 
                    alt="Preview" 
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                )}
                
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1">
                  <RefreshCw className="w-4 h-4" />
                  <span>Double-click to change photo</span>
                </div>
              </div>

              {/* File Info Card */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-gray-100 dark:border-slate-800 flex justify-between items-center text-[11px] font-mono text-gray-500 dark:text-slate-400">
                <span className="truncate max-w-[250px]" title={tempFileName}>{tempFileName}</span>
                <div className="flex items-center gap-3">
                  <span>{tempFileSize}</span>
                  <button
                    type="button"
                    onClick={() => handleTriggerReplace("temp")}
                    className="text-emerald-600 dark:text-emerald-400 hover:underline text-[10px] font-sans font-semibold cursor-pointer"
                  >
                    Change Photo
                  </button>
                </div>
              </div>

              {/* Timestamp Field */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">
                  Verification Timestamp
                </label>
                <input
                  type="text"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  placeholder="YYYY-MM-DD HH:MM:SS"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg text-xs font-mono p-2.5 focus:outline-none focus:ring-1 focus:ring-smei-crimson text-gray-700 dark:text-slate-200"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-gray-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 text-xs font-semibold h-[34px] px-4 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRecord}
                className="bg-smei-crimson hover:bg-smei-darkred text-white text-xs font-semibold h-[34px] px-4 rounded-lg flex items-center justify-center gap-1 cursor-pointer shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Save to Registry</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Lightbox Photo Preview Modal */}
      {lightboxPhoto && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="relative max-w-4xl w-full bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono font-bold">{lightboxPhoto.title}</span>
              </div>
              <button 
                onClick={() => setLightboxPhoto(null)}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex-1 flex items-center justify-center overflow-auto min-h-[300px]">
              <img 
                src={lightboxPhoto.src} 
                alt="Enlarged Preview" 
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-400">
                Double-click image in inspection panel to change photo
              </span>
              <button
                onClick={() => setLightboxPhoto(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
