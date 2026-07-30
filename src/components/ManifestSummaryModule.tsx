import React, { useState, useEffect } from "react";
import { 
  Search, 
  ArrowDownToLine, 
  CheckCircle2, 
  AlertTriangle, 
  Edit3, 
  Trash2, 
  Calendar, 
  FileSpreadsheet, 
  Plus, 
  X,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  FileCheck,
  Loader2,
  UserCheck,
  FileText
} from "lucide-react";
import { 
  getWeeklyManifestGroups, 
  getWeeklySheetName,
  saveManifestRecord, 
  deleteManifestRecord, 
  ManifestRecord, 
  WeeklyManifestGroup 
} from "../utils/manifestStorage";
import { exportExcelWithTemplate } from "../utils/templateExport";
import { formatDateDdMmmYy } from "../utils/manifestParser";
import { deleteDocumentBinary } from "../utils/documentStorage";

export default function ManifestSummaryModule() {
  const [weeklyGroups, setWeeklyGroups] = useState<WeeklyManifestGroup[]>([]);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterConfidence, setFilterConfidence] = useState<string>("All");

  // Edit / Review Modal state
  const [editingRecord, setEditingRecord] = useState<ManifestRecord | null>(null);

  // Export Weekly Manifest Dialog State
  const [isExportDialogOpen, setIsExportDialogOpen] = useState<boolean>(false);
  const [exportGroup, setExportGroup] = useState<WeeklyManifestGroup | null>(null);
  const [haulingDate, setHaulingDate] = useState<string>("");
  const [haulingDateError, setHaulingDateError] = useState<string>("");
  const [signatoryName, setSignatoryName] = useState<string>("Aprilyn J. Rogador");
  const [signatoryPosition, setSignatoryPosition] = useState<string>("Technical Supervisor");
  const [signatoryError, setSignatoryError] = useState<string>("");
  const [exportError, setExportError] = useState<string>("");
  const [isExporting, setIsExporting] = useState<boolean>(false);

  useEffect(() => {
    refreshGroups();
  }, []);

  const refreshGroups = () => {
    const groups = getWeeklyManifestGroups();
    setWeeklyGroups(groups);
    console.log(`[FORENSIC STAGE 10] ManifestSummary refreshGroups: Loaded ${groups.length} weekly groups.`);
  };

  const currentGroup = weeklyGroups[selectedGroupIndex] || null;

  useEffect(() => {
    if (currentGroup) {
      console.log(`[FORENSIC STAGE 10 UI Audit] Selected Week Index=${selectedGroupIndex}, Week ID=${currentGroup.weekId}, Records in group=${currentGroup.records.length}`);
    } else {
      console.log(`[FORENSIC STAGE 10 UI Audit] Selected Week Index=${selectedGroupIndex}, No current group active.`);
    }
  }, [selectedGroupIndex, currentGroup]);

  // Handle Record Edit Submit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    saveManifestRecord({
      ...editingRecord,
      extractionMethod: "manual-review",
      confidence: "high",
      updatedAt: new Date().toISOString(),
    });

    setEditingRecord(null);
    refreshGroups();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this manifest record?")) {
      const recordToDelete = currentGroup?.records.find(r => r.id === id);
      deleteManifestRecord(id);
      if (recordToDelete && recordToDelete.docId) {
        const savedDocs = localStorage.getItem("tsd_uploaded_compliance_docs");
        if (savedDocs) {
          try {
            const docs = JSON.parse(savedDocs) as any[];
            const updatedDocs = docs.filter(d => d.id !== recordToDelete.docId);
            localStorage.setItem("tsd_uploaded_compliance_docs", JSON.stringify(updatedDocs));
            localStorage.removeItem(`tsd_doc_data_${recordToDelete.docId}`);
            await deleteDocumentBinary(recordToDelete.docId);
          } catch (e) {
            console.error("Failed to sync doc deletion", e);
          }
        }
      }
      refreshGroups();
    }
  };

  // Open Export Dialog
  const handleOpenExportDialog = (group: WeeklyManifestGroup) => {
    setExportGroup(group);
    // Initialize Hauling Date with current system date YYYY-MM-DD
    const todayStr = new Date().toISOString().split("T")[0];
    setHaulingDate(todayStr);
    setHaulingDateError("");
    setSignatoryError("");
    setExportError("");
    setIsExportDialogOpen(true);
  };

  // Execute XLSM export for selected week
  const handleConfirmExport = async () => {
    if (!exportGroup) return;

    const trimmedHaulingDate = haulingDate.trim();
    const trimmedName = signatoryName.trim();
    const trimmedPosition = signatoryPosition.trim();

    if (!trimmedHaulingDate) {
      setHaulingDateError("Please select a hauling date before exporting the weekly manifest.");
      return;
    }
    if (!trimmedName) {
      setSignatoryError("Please enter the signatory name.");
      return;
    }
    if (!trimmedPosition) {
      setSignatoryError("Please enter the signatory position.");
      return;
    }

    setHaulingDateError("");
    setSignatoryError("");
    setExportError("");
    setIsExporting(true);

    try {
      // Calculate sum of all extracted quantities in kg (MT * 1000)
      const totalQtyKg = (exportGroup.records || []).reduce((sum, rec) => {
        if (
          rec &&
          rec.quantity !== undefined &&
          rec.quantity !== null &&
          rec.quantity !== ("" as any) &&
          !isNaN(Number(rec.quantity))
        ) {
          return sum + Number(rec.quantity) * 1000;
        }
        return sum;
      }, 0);

      const formattedTotalQty = Number.isInteger(totalQtyKg)
        ? totalQtyKg.toLocaleString("en-US")
        : totalQtyKg.toLocaleString("en-US", { maximumFractionDigits: 3 });

      const formattedHaulingDate = formatDateDdMmmYy(trimmedHaulingDate) || trimmedHaulingDate;

      // Gather all active weekly groups containing records
      const allActiveGroups = getWeeklyManifestGroups().filter(
        (g) => g.records && g.records.length > 0
      );

      // Sort groups chronologically ascending by weekStart
      const sortedActiveGroups = [...allActiveGroups].sort((a, b) =>
        a.weekStart.localeCompare(b.weekStart)
      );

      // Build export objects for each weekly group
      const weeklyGroupsExport = sortedActiveGroups.map((g) => {
        const sheetName = getWeeklySheetName(g, sortedActiveGroups);
        const sumKg = (g.records || []).reduce((sum: number, rec: any) => {
          if (rec && rec.quantity !== undefined && rec.quantity !== null && !isNaN(Number(rec.quantity))) {
            return sum + Number(rec.quantity) * 1000;
          }
          return sum;
        }, 0);
        const formattedGroupQty = Number.isInteger(sumKg)
          ? sumKg.toLocaleString("en-US")
          : sumKg.toLocaleString("en-US", { maximumFractionDigits: 3 });

        return {
          sheetName,
          weekId: g.weekId,
          weekStart: g.weekStart,
          weekEnd: g.weekEnd,
          formattedWeekRange: g.formattedWeekRange,
          haulingDate: formattedHaulingDate,
          signatoryName: trimmedName,
          signatoryPosition: trimmedPosition,
          totalQty: formattedGroupQty,
          records: g.records || [],
        };
      });

      const exportData: Record<string, any> = {
        DATE_COMPLETED: formattedHaulingDate,
        HAULING_DATE: formattedHaulingDate,
        SIGNED_BY: trimmedName,
        POSITION: trimmedPosition,
        SIGNATORY_NAME: trimmedName,
        SIGNATORY_POSITION: trimmedPosition,
        _weeklyGroups: weeklyGroupsExport,
      };

      console.log(`[MANIFEST EXPORT] Triggered Manifest Summary workbook export: ${weeklyGroupsExport.length} sheet(s) included.`);

      const currentYear = new Date().getFullYear();
      const outputFilename = `Weekly Manifest Summary ${currentYear}.xlsm`;

      await exportExcelWithTemplate(
        "WEEKLY_MANIFEST_TEMPLATE.xlsm",
        exportData,
        "items",
        [],
        outputFilename
      );

      setIsExportDialogOpen(false);
    } catch (err) {
      console.error("XLSM Export Error:", err);
      setExportError("Unable to export the weekly manifest. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const filteredRecords = (currentGroup?.records || []).filter((rec) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      rec.manifestNo.toLowerCase().includes(term) ||
      rec.controlNo.toLowerCase().includes(term) ||
      rec.companyName.toLowerCase().includes(term) ||
      rec.tpNumber.toLowerCase().includes(term);

    const matchesConfidence =
      filterConfidence === "All" || rec.confidence === filterConfidence;

    return matchesSearch && matchesConfidence;
  });

  return (
    <div id="smei-manifest-summary" className="p-4 md:p-6 space-y-6 max-w-[130rem] mx-auto w-full text-slate-800 dark:text-slate-100">
      {/* Title & Weekly Summary Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white tracking-tight font-display uppercase">
              Hazardous Waste Manifest Summary Ledger
            </h2>
            <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
              Zero-Cost Extraction
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Weekly Monday–Saturday compliance ledger populated from Control No. PDF document uploads.
          </p>
        </div>

        {currentGroup && (
          <button
            onClick={() => handleOpenExportDialog(currentGroup)}
            disabled={isExporting}
            className="bg-smei-crimson hover:bg-smei-darkred text-white text-xs font-semibold py-2.5 px-4 rounded-lg shadow-xs transition-all flex items-center gap-2 self-start md:self-auto cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Weekly Manifest</span>
          </button>
        )}
      </div>

      {/* Week Navigation bar */}
      {weeklyGroups.length > 0 ? (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-gray-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <button
              disabled={selectedGroupIndex >= weeklyGroups.length - 1}
              onClick={() => setSelectedGroupIndex((prev) => Math.min(prev + 1, weeklyGroups.length - 1))}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-30 hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg">
              <Calendar className="w-4 h-4 text-smei-crimson" />
              <span className="text-xs font-bold font-mono tracking-wide text-slate-800 dark:text-slate-200">
                {currentGroup?.formattedWeekRange}
              </span>
            </div>

            <button
              disabled={selectedGroupIndex <= 0}
              onClick={() => setSelectedGroupIndex((prev) => Math.max(prev - 1, 0))}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-30 hover:bg-slate-100 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-medium">
              Total Manifests this week: <strong className="text-smei-crimson font-mono text-sm">{currentGroup?.records.length || 0}</strong>
            </span>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800">
          <FileCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No manifest records found</p>
          <p className="text-xs text-slate-400 mt-1">Upload PDF documents in the Control No. Module to populate this weekly ledger.</p>
        </div>
      )}

      {/* Main Table Section */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-xs space-y-4">
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 justify-between items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search Manifest No, Control Code, Company Name, TP Number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-gray-200 dark:border-slate-800 rounded-lg text-xs pl-9 pr-4 py-2 focus:outline-none focus:ring-1 focus:ring-smei-crimson"
            />
          </div>

          <select
            value={filterConfidence}
            onChange={(e) => setFilterConfidence(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-gray-200 dark:border-slate-800 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-smei-crimson transition-all cursor-pointer w-full md:w-auto"
          >
            <option value="All">All Extraction Confidences</option>
            <option value="high">High Confidence</option>
            <option value="medium">Medium Confidence</option>
            <option value="low">Low Confidence (Requires Review)</option>
          </select>
        </div>

        {/* Directory Table */}
        <div className="border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3 font-display">Item</th>
                  <th className="py-2.5 px-3 font-display">Generator / Company</th>
                  <th className="py-2.5 px-3 font-display">Delivery Date</th>
                  <th className="py-2.5 px-3 font-display">TP Number</th>
                  <th className="py-2.5 px-3 font-display">Quantity (MT)</th>
                  <th className="py-2.5 px-3 font-display">Control No (CA)</th>
                  <th className="py-2.5 px-3 font-display">Manifest No</th>
                  <th className="py-2.5 px-3 text-center font-display">Extraction</th>
                  <th className="py-2.5 px-3 text-right font-display">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {filteredRecords.length > 0 ? (
                  filteredRecords.map((rec, idx) => {
                    const confidenceBadge = {
                      high: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400",
                      medium: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400",
                      low: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400",
                    }[rec.confidence || "high"];

                    return (
                      <tr 
                        key={rec.id} 
                        onDoubleClick={() => setEditingRecord(rec)}
                        className="hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors cursor-pointer select-none"
                        title="Double-click row to Edit / Review record"
                      >
                        <td className="py-3 px-3 font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-3 font-sans font-bold text-slate-800 dark:text-slate-200">
                          {rec.companyName}
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{formatDateDdMmmYy(rec.deliveryDate) || rec.deliveryDate}</td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{rec.tpNumber}</td>
                        <td className="py-3 px-3 text-smei-crimson font-bold">{rec.quantity} MT ({((rec.quantity || 0) * 1000).toLocaleString("en-US")} kg)</td>
                        <td className="py-3 px-3 text-slate-800 dark:text-slate-100 font-bold">{rec.controlNo}</td>
                        <td className="py-3 px-3 text-slate-800 dark:text-slate-100 font-bold">{rec.manifestNo}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 border rounded-full uppercase ${confidenceBadge}`}>
                            {rec.confidence === "high" ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                            <span>{rec.confidence || "HIGH"}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right space-x-1">
                          <button
                            onClick={() => setEditingRecord(rec)}
                            className="p-1 text-slate-400 hover:text-smei-crimson transition-colors"
                            title="Edit / Review"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(rec.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-slate-400">
                      No matching records found in this weekly period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit / Review Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800 dark:text-slate-200">
                Review / Edit Manifest Record
              </h3>
              <button onClick={() => setEditingRecord(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Company / Generator Name</label>
                <input
                  type="text"
                  required
                  value={editingRecord.companyName}
                  onChange={(e) => setEditingRecord({ ...editingRecord, companyName: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Delivery Date</label>
                  <input
                    type="date"
                    required
                    value={editingRecord.deliveryDate}
                    onChange={(e) => setEditingRecord({ ...editingRecord, deliveryDate: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded p-2 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Quantity (Metric Tonnes)</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={editingRecord.quantity}
                    onChange={(e) => setEditingRecord({ ...editingRecord, quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded p-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">TP Number</label>
                  <input
                    type="text"
                    required
                    value={editingRecord.tpNumber}
                    onChange={(e) => setEditingRecord({ ...editingRecord, tpNumber: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded p-2 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Manifest Number</label>
                  <input
                    type="text"
                    required
                    value={editingRecord.manifestNo}
                    onChange={(e) => setEditingRecord({ ...editingRecord, manifestNo: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded p-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Control No (Authoritative CA No)</label>
                <input
                  type="text"
                  required
                  value={editingRecord.controlNo}
                  onChange={(e) => setEditingRecord({ ...editingRecord, controlNo: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded p-2 font-mono font-bold"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-smei-crimson hover:bg-smei-darkred text-white rounded text-xs font-semibold"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- EXPORT WEEKLY MANIFEST DIALOG ---------------- */}
      {isExportDialogOpen && exportGroup && (
        <div id="export-weekly-manifest-dialog" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 md:p-5 border-b border-gray-200 dark:border-slate-800 flex items-start justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-smei-crimson" />
                  <h3 className="text-sm md:text-base font-bold text-slate-800 dark:text-slate-100 font-display uppercase tracking-wider">
                    Export Weekly Manifest
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Review the manifests and signing information before exporting the weekly manifest.
                </p>
              </div>
              <button
                onClick={() => setIsExportDialogOpen(false)}
                disabled={isExporting}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 md:p-6 overflow-y-auto space-y-5 flex-1">
              {/* HAULING DATE */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-lg border border-gray-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-mono font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    HAULING DATE *
                  </label>
                  {haulingDate && (
                    <span className="text-xs font-mono font-bold text-smei-crimson bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded border border-red-100 dark:border-red-900/30">
                      Format: {formatDateDdMmmYy(haulingDate)}
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  value={haulingDate}
                  disabled={isExporting}
                  onChange={(e) => {
                    setHaulingDate(e.target.value);
                    if (haulingDateError) setHaulingDateError("");
                  }}
                  className="w-full md:w-64 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-gray-200 dark:border-slate-800 rounded-lg p-2 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-smei-crimson"
                />
                {haulingDateError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1.5 pt-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{haulingDateError}</span>
                  </p>
                )}
              </div>

              {/* WEEKLY PERIOD */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-lg border border-gray-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
                    WEEKLY PERIOD
                  </span>
                  <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200 mt-0.5 block">
                    {exportGroup.formattedWeekRange}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 px-3 py-1 rounded-md border border-gray-200 dark:border-slate-800 text-xs font-mono font-bold text-smei-crimson">
                  {exportGroup.records.length} {exportGroup.records.length === 1 ? "Manifest" : "Manifests"}
                </div>
              </div>

              {/* MANIFESTS INCLUDED */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    MANIFESTS INCLUDED ({exportGroup.records.length})
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    All records in selected weekly period will be exported
                  </span>
                </div>

                <div className="border border-gray-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-2xs max-h-64 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead className="sticky top-0 bg-slate-100 dark:bg-slate-950 border-b border-gray-200 dark:border-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider z-10">
                      <tr>
                        <th className="py-2 px-3 font-display w-10">#</th>
                        <th className="py-2 px-3 font-display">Company Name</th>
                        <th className="py-2 px-3 font-display">Delivery Date</th>
                        <th className="py-2 px-3 font-display">TP Number</th>
                        <th className="py-2 px-3 font-display text-right">Quantity</th>
                        <th className="py-2 px-3 font-display">CA No.</th>
                        <th className="py-2 px-3 font-display">Manifest No.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {exportGroup.records.map((rec, idx) => {
                        const formattedQty = rec.quantity !== undefined && rec.quantity !== null && !isNaN(Number(rec.quantity))
                          ? `${((Number(rec.quantity) || 0) * 1000).toLocaleString("en-US")} kg`
                          : "-";

                        return (
                          <tr key={rec.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-950/50">
                            <td className="py-2 px-3 font-bold text-slate-400">{idx + 1}</td>
                            <td className="py-2 px-3 font-sans font-bold text-slate-800 dark:text-slate-200">{rec.companyName || "-"}</td>
                            <td className="py-2 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatDateDdMmmYy(rec.deliveryDate) || rec.deliveryDate || "-"}</td>
                            <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{rec.tpNumber || "-"}</td>
                            <td className="py-2 px-3 text-smei-crimson font-bold text-right whitespace-nowrap">{formattedQty}</td>
                            <td className="py-2 px-3 text-slate-800 dark:text-slate-200 font-bold whitespace-nowrap">{rec.controlNo || "-"}</td>
                            <td className="py-2 px-3 text-slate-800 dark:text-slate-200 font-bold whitespace-nowrap">{rec.manifestNo || "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SIGNATORY INFORMATION */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-lg border border-gray-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2 border-b border-gray-200 dark:border-slate-800 pb-2">
                  <UserCheck className="w-4 h-4 text-smei-crimson" />
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono uppercase tracking-wider">
                    SIGNATORY INFORMATION
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={signatoryName}
                      disabled={isExporting}
                      onChange={(e) => {
                        setSignatoryName(e.target.value);
                        if (signatoryError) setSignatoryError("");
                      }}
                      placeholder="Aprilyn J. Rogador"
                      className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-gray-200 dark:border-slate-800 rounded-lg p-2.5 font-sans font-semibold focus:outline-none focus:ring-1 focus:ring-smei-crimson"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">
                      Position *
                    </label>
                    <input
                      type="text"
                      value={signatoryPosition}
                      disabled={isExporting}
                      onChange={(e) => {
                        setSignatoryPosition(e.target.value);
                        if (signatoryError) setSignatoryError("");
                      }}
                      placeholder="Technical Supervisor"
                      className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-gray-200 dark:border-slate-800 rounded-lg p-2.5 font-sans font-semibold focus:outline-none focus:ring-1 focus:ring-smei-crimson"
                    />
                  </div>
                </div>

                {signatoryError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1.5 pt-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{signatoryError}</span>
                  </p>
                )}
              </div>

              {exportError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{exportError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 border-t border-gray-200 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsExportDialogOpen(false)}
                disabled={isExporting}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-bold font-mono uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmExport}
                disabled={isExporting}
                className="bg-smei-crimson hover:bg-smei-darkred text-white px-5 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Export Manifest</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
