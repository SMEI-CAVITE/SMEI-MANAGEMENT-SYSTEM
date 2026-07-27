import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Search, 
  Trash2, 
  Layers, 
  Calendar, 
  Edit,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  FileSpreadsheet,
  FileText,
  User,
  Shield,
  X,
  PlusCircle,
  AlertCircle
} from "lucide-react";
import { exportExcelWithTemplate } from "../utils/templateExport";
import { validateManifestNumber, generateManifestNumber } from "../utils/manifestHelper";
import { formatControlNumber } from "../utils/controlNumber";
import DeleteConfirmationModal from "./DeleteConfirmationModal";

interface WasteItem {
  id: string;
  description: string;
  classification?: "104" | "M506"; // Classification per-item
  qty: number;         // Qty (qty is a number)
  percentage: number;  // Percentage Recovery (%)
  haz_waste: number;   // Hazardous Waste (kg)
  local_tsd: number;   // Local TSD (kg)
  non_haz: number;     // Non Hazardous (kg)
  remarks: string;     // Remark
}

interface ManifestRecord {
  id: string;
  client: string;
  manifestNo: string;
  date: string;          // Hauling Date
  quantityKg: number;    // General Quantity (kg)
  recycle: string;       // Recycle Cert No.
  mrrNo: string;
  classification?: "104" | "M506"; // Kept for backward compatibility
  preparedBy: string;
  preparedPosition: string;
  checkedApprovedBy: string;
  checkedApprovedPosition: string;
  items: WasteItem[];
  createdAt: string;
}

export default function HazardousWasteModule() {
  const [records, setRecords] = useState<ManifestRecord[]>([]);
  const [manifestToDelete, setManifestToDelete] = useState<ManifestRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [classification, setClassification] = useState<"104" | "M506">("104");
  
  // Sorting states
  const [sortField, setSortField] = useState<"manifestNo" | "mrrNo" | "client" | "date" | "totalQty" | "totalHazTsd">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Form states - General Header Info
  const [client, setClient] = useState("");
  const [manifestNo, setManifestNo] = useState("");
  const [quantityKg, setQuantityKg] = useState<number | "">("");
  const [haulingDate, setHaulingDate] = useState("");
  const [recycleCertNo, setRecycleCertNo] = useState("");
  const [mrrNo, setMrrNo] = useState("");

  // Form states - Signatures
  const [preparedBy, setPreparedBy] = useState("");
  const [preparedPosition, setPreparedPosition] = useState("");
  const [checkedApprovedBy, setCheckedApprovedBy] = useState("");
  const [checkedApprovedPosition, setCheckedApprovedPosition] = useState("");

  // Form states - Table Items
  const [items, setItems] = useState<WasteItem[]>([
    {
      id: "item-1",
      description: "Acidic liquid plating waste",
      classification: "104",
      qty: 2450,
      percentage: 100,
      haz_waste: 0,
      local_tsd: 2450,
      non_haz: 0,
      remarks: "Batch neutralization reactor 3"
    }
  ]);

  // Load saved records from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("tsd_hazwaste_records");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setRecords(parsed);
        if (parsed.length > 0) {
          setSelectedRecordId(parsed[0].id);
        }
      } catch (e) {
        console.error("Failed to parse hazardous waste records", e);
      }
    } else {
      // Seed with highly-polished initial mock record matching the new schema (using kilograms)
      const initial: ManifestRecord[] = [
        {
          id: "MAN-2026-018",
          client: "Cavite Semiconductor Corp.",
          manifestNo: "M-R4A-2026-07-0028",
          date: new Date().toISOString().split("T")[0],
          quantityKg: 5700,
          recycle: "RC-2026-928A",
          mrrNo: "MRR-18491",
          classification: "104",
          preparedBy: "PRINCE JOHN JOHAN ARAGON",
          preparedPosition: "Documentation Staff",
          checkedApprovedBy: "APRILYN J. ROGADOR",
          checkedApprovedPosition: "Asst. Admin/Technical Manager",
          items: [
            {
              id: "item-1",
              description: "Copper Sludge acidic residue",
              classification: "104",
              qty: 4500,
              percentage: 80,
              haz_waste: 0,
              local_tsd: 3600,
              non_haz: 900,
              remarks: "Copper reclamation batch #1"
            },
            {
              id: "item-2",
              description: "Neutralized salt precipitate",
              classification: "104",
              qty: 1200,
              percentage: 0,
              haz_waste: 0,
              local_tsd: 0,
              non_haz: 1200,
              remarks: "Passed landfill pH limits"
            }
          ],
          createdAt: new Date().toLocaleDateString() + " 11:15 AM"
        }
      ];
      setRecords(initial);
      setSelectedRecordId(initial[0].id);
      localStorage.setItem("tsd_hazwaste_records", JSON.stringify(initial));
    }
  }, []);

  const saveRecordsToStorage = (updated: ManifestRecord[]) => {
    setRecords(updated);
    localStorage.setItem("tsd_hazwaste_records", JSON.stringify(updated));
  };

  // Automatic Calculation Helpers
  const calculateTotals = (itemList: WasteItem[]) => {
    const list = itemList || [];
    const totalQty = list.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    const totalHaz = list.reduce((sum, item) => {
      const isM506 = (item.classification || "104") === "M506";
      return sum + (isM506 ? (Number(item.haz_waste) || 0) : 0);
    }, 0);
    const totalTsd = list.reduce((sum, item) => {
      const is104 = (item.classification || "104") === "104";
      return sum + (is104 ? (Number(item.local_tsd) || 0) : 0);
    }, 0);
    const totalNonHaz = list.reduce((sum, item) => sum + (Number(item.non_haz) || 0), 0);
    return {
      totalQty: parseFloat(totalQty.toFixed(3)),
      totalHaz: parseFloat(totalHaz.toFixed(3)),
      totalTsd: parseFloat(totalTsd.toFixed(3)),
      totalNonHaz: parseFloat(totalNonHaz.toFixed(3))
    };
  };

  const totals = calculateTotals(items);

  // Table manipulation functions
  const handleAddItem = () => {
    const newItem: WasteItem = {
      id: `item-${Date.now()}`,
      description: "",
      classification: "104",
      qty: 0,
      percentage: 0,
      haz_waste: 0,
      local_tsd: 0,
      non_haz: 0,
      remarks: ""
    };
    setItems([...items, recalculateItem(newItem)]);
  };

  // Recalculates outputs for a single item based on its own Classification
  const recalculateItem = (item: WasteItem): WasteItem => {
    const qtyVal = Number(item.qty) || 0;
    const pctVal = Number(item.percentage) || 0;
    const itemClass = item.classification || "104";

    if (itemClass === "104") {
      const localTsd = parseFloat((qtyVal * (pctVal / 100)).toFixed(3));
      const nonHaz = parseFloat((qtyVal - localTsd).toFixed(3));
      return {
        ...item,
        classification: "104",
        haz_waste: 0,
        local_tsd: localTsd,
        non_haz: nonHaz
      };
    } else {
      // Classification M506
      const hazWaste = parseFloat((qtyVal * (pctVal / 100)).toFixed(3));
      const nonHaz = parseFloat((qtyVal - hazWaste).toFixed(3));
      return {
        ...item,
        classification: "M506",
        haz_waste: hazWaste,
        local_tsd: 0,
        non_haz: nonHaz
      };
    }
  };

  const handleUpdateItemField = (id: string, field: keyof WasteItem, value: any) => {
    const updated = items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        // Auto-calculate outputs if inputs change
        if (field === "qty" || field === "percentage" || field === "classification") {
          return recalculateItem(updatedItem);
        }
        return updatedItem;
      }
      return item;
    });
    setItems(updated);
  };

  const handleDeleteItemRow = (id: string) => {
    if (items.length <= 1) {
      alert("At least one substance row is required in the manifest.");
      return;
    }
    setItems(items.filter(item => item.id !== id));
  };

  const handleMoveRow = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    
    const reordered = [...items];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;
    setItems(reordered);
  };

  const handleCreateNew = () => {
    setEditingRecordId(null);
    setClient("");
    // Initial value of the Manifest Number input field must be empty string
    setManifestNo("");
    setQuantityKg("");
    // Hauling date must be empty/blank by default to require manual user selection
    setHaulingDate("");
    setRecycleCertNo("");
    setMrrNo("");
    setClassification("104");
    
    // Load defaults from localStorage or use designated new defaults
    setPreparedBy(localStorage.getItem("tsd_hazwaste_default_preparedBy") || "PRINCE JOHN JOHAN ARAGON");
    setPreparedPosition(localStorage.getItem("tsd_hazwaste_default_preparedPosition") || "Documentation Staff");
    setCheckedApprovedBy(localStorage.getItem("tsd_hazwaste_default_checkedApprovedBy") || "APRILYN J. ROGADOR");
    setCheckedApprovedPosition(localStorage.getItem("tsd_hazwaste_default_checkedApprovedPosition") || "Asst. Admin/Technical Manager");
    
    setItems([
      {
        id: "item-1",
        description: "",
        classification: "104",
        qty: 0,
        percentage: 0,
        haz_waste: 0,
        local_tsd: 0,
        non_haz: 0,
        remarks: ""
      }
    ]);
    setIsModalOpen(true);
  };

  // Main Form Submission
  const handleSaveManifest = (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (!client.trim() || !manifestNo.trim() || !mrrNo.trim() || !haulingDate.trim() || !recycleCertNo.trim() || quantityKg === "") {
      alert("Required header fields (Client, Manifest No, Quantity, Hauling Date, Recycle Cert No., and MRR No) are missing.");
      return;
    }

    if (!validateManifestNumber(manifestNo)) {
      alert("Manifest number format is invalid. It must follow the pattern: M-[REGION]-[YEAR]-[MONTH]-[NUMBER] (e.g. M-R3-2026-07-632758)");
      return;
    }

    if (items.some(item => !item.description.trim())) {
      alert("Please enter a description for all substance rows in the table.");
      return;
    }

    // Validate positive values
    const qtyNum = Number(quantityKg);
    if (isNaN(qtyNum) || qtyNum < 0) {
      alert("Header Quantity must be a valid non-negative number.");
      return;
    }

    if (items.some(item => item.qty < 0 || item.percentage < 0 || item.percentage > 100 || item.local_tsd < 0 || item.non_haz < 0)) {
      alert("Quantity, percentage, Local TSD, and Non-Hazardous values must be non-negative, and percentage recovery must be between 0% and 100%.");
      return;
    }

    let updatedDocs = [...records];

    const prepByVal = (preparedBy.trim() || "PRINCE JOHN JOHAN ARAGON").toUpperCase();
    const prepPosVal = preparedPosition.trim() || "Documentation Staff";
    const chkByVal = checkedApprovedBy.trim() || "APRILYN J. ROGADOR";
    const chkPosVal = checkedApprovedPosition.trim() || "Asst. Admin/Technical Manager";

    // Save defaults to localStorage for future records
    localStorage.setItem("tsd_hazwaste_default_preparedBy", prepByVal);
    localStorage.setItem("tsd_hazwaste_default_preparedPosition", prepPosVal);
    localStorage.setItem("tsd_hazwaste_default_checkedApprovedBy", chkByVal);
    localStorage.setItem("tsd_hazwaste_default_checkedApprovedPosition", chkPosVal);

    if (editingRecordId) {
      // Edit record
      updatedDocs = records.map(rec => {
        if (rec.id === editingRecordId) {
          return {
            ...rec,
            client,
            manifestNo: manifestNo.toUpperCase(),
            date: haulingDate,
            quantityKg: qtyNum,
            recycle: recycleCertNo.toUpperCase(),
            mrrNo: mrrNo.toUpperCase(),
            classification,
            preparedBy: prepByVal,
            preparedPosition: prepPosVal,
            checkedApprovedBy: chkByVal,
            checkedApprovedPosition: chkPosVal,
            items
          };
        }
        return rec;
      });
      saveRecordsToStorage(updatedDocs);
      setSelectedRecordId(editingRecordId);
    } else {
      // Create new manifest
      const newId = `MAN-${Date.now().toString().substring(7)}`;
      const newManifest: ManifestRecord = {
        id: newId,
        client,
        manifestNo: manifestNo.toUpperCase(),
        date: haulingDate,
        quantityKg: qtyNum,
        recycle: recycleCertNo.toUpperCase(),
        mrrNo: mrrNo.toUpperCase(),
        classification,
        preparedBy: prepByVal,
        preparedPosition: prepPosVal,
        checkedApprovedBy: chkByVal,
        checkedApprovedPosition: chkPosVal,
        items,
        createdAt: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      updatedDocs = [newManifest, ...records];
      saveRecordsToStorage(updatedDocs);
      setSelectedRecordId(newId);
    }

    setIsModalOpen(false);
  };

  const handleResetForm = () => {
    setEditingRecordId(null);
    setClient("");
    setManifestNo("");
    setQuantityKg("");
    setHaulingDate("");
    setRecycleCertNo("");
    setMrrNo("");
    setClassification("104");
    setPreparedBy("");
    setPreparedPosition("");
    setCheckedApprovedBy("");
    setCheckedApprovedPosition("");
    setItems([
      {
        id: "item-1",
        description: "",
        classification: "104",
        qty: 0,
        percentage: 0,
        haz_waste: 0,
        local_tsd: 0,
        non_haz: 0,
        remarks: ""
      }
    ]);
  };

  const handleEditRecord = (record: ManifestRecord) => {
    setEditingRecordId(record.id);
    setClient(record.client);
    setManifestNo((record.manifestNo || "").toUpperCase());
    setQuantityKg(record.quantityKg);
    setHaulingDate(record.date);
    setRecycleCertNo(record.recycle);
    setMrrNo(record.mrrNo);
    setPreparedBy(record.preparedBy.toUpperCase());
    setPreparedPosition(record.preparedPosition);
    setCheckedApprovedBy(record.checkedApprovedBy);
    setCheckedApprovedPosition(record.checkedApprovedPosition);
    setClassification(record.classification || "104");
    
    // Ensure each item has its classification set for backward compatibility
    const mappedItems = (record.items || []).map(item => ({
      ...item,
      classification: item.classification || record.classification || "104"
    }));
    setItems(mappedItems);
    setIsModalOpen(true);
  };

  const handleDeleteRecord = (record: ManifestRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setManifestToDelete(record);
  };

  const confirmDeleteRecord = (id: string) => {
    const updated = records.filter(r => r.id !== id);
    saveRecordsToStorage(updated);
    if (selectedRecordId === id) {
      setSelectedRecordId(updated.length > 0 ? updated[0].id : null);
    }
    if (editingRecordId === id) {
      handleResetForm();
    }
  };

  // High Fidelity Excel Template Export
  const handleExportExcel = async (record: ManifestRecord) => {
    try {
      const { totalQty, totalHaz, totalTsd, totalNonHaz } = calculateTotals(record.items);
      
      const payload = {
        CLIENT: record.client,
        MANIFEST: record.manifestNo,
        DATE: record.date,                  // maps to hauling date
        QUANTITY: record.quantityKg,        // maps to quantity (kg)
        MRR_NO: record.mrrNo,
        RECYCLE: record.recycle,            // maps to recycle cert no.
        TOTAL_QTY: totalQty,
        TOTAL_HAZ_WASTE: totalHaz,
        TOTAL_LOCAL_TSD: totalTsd,
        TOTAL_NON_HAZ: totalNonHaz,
        PREPARED_BY: record.preparedBy,
        PREPARED_POSITION: record.preparedPosition,
        CHECKED_APPROVED_BY: record.checkedApprovedBy,
        CHECKED_APPROVED_POSITION: record.checkedApprovedPosition
      };

      await exportExcelWithTemplate(
        "HAZWASTE_TEMPLATE.xlsm",
        payload,
        "items",
        record.items,
        `HAZ_WASTE_REPORT_${record.manifestNo}.xlsm`
      );
    } catch (e) {
      console.error(e);
      alert("Failed to export. Please verify that public/templates/HAZWASTE_TEMPLATE.xlsm exists.");
    }
  };

  const handleExportSelected = () => {
    const selected = records.find(r => r.id === selectedRecordId);
    if (selected) {
      handleExportExcel(selected);
    } else {
      alert("Please select a manifest from the table first.");
    }
  };

  // Extract numeric part of a string (e.g. MRR-18491 -> 18491)
  const getNumericPart = (str: string): number => {
    const match = String(str).match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  // Filters
  const filteredRecords = records.filter(rec => {
    const safeClient = rec.client || "";
    const safeManifestNo = rec.manifestNo || "";
    const safeMrrNo = rec.mrrNo || "";
    const query = (searchQuery || "").toLowerCase();

    return safeClient.toLowerCase().includes(query) ||
           safeManifestNo.toLowerCase().includes(query) ||
           safeMrrNo.toLowerCase().includes(query);
  });

  // Sort
  const sortedRecords = [...filteredRecords].sort((a, b) => {
    let valA: any = a[sortField as keyof ManifestRecord] || "";
    let valB: any = b[sortField as keyof ManifestRecord] || "";

    if (sortField === "totalQty" || sortField === "totalHazTsd") {
      const totalsA = calculateTotals(a.items);
      const totalsB = calculateTotals(b.items);
      valA = sortField === "totalQty" ? totalsA.totalQty : (totalsA.totalHaz + totalsA.totalTsd);
      valB = sortField === "totalQty" ? totalsB.totalQty : (totalsB.totalHaz + totalsB.totalTsd);
    } else if (sortField === "mrrNo") {
      valA = getNumericPart(a.mrrNo);
      valB = getNumericPart(b.mrrNo);
    }

    if (typeof valA === "number" && typeof valB === "number") {
      return sortDirection === "asc" ? valA - valB : valB - valA;
    }

    const strA = String(valA).toLowerCase();
    const strB = String(valB).toLowerCase();
    if (strA < strB) return sortDirection === "asc" ? -1 : 1;
    if (strA > strB) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const selectedRecord = records.find(r => r.id === selectedRecordId);

  return (
    <div id="smei-hazwaste-portal" className="p-4 md:p-6 space-y-6 max-w-[130rem] mx-auto w-full text-slate-800 dark:text-slate-100">
      {/* Header Block matching Purchase Order Portal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white tracking-tight font-display uppercase">
            Hazardous Waste Breakdown Catalog
          </h2>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Log, validate, and compute precise quantities of hazardous waste with high-fidelity Excel report macros.
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
            <span>New Hazardous Waste Entry</span>
          </button>

          <button
            onClick={handleExportSelected}
            disabled={!selectedRecordId}
            className={`text-xs font-semibold h-[38px] px-4 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all whitespace-nowrap ${
              !selectedRecordId
                ? "bg-gray-100 dark:bg-slate-800/80 text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-700 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600 hover:scale-[1.02] active:scale-95 cursor-pointer shadow-[0_2px_8px_rgba(16,185,129,0.15)]"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Selected Manifest</span>
          </button>

          {selectedRecord && (
            <div className="flex items-center gap-2 ml-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase font-mono tracking-wider">Selected:</span>
              <span className="text-[11px] font-bold font-mono text-smei-crimson bg-red-50 border border-red-200 px-2.5 py-1 rounded-md">
                {selectedRecord.manifestNo}
              </span>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search Client, Manifest, or MRR..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent focus:bg-white dark:focus:bg-slate-900 transition-all text-gray-700 dark:text-slate-200 font-mono"
          />
        </div>
      </div>

      {/* Central Records Table */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-gray-800 dark:text-slate-200 font-display uppercase tracking-wider flex items-center gap-2">
              <span>Consignment Manifest Registry</span>
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                {filteredRecords.length} Entries
              </span>
            </h3>
          </div>

          <div className="border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider select-none">
                    <th 
                      onClick={() => { setSortField("manifestNo"); setSortDirection(prev => prev === "asc" ? "desc" : "asc"); }}
                      className="py-3 px-4 font-display cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>Manifest No</span>
                        {sortField === "manifestNo" && (sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-smei-crimson" /> : <ArrowDown className="w-3 h-3 text-smei-crimson" />)}
                      </div>
                    </th>
                    <th className="py-3 px-4 font-display">Classification</th>
                    <th 
                      onClick={() => { setSortField("client"); setSortDirection(prev => prev === "asc" ? "desc" : "asc"); }}
                      className="py-3 px-4 font-display cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>Client / Company</span>
                        {sortField === "client" && (sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-smei-crimson" /> : <ArrowDown className="w-3 h-3 text-smei-crimson" />)}
                      </div>
                    </th>
                    <th 
                      onClick={() => { setSortField("mrrNo"); setSortDirection(prev => prev === "asc" ? "desc" : "asc"); }}
                      className="py-3 px-4 font-display cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>MRR Number</span>
                        {sortField === "mrrNo" && (sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-smei-crimson" /> : <ArrowDown className="w-3 h-3 text-smei-crimson" />)}
                      </div>
                    </th>
                    <th 
                      onClick={() => { setSortField("date"); setSortDirection(prev => prev === "asc" ? "desc" : "asc"); }}
                      className="py-3 px-4 font-display cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>Hauling Date</span>
                        {sortField === "date" && (sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-smei-crimson" /> : <ArrowDown className="w-3 h-3 text-smei-crimson" />)}
                      </div>
                    </th>
                    <th 
                      onClick={() => { setSortField("totalQty"); setSortDirection(prev => prev === "asc" ? "desc" : "asc"); }}
                      className="py-3 px-4 font-display text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Total Qty (kg)</span>
                        {sortField === "totalQty" && (sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-smei-crimson" /> : <ArrowDown className="w-3 h-3 text-smei-crimson" />)}
                      </div>
                    </th>
                    <th 
                      onClick={() => { setSortField("totalHazTsd"); setSortDirection(prev => prev === "asc" ? "desc" : "asc"); }}
                      className="py-3 px-4 font-display text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Total Haz / TSD (kg)</span>
                        {sortField === "totalHazTsd" && (sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-smei-crimson" /> : <ArrowDown className="w-3 h-3 text-smei-crimson" />)}
                      </div>
                    </th>
                    <th className="py-3 px-4 font-display text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80">
                  {sortedRecords.length > 0 ? (
                    sortedRecords.map((rec, index) => {
                      const recTotals = calculateTotals(rec.items);
                      const uniqueClasses = Array.from(new Set((rec.items || []).map(item => item.classification || "104")));
                      const recClass = uniqueClasses.length === 1 ? uniqueClasses[0] : uniqueClasses.length > 1 ? "Mixed" : (rec.classification || "104");
                      const totalHazTsd = recTotals.totalHaz + recTotals.totalTsd;

                      const classBadgeColor = 
                        recClass === "Mixed"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                          : recClass === "M506"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";

                      return (
                        <tr
                          key={rec.id}
                          onClick={() => setSelectedRecordId(rec.id)}
                          onDoubleClick={() => handleEditRecord(rec)}
                          className={`cursor-pointer transition-all group ${
                            selectedRecordId === rec.id
                              ? "bg-red-600/10 border-l-4 border-l-smei-crimson font-medium"
                              : index % 2 === 1
                              ? "bg-gray-50/45 hover:bg-red-600/5"
                              : "bg-white dark:bg-slate-900 hover:bg-red-600/5"
                          }`}
                        >
                          <td className="py-3 px-4 font-mono font-bold text-smei-crimson dark:text-rose-400">
                            {rec.manifestNo}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${classBadgeColor}`}>
                              {recClass}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-800 dark:text-slate-200 font-medium truncate max-w-[150px]">
                            {rec.client}
                          </td>
                          <td className="py-3 px-4 font-mono text-gray-600 dark:text-slate-400">
                            {rec.mrrNo}
                          </td>
                          <td className="py-3 px-4 font-mono text-gray-500 dark:text-slate-400">
                            {rec.date}
                          </td>
                          <td className="py-3 px-4 font-mono text-right font-semibold text-slate-700 dark:text-slate-300">
                            {recTotals.totalQty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 font-mono text-right font-semibold text-rose-600 dark:text-rose-400">
                            {totalHazTsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                                onClick={(e) => handleDeleteRecord(rec, e)}
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
                      <td colSpan={8} className="py-12 text-center text-gray-400 dark:text-slate-500">
                        No hazardous waste entries found. Click "+ New Hazardous Waste Entry" to register.
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
                <span>{editingRecordId ? "Modify Hazardous Waste Entry" : "Register Hazardous Waste Entry"}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1 rounded-full hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveManifest} className="p-6 space-y-6 overflow-y-auto flex-1">
              
              {/* General Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-gray-100 dark:border-slate-800">
                {/* Row 1 */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">Client / Company *</label>
                  <input
                    type="text"
                    required
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                    placeholder="Facility generating the substance..."
                    className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent text-gray-700 dark:text-slate-200 font-sans transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">Manifest Number *</label>
                    {manifestNo && !validateManifestNumber(manifestNo) && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-500 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Invalid format
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    value={manifestNo}
                    onChange={(e) => setManifestNo(formatControlNumber(e.target.value, "manifestNo"))}
                    placeholder="M-R3-2026-07-123456"
                    className={`w-full bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 border rounded-lg text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent font-mono ${
                      manifestNo && !validateManifestNumber(manifestNo)
                        ? "border-amber-400 dark:border-amber-500 focus:ring-amber-500"
                        : "border-gray-200 dark:border-slate-800"
                    }`}
                  />
                  {manifestNo && !validateManifestNumber(manifestNo) && (
                    <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 leading-normal space-y-0.5">
                      <p className="font-semibold">Use the format M-{"{"}REGION{"}"}-YYYY-MM-#</p>
                      <p className="text-gray-500 dark:text-slate-400 font-normal">
                        For example: M-R3-2026-07-632758. The region (e.g. R1, R2, R4A, NCR) must remain dynamic.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">Quantity (kg) *</label>
                  <input
                    type="number"
                    required
                    step="any"
                    value={quantityKg === "" ? "" : quantityKg}
                    onChange={(e) => setQuantityKg(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                    placeholder="General manifest weight in kg..."
                    className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent text-gray-700 dark:text-slate-200 font-mono transition-all"
                  />
                </div>

                {/* Row 3 */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">Hauling Date *</label>
                  <input
                    type="date"
                    required
                    value={haulingDate}
                    onChange={(e) => setHaulingDate(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent text-gray-700 dark:text-slate-200 font-mono cursor-pointer transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">Recycle Cert No. *</label>
                  <input
                    type="text"
                    required
                    value={recycleCertNo}
                    onChange={(e) => setRecycleCertNo(formatControlNumber(e.target.value, "rcNumber"))}
                    placeholder="e.g. R-123"
                    className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent text-gray-700 dark:text-slate-200 font-mono transition-all"
                  />
                </div>

                {/* Row 4 */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">MRR Number *</label>
                  <input
                    type="text"
                    required
                    value={mrrNo}
                    onChange={(e) => setMrrNo(formatControlNumber(e.target.value, "mrrNumber"))}
                    placeholder="e.g. MRR-2026-001"
                    className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent text-gray-700 dark:text-slate-200 font-mono transition-all"
                  />
                </div>
              </div>

              {/* Interactive Items Table */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Layers className="w-4 h-4 text-smei-crimson" />
                    <span>Chemical / Waste Breakdown Table</span>
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="border border-smei-crimson text-smei-crimson hover:bg-red-55/10 dark:hover:bg-red-950/20 text-xs font-semibold h-[28px] px-2.5 rounded-md flex items-center gap-1 cursor-pointer transition-all active:scale-95 bg-white dark:bg-slate-900"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Add row</span>
                  </button>
                </div>

                {/* Table Container */}
                <div className="border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto max-h-[250px]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950 border-b border-gray-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          <th className="py-2.5 px-3 min-w-[150px] font-display">Item Description *</th>
                          <th className="py-2.5 px-3 w-[100px] font-display">Classification</th>
                          <th className="py-2.5 px-3 w-[90px] text-right font-display">Qty (kg)</th>
                          <th className="py-2.5 px-3 w-[90px] text-right font-display">Recovery (%)</th>
                          <th className="py-2.5 px-3 w-[90px] text-right font-display">Haz (kg)</th>
                          <th className="py-2.5 px-3 w-[95px] text-right font-display">Local TSD (kg)</th>
                          <th className="py-2.5 px-3 w-[90px] text-right font-display">Non-Haz (kg)</th>
                          <th className="py-2.5 px-3 min-w-[120px] font-display">Remarks</th>
                          <th className="py-2.5 px-3 w-[80px] text-center font-display">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        {items.map((item, idx) => {
                          const itemClass = item.classification || "104";
                          const is104 = itemClass === "104";
                          const isM506 = itemClass === "M506";

                          return (
                            <tr key={item.id} className="hover:bg-red-600/5 dark:hover:bg-red-600/10 transition-colors bg-white dark:bg-slate-900">
                              <td className="p-2">
                                <input
                                  type="text"
                                  required
                                  value={item.description}
                                  onChange={(e) => handleUpdateItemField(item.id, "description", e.target.value)}
                                  placeholder="e.g. Copper Sludge"
                                  className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded p-1 text-xs focus:outline-none focus:ring-1 focus:ring-smei-crimson"
                                />
                              </td>
                              <td className="p-2">
                                <select
                                  value={itemClass}
                                  onChange={(e) => handleUpdateItemField(item.id, "classification", e.target.value as "104" | "M506")}
                                  className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded p-1 text-xs focus:outline-none focus:ring-1 focus:ring-smei-crimson cursor-pointer font-semibold transition-all"
                                >
                                  <option value="104">104</option>
                                  <option value="M506">M506</option>
                                </select>
                              </td>
                              <td className="p-2 text-right">
                                <input
                                  type="number"
                                  step="any"
                                  value={item.qty === 0 ? "" : item.qty}
                                  onChange={(e) => handleUpdateItemField(item.id, "qty", e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                                  className="w-full text-right bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded p-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-smei-crimson"
                                />
                              </td>
                              <td className="p-2 text-right">
                                <input
                                  type="number"
                                  step="any"
                                  value={item.percentage === 0 ? "" : item.percentage}
                                  onChange={(e) => handleUpdateItemField(item.id, "percentage", e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                                  className="w-full text-right bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded p-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-smei-crimson"
                                />
                              </td>
                              <td className="p-2 text-right">
                                <div className={`w-full bg-slate-50 dark:bg-slate-950/65 border border-gray-200/80 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 rounded p-1 text-xs font-mono font-semibold select-none ${isM506 ? "text-right" : "text-center text-gray-400 dark:text-slate-600"}`}>
                                  {isM506 ? item.haz_waste : "—"}
                                </div>
                              </td>
                              <td className="p-2 text-right">
                                <div className={`w-full bg-slate-50 dark:bg-slate-950/65 border border-gray-200/80 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 rounded p-1 text-xs font-mono font-semibold select-none ${is104 ? "text-right" : "text-center text-gray-400 dark:text-slate-600"}`}>
                                  {is104 ? item.local_tsd : "—"}
                                </div>
                              </td>
                              <td className="p-2 text-right">
                                <div className="w-full text-right bg-slate-50 dark:bg-slate-950/65 border border-gray-200/80 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 rounded p-1 text-xs font-mono font-semibold select-none">
                                  {item.non_haz}
                                </div>
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={item.remarks}
                                  onChange={(e) => handleUpdateItemField(item.id, "remarks", e.target.value)}
                                  placeholder="Notes..."
                                  className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded p-1 text-xs focus:outline-none focus:ring-1 focus:ring-smei-crimson"
                                />
                              </td>
                              <td className="p-2">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => handleMoveRow(idx, "up")}
                                    className="p-1 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-gray-400 disabled:opacity-30 cursor-pointer transition-all"
                                    title="Move row up"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === items.length - 1}
                                    onClick={() => handleMoveRow(idx, "down")}
                                    className="p-1 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-gray-400 disabled:opacity-30 cursor-pointer transition-all"
                                    title="Move row down"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteItemRow(item.id)}
                                    className="p-1 border border-red-100 dark:border-red-900/30 rounded bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 cursor-pointer transition-all"
                                    title="Delete row"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals Summary Footer */}
                  <div className="bg-slate-50 dark:bg-slate-950 border-t border-gray-200 dark:border-slate-800 p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono select-none font-semibold">
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-gray-100 dark:border-slate-800">
                      <span className="text-[9px] uppercase font-bold text-gray-400 dark:text-slate-500 block tracking-wide">Total Qty (kg)</span>
                      <span className="text-sm font-extrabold text-slate-700 dark:text-slate-200">{totals.totalQty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-gray-100 dark:border-slate-800">
                      <span className="text-[9px] uppercase font-bold text-gray-400 dark:text-slate-500 block tracking-wide">Total Haz (kg)</span>
                      <span className="text-sm font-extrabold text-smei-crimson dark:text-rose-400">{totals.totalHaz.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-gray-100 dark:border-slate-800">
                      <span className="text-[9px] uppercase font-bold text-gray-400 dark:text-slate-500 block tracking-wide">Total Local TSD (kg)</span>
                      <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400">{totals.totalTsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-gray-100 dark:border-slate-800">
                      <span className="text-[9px] uppercase font-bold text-gray-400 dark:text-slate-500 block tracking-wide">Total Non-Haz (kg)</span>
                      <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">{totals.totalNonHaz.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Preparation and Signatures Card */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-gray-100 dark:border-slate-800 space-y-4">
                <h4 className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest font-mono">Preparation & Verification Details</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300">
                      <User className="w-4 h-4 text-smei-crimson" />
                      <span>Prepared By</span>
                    </div>
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Name of preparer..."
                        value={preparedBy}
                        onChange={(e) => setPreparedBy(e.target.value.toUpperCase())}
                        className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-lg text-xs p-2 focus:outline-none focus:ring-1 focus:ring-smei-crimson"
                      />
                      <input
                        type="text"
                        placeholder="Position (e.g. EHS Coordinator)..."
                        value={preparedPosition}
                        onChange={(e) => setPreparedPosition(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-lg text-xs p-2 focus:outline-none focus:ring-1 focus:ring-smei-crimson"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300">
                      <Shield className="w-4 h-4 text-blue-600" />
                      <span>Checked / Approved By</span>
                    </div>
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Name of reviewer..."
                        value={checkedApprovedBy}
                        onChange={(e) => setCheckedApprovedBy(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-lg text-xs p-2 focus:outline-none focus:ring-1 focus:ring-smei-crimson"
                      />
                      <input
                        type="text"
                        placeholder="Position (e.g. Plant Manager)..."
                        value={checkedApprovedPosition}
                        onChange={(e) => setCheckedApprovedPosition(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-lg text-xs p-2 focus:outline-none focus:ring-1 focus:ring-smei-crimson"
                      />
                    </div>
                  </div>
                </div>
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
                  className="flex-1 bg-smei-crimson hover:bg-smei-darkred text-white text-xs font-semibold h-[38px] rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer hover:scale-[1.02] active:scale-95"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{editingRecordId ? "Save Changes" : "Create Record"}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      <DeleteConfirmationModal
        isOpen={manifestToDelete !== null}
        onClose={() => setManifestToDelete(null)}
        onConfirm={() => {
          if (manifestToDelete) {
            confirmDeleteRecord(manifestToDelete.id);
          }
        }}
        title="Delete Hazardous Waste Manifest"
        message={`Are you sure you want to permanently delete hazardous waste manifest ${manifestToDelete?.manifestNo} from the catalog?`}
        recordIdentifier={manifestToDelete?.manifestNo}
      />

    </div>
  );
}
