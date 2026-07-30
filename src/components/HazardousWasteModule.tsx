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
  AlertCircle,
  AlertTriangle,
  Lock,
  Scale,
  Building2,
  Percent,
  Hash,
  Info,
  FileCheck,
  Maximize2,
  RefreshCw
} from "lucide-react";
import { exportExcelWithTemplate } from "../utils/templateExport";
import { buildHazwasteExportData } from "../utils/hazardousWasteExport";
import { getTsdExportFilename } from "../utils/tsdFilename";
import { validateManifestNumber, generateManifestNumber } from "../utils/manifestHelper";
import { formatControlNumber, normalizeControlNo } from "../utils/controlNumber";
import { RcNumberInput } from "./RcNumberInput";
import DeleteConfirmationModal from "./DeleteConfirmationModal";
import { applyBusinessRounding, computeRecoveryValue } from "../utils/wasteRounding";
import { attachRecordToWorkflow, setActiveWorkflow, getActiveWorkflow, getAllWorkflows, WorkflowRecord } from "../utils/workflowManager";
import { notificationRepository } from "../services/notificationRepository";
import { safeSetLocalStorage } from "../utils/heavyStorage";
import { uploadDocumentFile, deleteDocumentFile, getDocumentUrl } from "../services/storageService";
import { WorkflowRepository } from "../services/workflowRepository";
import { 
  WasteRecoveryRule, 
  WASTE_RECOVERY_RULES, 
  getUniqueDescriptions, 
  getUniqueCompanies,
  getCompaniesForDescription,
  getDescriptionsForCompany,
  getRule 
} from "../data/wasteRecoveryRules";

export interface WasteItem {
  id: string;
  description: string;
  company?: string;
  isCustom?: boolean;          // Indicates if custom item bypassing Master Data
  customDescription?: string;   // Optional custom description string
  recoveryType?: "HAZ_WASTE" | "LOCAL_TSD" | "NON_HAZ" | "MULTIPLE";
  classification?: "104" | "M506" | ""; // User-controlled classification per-item
  qty: number;         // Qty (kg)
  percentage: number;  // Primary Percentage Recovery (%)
  secondaryPercentage?: number;
  secondaryRecoveryType?: "LOCAL_TSD" | "HAZ_WASTE" | "NON_HAZ";
  haz_waste: number;   // Hazardous Waste (kg)
  local_tsd: number;   // Local TSD (kg)
  non_haz: number;     // Non Hazardous (kg)
  remarks: string;     // Remark
}

export interface ManifestRecord {
  id: string;
  client: string;
  company?: string;      // Document-Level Master Company
  manifestNo: string;
  controlNo?: string;
  caNumber?: string;
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
  workflowId?: string;
  storagePath?: string;
  downloadUrl?: string;
  uploadedBy?: string;
  attachedFileName?: string;
}

// Extract authoritative Document Company from record or legacy item list
export function getRecordCompany(record?: ManifestRecord | null): string {
  if (!record) return "";
  if (record.company && record.company.trim()) {
    return record.company.trim();
  }
  if (record.items && record.items.length > 0) {
    const firstWithCompany = record.items.find(i => i.company && i.company.trim());
    if (firstWithCompany && firstWithCompany.company) {
      return firstWithCompany.company.trim();
    }
  }
  return "";
}

// Check if a legacy record has multiple different companies across its item rows
export function isMultiCompanyLegacyRecord(record?: ManifestRecord | null): boolean {
  if (!record || !record.items || record.items.length <= 1) return false;
  const comps = record.items.map(i => i.company).filter((c): c is string => Boolean(c && c.trim()));
  if (comps.length <= 1) return false;
  const uniqueComps = Array.from(new Set(comps.map(c => c.toLowerCase())));
  return uniqueComps.length > 1;
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
  const [company, setCompany] = useState(""); // Document-level Master Company
  const [manifestNo, setManifestNo] = useState("");
  const [quantityKg, setQuantityKg] = useState<number | "">("");
  const [haulingDate, setHaulingDate] = useState("");
  const [recycleCertNo, setRecycleCertNo] = useState("N/A");
  const [userRecycleCertNo, setUserRecycleCertNo] = useState("");
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
      company: "ASTEC",
      classification: "104",
      qty: 2450,
      percentage: 100,
      haz_waste: 0,
      local_tsd: 2450,
      non_haz: 0,
      remarks: "Batch neutralization reactor 3"
    }
  ]);

  const handleRecordSelect = (rec: ManifestRecord) => {
    setSelectedRecordId(rec.id);
    const activeWf = getActiveWorkflow();
    const allWorkflows = getAllWorkflows();
    const code = rec.controlNo || rec.caNumber || rec.manifestNo;

    let targetWf = rec.workflowId ? allWorkflows.find((w) => w.id === rec.workflowId) : null;
    if (!targetWf && code) {
      targetWf = allWorkflows.find((w) => w.controlNo && normalizeControlNo(w.controlNo) === normalizeControlNo(code)) || null;
    }

    if (!targetWf) {
      targetWf = attachRecordToWorkflow("hazardous-waste", rec, code);
    }

    if (targetWf && targetWf.id) {
      if (!activeWf || targetWf.id !== activeWf.id) {
        setActiveWorkflow(targetWf.id, targetWf.controlNo);
        window.dispatchEvent(new Event("tsd_data_changed"));
        window.dispatchEvent(new Event("tsd_workflows_updated"));
      }
    }
  };

  // Load saved records from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("tsd_hazwaste_records");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setRecords(parsed);
        if (parsed.length > 0) {
          const activeWf = getActiveWorkflow();
          const match = activeWf
            ? parsed.find(
                (r: any) =>
                  r.workflowId === activeWf.id ||
                  (activeWf.controlNo &&
                    (r.controlNo || r.caNumber || r.manifestNo) &&
                    normalizeControlNo(r.controlNo || r.caNumber || r.manifestNo) === normalizeControlNo(activeWf.controlNo))
              )
            : null;
          setSelectedRecordId(match ? match.id : parsed[0].id);
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
    safeSetLocalStorage("tsd_hazwaste_records", JSON.stringify(updated));
    if (updated && updated.length > 0) {
      const activeCa = updated[0].controlNo || updated[0].caNumber || updated[0].manifestNo;
      if (activeCa) {
        safeSetLocalStorage("tsd_active_control_no", activeCa.toUpperCase());
      }
    }

    window.dispatchEvent(new Event("tsd_data_changed"));
    window.dispatchEvent(new Event("tsd_workflows_updated"));
    window.dispatchEvent(new Event("tsd_storage_updated"));
  };

  // Automatic Calculation Helpers
  const calculateTotals = (itemList: WasteItem[]) => {
    const list = itemList || [];
    const totalQty = list.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    const totalHaz = list.reduce((sum, item) => sum + (Number(item.haz_waste) || 0), 0);
    const totalTsd = list.reduce((sum, item) => sum + (Number(item.local_tsd) || 0), 0);
    const totalNonHaz = list.reduce((sum, item) => sum + (Number(item.non_haz) || 0), 0);
    return {
      totalQty,
      totalHaz,
      totalTsd,
      totalNonHaz
    };
  };

  const totals = calculateTotals(items);
  const isRecycleApplicable = (totals.totalTsd > 0) || (totals.totalNonHaz > 0);
  const headerWeightNum = typeof quantityKg === "number" ? quantityKg : (quantityKg === "" ? 0 : parseFloat(String(quantityKg)) || 0);
  const breakdownTotalNum = totals.totalQty || 0;
  const weightDiffNum = Math.abs(headerWeightNum - breakdownTotalNum);
  const hasWeightMismatch = Math.round(headerWeightNum * 100) !== Math.round(breakdownTotalNum * 100);

  // Table manipulation functions
  const handleAddItem = () => {
    const newItem: WasteItem = {
      id: `item-${Date.now()}`,
      description: "",
      company: company,
      classification: "", // Blank default for manual user selection
      qty: 0,
      percentage: 0,
      haz_waste: 0,
      local_tsd: 0,
      non_haz: 0,
      remarks: ""
    };
    setItems([...items, newItem]);
  };

  // Recalculates outputs for a single item based on master reference rules or custom entry and user-selected classification
  const recalculateItem = (item: WasteItem): WasteItem => {
    const qtyVal = Number(item.qty) || 0;
    
    let pctVal = Number(item.percentage) || 0;
    let recType = item.recoveryType;
    let secPctVal = item.secondaryPercentage;
    let secRecType = item.secondaryRecoveryType;

    // Skip Master Data lookup completely if item is custom or description is "Other..."
    if (!item.isCustom && item.description && item.description !== "Other...") {
      const rule = getRule(item.description, item.company || "");
      if (rule) {
        pctVal = rule.percentage || 0;
        recType = rule.recoveryType;
        secPctVal = rule.secondaryPercentage;
        secRecType = rule.secondaryRecoveryType;
      }
    }

    // Keep user's chosen classification - DO NOT auto-populate or overwrite!
    const itemClass = item.classification || "";

    let hazWaste = 0;
    let localTsd = 0;
    let nonHaz = qtyVal;

    if (itemClass === "104") {
      const roundedRecovered = computeRecoveryValue(qtyVal, pctVal);
      localTsd = roundedRecovered;
      hazWaste = 0;
      nonHaz = Math.max(0, qtyVal - roundedRecovered);
    } else if (itemClass === "M506") {
      const roundedRecovered = computeRecoveryValue(qtyVal, pctVal);
      hazWaste = roundedRecovered;
      localTsd = 0;
      nonHaz = Math.max(0, qtyVal - roundedRecovered);
    } else {
      // Unselected class - outputs remain 0, non-haz equals total qty
      hazWaste = 0;
      localTsd = 0;
      nonHaz = qtyVal;
    }

    return {
      ...item,
      percentage: pctVal,
      secondaryPercentage: secPctVal,
      secondaryRecoveryType: secRecType,
      recoveryType: recType,
      haz_waste: hazWaste,
      local_tsd: localTsd,
      non_haz: nonHaz
    };
  };

  const handleCompanyChange = (newCompany: string) => {
    setCompany(newCompany);
    const validDescriptions = getDescriptionsForCompany(newCompany);
    
    // Update all items to inherit new company and filter descriptions
    const updatedItems = items.map(item => {
      let itemDesc = item.description;
      if (!item.isCustom && itemDesc && !validDescriptions.includes(itemDesc)) {
        itemDesc = ""; // Reset master data description if not supported under new company
      }
      const updatedItem = {
        ...item,
        company: newCompany,
        description: itemDesc
      };
      return recalculateItem(updatedItem);
    });
    setItems(updatedItems);
  };

  const handleUpdateItemDescription = (id: string, selectedValue: string) => {
    const updated = items.map(item => {
      if (item.id === id) {
        if (selectedValue === "Other...") {
          const customDescText = item.customDescription || (item.description !== "Other..." ? item.description : "");
          const updatedItem: WasteItem = {
            ...item,
            isCustom: true,
            customDescription: customDescText,
            description: customDescText,
            company: company,
            percentage: item.percentage || 0
          };
          return recalculateItem(updatedItem);
        } else {
          const updatedItem: WasteItem = {
            ...item,
            isCustom: false,
            customDescription: "",
            description: selectedValue,
            company: company
          };
          return recalculateItem(updatedItem);
        }
      }
      return item;
    });
    setItems(updated);
  };

  const handleUpdateCustomDescriptionText = (id: string, customText: string) => {
    const updated = items.map(item => {
      if (item.id === id) {
        const updatedItem: WasteItem = {
          ...item,
          isCustom: true,
          customDescription: customText,
          description: customText
        };
        return recalculateItem(updatedItem);
      }
      return item;
    });
    setItems(updated);
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
    setCompany("");
    setManifestNo("");
    setQuantityKg("");
    setHaulingDate("");
    setRecycleCertNo("N/A");
    setUserRecycleCertNo("");
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
        company: "",
        classification: "", // Blank default for manual user selection
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
  const handleSaveManifest = async (e: React.FormEvent) => {
    e.preventDefault();

    const currentTotals = calculateTotals(items);
    const saveIsRecycleApplicable = (currentTotals.totalTsd > 0) || (currentTotals.totalNonHaz > 0);
    const finalRecycleCertNo = saveIsRecycleApplicable
      ? ((recycleCertNo && recycleCertNo.toUpperCase() !== "N/A" ? recycleCertNo : userRecycleCertNo).trim().toUpperCase())
      : "N/A";

    // Validations
    if (!company.trim()) {
      alert("Please select a Master Company before saving breakdown items.");
      return;
    }

    if (!client.trim() || !manifestNo.trim() || !mrrNo.trim() || !haulingDate.trim() || quantityKg === "") {
      alert("Required header fields (Client, Master Company, Manifest No, Quantity, Hauling Date, and MRR No) are missing.");
      return;
    }

    if (saveIsRecycleApplicable && (!finalRecycleCertNo || finalRecycleCertNo === "N/A")) {
      alert("Recycle Cert No. is required when Total Local TSD or Total Non-Hazardous is greater than zero.");
      return;
    }

    if (!validateManifestNumber(manifestNo)) {
      alert("Manifest number format is invalid. It must follow the pattern: M-[REGION]-[YEAR]-[MONTH]-[NUMBER] (e.g. M-R3-2026-07-632758)");
      return;
    }

    if (items.some(item => {
      if (item.isCustom) {
        return !item.description || !item.description.trim() || item.description === "Other...";
      }
      return !item.description || !item.description.trim();
    })) {
      alert("Please select or specify a Custom Description for all substance rows in the table.");
      return;
    }

    if (items.some(item => {
      if (item.isCustom) {
        return item.percentage === undefined || item.percentage === null || isNaN(Number(item.percentage)) || Number(item.percentage) < 0 || Number(item.percentage) > 100;
      }
      return false;
    })) {
      alert("Please specify a valid Recovery Percentage (0% - 100%) for custom breakdown items.");
      return;
    }

    if (items.some(item => !item.classification || !item.classification.trim())) {
      alert("Please select a Classification (104 or M506) for every breakdown item.");
      return;
    }

    if (items.some(item => !item.qty || item.qty <= 0)) {
      alert("Quantity (kg) must be greater than zero for all substance rows in the table.");
      return;
    }

    // Defensive check: Prevent saving if Header Weight Quantity does not match computed Total Net Quantity
    if (hasWeightMismatch) {
      alert(`Validation Error: Weight Quantity Mismatch!\n\nHeader Weight Quantity (${headerWeightNum.toFixed(2)} kg) does not match the computed Total Net Quantity (${breakdownTotalNum.toFixed(2)} kg) from the item breakdown.\n\nPlease synchronize or correct the weight quantities before saving.`);
      return;
    }

    // Validate positive values
    const qtyNum = Number(quantityKg);
    if (isNaN(qtyNum) || qtyNum < 0) {
      alert("Header Quantity must be a valid non-negative number.");
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

    // Ensure items inherit current document company
    const finalizedItems = items.map(item => ({
      ...item,
      company: company.trim()
    }));

    const uppercaseManifestNo = manifestNo.toUpperCase();

    let targetRecord: ManifestRecord;
    let targetWf: WorkflowRecord;

    if (editingRecordId) {
      // Edit record
      const existing = records.find(rec => rec.id === editingRecordId);
      targetRecord = {
        ...(existing || {} as ManifestRecord),
        id: editingRecordId,
        client,
        company: company.trim(),
        manifestNo: uppercaseManifestNo,
        controlNo: uppercaseManifestNo,
        caNumber: uppercaseManifestNo,
        date: haulingDate,
        quantityKg: qtyNum,
        recycle: finalRecycleCertNo,
        mrrNo: mrrNo.toUpperCase(),
        classification,
        preparedBy: prepByVal,
        preparedPosition: prepPosVal,
        checkedApprovedBy: chkByVal,
        checkedApprovedPosition: chkPosVal,
        items: finalizedItems
      };
      try {
        targetWf = attachRecordToWorkflow("hazardous-waste", targetRecord, uppercaseManifestNo);
      } catch (err: any) {
        alert(err.message || "No active workflow is selected. Please select or create a workflow before saving this document.");
        return;
      }

      // Save to Firestore FIRST
      try {
        await WorkflowRepository.saveHazWasteRecord(targetRecord);
      } catch (fsErr: any) {
        console.error("[HazardousWasteModule] Failed to save record to Firestore:", fsErr);
        alert("Firestore Persistence Error: Unable to save record to database. Please check your network connection and try again.");
        return;
      }

      updatedDocs = records.map(rec => rec.id === editingRecordId ? targetRecord : rec);
      saveRecordsToStorage(updatedDocs);
      setSelectedRecordId(editingRecordId);
    } else {
      // Create new manifest
      const newId = `MAN-${Date.now().toString().substring(7)}`;
      targetRecord = {
        id: newId,
        client,
        company: company.trim(),
        manifestNo: uppercaseManifestNo,
        controlNo: uppercaseManifestNo,
        caNumber: uppercaseManifestNo,
        date: haulingDate,
        quantityKg: qtyNum,
        recycle: finalRecycleCertNo,
        mrrNo: mrrNo.toUpperCase(),
        classification,
        preparedBy: prepByVal,
        preparedPosition: prepPosVal,
        checkedApprovedBy: chkByVal,
        checkedApprovedPosition: chkPosVal,
        items: finalizedItems,
        createdAt: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      try {
        targetWf = attachRecordToWorkflow("hazardous-waste", targetRecord, uppercaseManifestNo);
      } catch (err: any) {
        alert(err.message || "No active workflow is selected. Please select or create a workflow before saving this document.");
        return;
      }

      // Save to Firestore FIRST
      try {
        await WorkflowRepository.saveHazWasteRecord(targetRecord);
      } catch (fsErr: any) {
        console.error("[HazardousWasteModule] Failed to save record to Firestore:", fsErr);
        alert("Firestore Persistence Error: Unable to save record to database. Please check your network connection and try again.");
        return;
      }

      updatedDocs = [targetRecord, ...records];
      saveRecordsToStorage(updatedDocs);
      setSelectedRecordId(newId);
    }

    notificationRepository.createNotification({
      portal: "TSD",
      module: "hazardous-waste",
      workflowId: targetWf.id,
      documentId: targetRecord.id,
      documentNumber: uppercaseManifestNo,
      title: editingRecordId ? "Hazardous Waste Record Updated" : "Hazardous Waste Record Created",
      message: `Hazardous waste manifest catalog ${editingRecordId ? 'updated' : 'created'} for Workflow ${targetWf.workflowCode || targetWf.id} (Control / Manifest No: ${uppercaseManifestNo}).`,
      priority: "MEDIUM"
    }).catch(() => {});

    setIsModalOpen(false);
  };

  const handleResetForm = () => {
    setEditingRecordId(null);
    setClient("");
    setCompany("");
    setManifestNo("");
    setQuantityKg("");
    setHaulingDate("");
    setRecycleCertNo("N/A");
    setUserRecycleCertNo("");
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
        company: "",
        classification: "", // Blank default for manual user selection
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
    const docComp = getRecordCompany(record);
    setCompany(docComp);
    setManifestNo((record.manifestNo || "").toUpperCase());
    setQuantityKg(record.quantityKg);
    setHaulingDate(record.date);

    const docTotals = calculateTotals(record.items || []);
    const docApplicable = (docTotals.totalTsd > 0) || (docTotals.totalNonHaz > 0);
    const storedRec = (record.recycle || "").trim();
    const validStoredRec = storedRec && storedRec.toUpperCase() !== "N/A" ? storedRec : "";
    setUserRecycleCertNo(validStoredRec);
    setRecycleCertNo(docApplicable ? (validStoredRec || "N/A") : "N/A");

    setMrrNo(record.mrrNo);
    setPreparedBy(record.preparedBy.toUpperCase());
    setPreparedPosition(record.preparedPosition);
    setCheckedApprovedBy(record.checkedApprovedBy);
    setCheckedApprovedPosition(record.checkedApprovedPosition);
    setClassification(record.classification || "104");
    
    // Ensure each item has document company, classification, and isCustom mode set for backward compatibility
    const mappedItems = (record.items || []).map(item => {
      const isCust = Boolean(item.isCustom) || (Boolean(item.description) && !getUniqueDescriptions().includes(item.description));
      return {
        ...item,
        isCustom: isCust,
        customDescription: isCust ? (item.customDescription || item.description) : "",
        company: item.company || docComp,
        classification: item.classification || record.classification || ""
      };
    });
    setItems(mappedItems);
    setIsModalOpen(true);
  };

  const handleDeleteRecord = (record: ManifestRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setManifestToDelete(record);
  };

  const confirmDeleteRecord = async (id: string) => {
    try {
      await WorkflowRepository.deleteHazWasteRecord(id);
    } catch (fsErr) {
      console.error("[HazardousWasteModule] Failed to delete record from Firestore:", fsErr);
    }
    const deletedIndex = records.findIndex(r => r.id === id);
    const updated = records.filter(r => r.id !== id);
    saveRecordsToStorage(updated);
    if (selectedRecordId === id) {
      if (updated.length > 0) {
        const nextIndex = Math.min(deletedIndex >= 0 ? deletedIndex : 0, updated.length - 1);
        setSelectedRecordId(updated[nextIndex].id);
      } else {
        setSelectedRecordId(null);
      }
    }
    if (editingRecordId === id) {
      handleResetForm();
    }
  };

  // High Fidelity Excel Template Export
  const handleExportExcel = async (record?: ManifestRecord) => {
    try {
      const recordsToExport = (records && records.length > 0)
        ? records
        : (record ? [record] : []);

      if (recordsToExport.length === 0) {
        alert("No hazardous waste records available to export.");
        return;
      }

      const activeDate = record?.date || recordsToExport[0].date || recordsToExport[0].createdAt || new Date().toISOString();
      const payload = buildHazwasteExportData(recordsToExport, activeDate);
      const exportFileName = getTsdExportFilename("hazardous-waste", activeDate, "xlsm");

      await exportExcelWithTemplate(
        "HAZWASTE_TEMPLATE.xlsm",
        payload,
        "items",
        [],
        exportFileName
      );
    } catch (e) {
      console.error(e);
      alert("Failed to export. Please verify that public/templates/HAZWASTE_TEMPLATE.xlsm exists.");
    }
  };

  const handleExportSelected = () => {
    const selected = records.find(r => r.id === selectedRecordId);
    handleExportExcel(selected || records[0]);
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
                          onClick={() => handleRecordSelect(rec)}
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
                          <td className="py-3 px-4 text-gray-800 dark:text-slate-200 font-medium truncate max-w-[180px]">
                            <div>{rec.client}</div>
                            {getRecordCompany(rec) && (
                              <div className="text-[10px] text-slate-400 font-mono">Company: {getRecordCompany(rec)}</div>
                            )}
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

      {/* Selected Manifest Detailed Breakdown Preview Section */}
      {selectedRecord ? (
        <div key={selectedRecord.id} className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-4 animate-fadeIn">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-50 dark:bg-red-950/40 rounded-xl text-smei-crimson border border-red-100 dark:border-red-900/30">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 font-display uppercase tracking-wider">
                    Chemical & Waste Breakdown Detail
                  </h3>
                  <span className="font-mono text-xs font-bold text-smei-crimson bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 px-2.5 py-0.5 rounded-md">
                    {selectedRecord.manifestNo}
                  </span>
                  {getRecordCompany(selectedRecord) && (
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                      <span className="text-[10px] uppercase text-slate-400 font-mono">Master Company:</span>
                      <strong className="text-smei-crimson font-mono">{getRecordCompany(selectedRecord)}</strong>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                  <span>Client: <strong className="text-slate-700 dark:text-slate-300">{selectedRecord.client}</strong></span>
                  <span>•</span>
                  <span>MRR: <strong className="font-mono text-slate-700 dark:text-slate-300">{selectedRecord.mrrNo}</strong></span>
                  <span>•</span>
                  <span>Recycle Cert: <strong className="font-mono text-slate-700 dark:text-slate-300">
                    {(() => {
                      const { totalTsd, totalNonHaz } = calculateTotals(selectedRecord.items || []);
                      return (totalTsd > 0 || totalNonHaz > 0) ? (selectedRecord.recycle && selectedRecord.recycle !== "N/A" ? selectedRecord.recycle : "N/A") : "N/A";
                    })()}
                  </strong></span>
                  <span>•</span>
                  <span>Hauling Date: <strong className="font-mono text-slate-700 dark:text-slate-300">{selectedRecord.date}</strong></span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleEditRecord(selectedRecord)}
                className="text-xs font-semibold h-[34px] px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Modify Manifest</span>
              </button>
            </div>
          </div>

          {/* Legacy Multi-Company Warning Banner if applicable */}
          {isMultiCompanyLegacyRecord(selectedRecord) && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Legacy Record Notice:</strong> This breakdown document contains multiple companies across individual rows from a prior version. Upon saving edits, all rows will align under a single Master Company.
              </span>
            </div>
          )}

          {/* Table Container */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs bg-white dark:bg-slate-900">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider select-none">
                    <th className="py-3 px-3.5 w-[32%] min-w-[260px] font-display">Substance Description</th>
                    <th className="py-3 px-2.5 w-[7%] min-w-[85px] font-display text-center">Class</th>
                    <th className="py-3 px-2.5 w-[10%] min-w-[120px] font-display text-center">Recovery Rule</th>
                    <th className="py-3 px-3 w-[11%] min-w-[110px] font-display text-right">Qty (kg)</th>
                    <th className="py-3 px-3 w-[10%] min-w-[100px] font-display text-right">Haz Waste (kg)</th>
                    <th className="py-3 px-3 w-[10%] min-w-[100px] font-display text-right">Local TSD (kg)</th>
                    <th className="py-3 px-3 w-[10%] min-w-[100px] font-display text-right">Non-Haz (kg)</th>
                    <th className="py-3 px-3.5 min-w-[160px] font-display">Remarks / Batch Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {selectedRecord.items && selectedRecord.items.length > 0 ? (
                    selectedRecord.items.map((item) => {
                      const itemClass = item.classification || selectedRecord.classification || "104";
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3.5 font-medium text-slate-800 dark:text-slate-200" title={item.description}>
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{item.description}</div>
                          </td>
                          <td className="py-2.5 px-2.5 text-center">
                            <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              itemClass === "M506"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                            }`}>
                              {itemClass}
                            </span>
                          </td>
                          <td className="py-2.5 px-2.5 text-center font-mono text-[11px]">
                            {item.recoveryType === "MULTIPLE" ? (
                              <span className="text-purple-600 dark:text-purple-400 font-semibold">
                                {item.percentage}% Haz / {item.secondaryPercentage}% TSD
                              </span>
                            ) : item.recoveryType === "NON_HAZ" ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">0% (Non-Haz)</span>
                            ) : item.percentage ? (
                              <span className="text-slate-700 dark:text-slate-300 font-semibold">{item.percentage}%</span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-600">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                            {Number(item.qty || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-smei-crimson dark:text-rose-400">
                            {Number(item.haz_waste || 0) > 0 ? Number(item.haz_waste).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                            {Number(item.local_tsd || 0) > 0 ? Number(item.local_tsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {Number(item.non_haz || 0) > 0 ? Number(item.non_haz).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-500 dark:text-slate-400 italic font-sans text-[11px]">
                            {item.remarks || "—"}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 dark:text-slate-500">
                        No chemical breakdown items configured for this manifest.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Total Summary Footer Cards for Selected Manifest */}
            {(() => {
              const selTotals = calculateTotals(selectedRecord.items);
              return (
                <div className="bg-slate-50/90 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 p-3.5 grid grid-cols-2 lg:grid-cols-4 gap-3 select-none">
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1 font-mono">
                        <Scale className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                        <span>Total Net Weight</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 font-semibold">100%</span>
                    </div>
                    <div className="mt-1 font-mono text-base font-extrabold text-slate-800 dark:text-slate-100">
                      {selTotals.totalQty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between border-l-4 border-l-smei-crimson">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase text-smei-crimson dark:text-rose-400 tracking-wider flex items-center gap-1 font-mono">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Hazardous Output</span>
                      </span>
                      <span className="text-[10px] font-mono text-rose-500 font-bold">
                        {selTotals.totalQty > 0 ? ((selTotals.totalHaz / selTotals.totalQty) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-base font-extrabold text-smei-crimson dark:text-rose-400">
                      {selTotals.totalHaz.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between border-l-4 border-l-blue-600">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase text-blue-600 dark:text-blue-400 tracking-wider flex items-center gap-1 font-mono">
                        <Shield className="w-3.5 h-3.5" />
                        <span>Local TSD Output</span>
                      </span>
                      <span className="text-[10px] font-mono text-blue-500 font-bold">
                        {selTotals.totalQty > 0 ? ((selTotals.totalTsd / selTotals.totalQty) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-base font-extrabold text-blue-600 dark:text-blue-400">
                      {selTotals.totalTsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between border-l-4 border-l-emerald-600">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-1 font-mono">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Non-Haz Residual</span>
                      </span>
                      <span className="text-[10px] font-mono text-emerald-500 font-bold">
                        {selTotals.totalQty > 0 ? ((selTotals.totalNonHaz / selTotals.totalQty) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                      {selTotals.totalNonHaz.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 p-8 sm:p-12 rounded-xl border border-gray-100 dark:border-slate-800 shadow-xs text-center space-y-3 animate-fadeIn">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase font-display tracking-wider">
            No Hazardous Breakdown Selected
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Select a record from the consignment registry table above to view its chemical breakdown details, totals, and export options.
          </p>
        </div>
      )}

      {/* Interactive Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-7xl w-full overflow-hidden animate-fadeIn flex flex-col max-h-[92vh]">

            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-smei-crimson text-white rounded-xl shadow-xs">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 font-display uppercase tracking-wider">
                    {editingRecordId ? "Modify Hazardous Waste Entry" : "Register Hazardous Waste Entry"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Configure master-driven chemical breakdown rows, verify auto-computed recovery distributions, and sign off.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveManifest} className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
              
              {/* General Fields Header Card */}
              <div className="bg-slate-50/80 dark:bg-slate-950/60 p-4.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 font-display uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-smei-crimson" />
                    <span>Manifest Consignment Header</span>
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400 font-medium">* Required Fields</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Master Company (Rule Owner) */}
                  <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Master Company (Rule Owner) *
                      </label>
                      {!company && (
                        <span className="text-[10px] text-smei-crimson font-semibold">
                          Required
                        </span>
                      )}
                    </div>
                    <select
                      required
                      value={company}
                      onChange={(e) => handleCompanyChange(e.target.value)}
                      className={`w-full h-9 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border rounded-lg text-xs px-3 focus:outline-none focus:ring-2 focus:ring-smei-crimson/20 focus:border-smei-crimson font-sans transition-all shadow-xs cursor-pointer ${
                        !company ? "border-smei-crimson/60 bg-red-50/20" : "border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <option value="">-- Select Master Company --</option>
                      {getUniqueCompanies().map((comp) => (
                        <option key={comp} value={comp}>
                          {comp}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Client */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Client / Facility Generator *</label>
                    <input
                      type="text"
                      required
                      value={client}
                      onChange={(e) => setClient(e.target.value)}
                      placeholder="Facility generating the substance..."
                      className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs px-3 focus:outline-none focus:ring-2 focus:ring-smei-crimson/20 focus:border-smei-crimson text-slate-800 dark:text-slate-100 font-sans transition-all shadow-xs"
                    />
                  </div>

                  {/* Manifest Number */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Manifest Number *</label>
                      {manifestNo && !validateManifestNumber(manifestNo) && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-500 font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Format error
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      value={manifestNo}
                      onChange={(e) => setManifestNo(formatControlNumber(e.target.value, "manifestNo"))}
                      placeholder="M-R3-2026-07-123456"
                      className={`w-full h-9 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border rounded-lg text-xs px-3 focus:outline-none focus:ring-2 focus:ring-smei-crimson/20 focus:border-smei-crimson font-mono transition-all shadow-xs ${
                        manifestNo && !validateManifestNumber(manifestNo)
                          ? "border-amber-400 dark:border-amber-500 focus:ring-amber-500"
                          : "border-slate-200 dark:border-slate-700"
                      }`}
                    />
                    {manifestNo && !validateManifestNumber(manifestNo) && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                        Expected pattern: M-{"{"}REGION{"}"}-YYYY-MM-# (e.g. M-R3-2026-07-632758)
                      </p>
                    )}
                  </div>

                  {/* General Quantity (kg) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Header Weight Qty (kg) *
                      </label>
                      {hasWeightMismatch && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-500 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          Weight Mismatch
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      required
                      step="any"
                      value={quantityKg === "" ? "" : quantityKg}
                      onChange={(e) => setQuantityKg(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                      placeholder="General manifest weight in kg..."
                      className={`w-full h-9 bg-white dark:bg-slate-900 border rounded-lg text-xs px-3 focus:outline-none focus:ring-2 font-mono transition-all shadow-xs ${
                        hasWeightMismatch
                          ? "border-amber-400 dark:border-amber-500 focus:ring-amber-500/30 text-amber-900 dark:text-amber-100 bg-amber-50/20"
                          : "border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:ring-smei-crimson/20 focus:border-smei-crimson"
                      }`}
                    />
                    {hasWeightMismatch && (
                      <div className="mt-1.5 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs space-y-2 shadow-2xs">
                        <div className="flex items-start gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <span className="font-semibold text-amber-900 dark:text-amber-200 leading-tight text-[11px]">
                            Header Weight Qty does not match the computed Total Net Qty.
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-amber-200/60 dark:border-amber-800/40 text-[10px]">
                          <div className="bg-white/60 dark:bg-slate-900/60 p-1.5 rounded-lg border border-amber-200/40 dark:border-amber-800/30">
                            <span className="text-amber-700/80 dark:text-amber-400/80 block text-[9px] uppercase font-bold tracking-wider truncate">Header Weight</span>
                            <span className="font-mono font-bold text-amber-950 dark:text-amber-100 block mt-0.5 text-[11px]">
                              {headerWeightNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                            </span>
                          </div>
                          <div className="bg-white/60 dark:bg-slate-900/60 p-1.5 rounded-lg border border-amber-200/40 dark:border-amber-800/30">
                            <span className="text-amber-700/80 dark:text-amber-400/80 block text-[9px] uppercase font-bold tracking-wider truncate">Breakdown Total</span>
                            <span className="font-mono font-bold text-amber-950 dark:text-amber-100 block mt-0.5 text-[11px]">
                              {breakdownTotalNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                            </span>
                          </div>
                          <div className="bg-white/60 dark:bg-slate-900/60 p-1.5 rounded-lg border border-amber-200/40 dark:border-amber-800/30">
                            <span className="text-amber-700/80 dark:text-amber-400/80 block text-[9px] uppercase font-bold tracking-wider truncate">Difference</span>
                            <span className="font-mono font-bold text-amber-950 dark:text-amber-100 block mt-0.5 text-[11px]">
                              {weightDiffNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setQuantityKg(breakdownTotalNum)}
                          className="w-full mt-2 py-1.5 px-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Sync Header Weight to Computed Total ({breakdownTotalNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg)</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Hauling Date */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Hauling Date *</label>
                    <input
                      type="date"
                      required
                      value={haulingDate}
                      onChange={(e) => setHaulingDate(e.target.value)}
                      className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs px-3 focus:outline-none focus:ring-2 focus:ring-smei-crimson/20 focus:border-smei-crimson text-slate-800 dark:text-slate-100 font-mono cursor-pointer transition-all shadow-xs"
                    />
                  </div>

                  {/* Recycle Cert No. */}
                  <RcNumberInput
                    value={isRecycleApplicable ? (recycleCertNo === "N/A" ? userRecycleCertNo : recycleCertNo) : "N/A"}
                    onChange={(val) => {
                      setUserRecycleCertNo(val);
                      setRecycleCertNo(val);
                    }}
                    required={isRecycleApplicable}
                    disabled={!isRecycleApplicable}
                    label="Recycle Cert No."
                    placeholder="e.g. R-123"
                    helperText={!isRecycleApplicable ? "Automatically set to N/A when Total Local TSD and Total Non-Hazardous are 0." : undefined}
                    id="hazardous-waste-rc-no"
                  />

                  {/* MRR Number */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">MRR Number *</label>
                    <input
                      type="text"
                      required
                      value={mrrNo}
                      onChange={(e) => setMrrNo(formatControlNumber(e.target.value, "mrrNumber"))}
                      placeholder="e.g. MRR-2026-001"
                      className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs px-3 focus:outline-none focus:ring-2 focus:ring-smei-crimson/20 focus:border-smei-crimson text-slate-800 dark:text-slate-100 font-mono transition-all shadow-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Legacy Record Warning in Edit Modal */}
              {editingRecordId && isMultiCompanyLegacyRecord(records.find(r => r.id === editingRecordId)) && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Legacy Multi-Company Breakdown Detected:</strong> This legacy breakdown contains multiple companies across its rows. Selecting a Master Company above will standardize all rows for this document.
                  </span>
                </div>
              )}

              {/* Refactored Enterprise Breakdown Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2 font-display">
                      <Layers className="w-4 h-4 text-smei-crimson" />
                      <span>Chemical & Hazardous Waste Breakdown Table</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Substance descriptions automatically apply recovery percentage rules from the selected Master Company.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    disabled={!company}
                    className="border border-smei-crimson text-smei-crimson hover:bg-smei-crimson hover:text-white dark:hover:bg-smei-crimson text-xs font-semibold h-9 px-3 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 bg-white dark:bg-slate-900 shadow-2xs disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-smei-crimson disabled:cursor-not-allowed"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Add Substance Row</span>
                  </button>
                </div>

                {!company && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Please select a <strong>Master Company</strong> in the header above to select substance descriptions and add breakdown rows.</span>
                  </div>
                )}

                {/* Table Container */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs bg-white dark:bg-slate-900">
                  <div className="overflow-x-auto max-h-[380px] custom-scrollbar">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="sticky top-0 z-10 bg-slate-100/95 dark:bg-slate-950/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider select-none">
                          <th className="py-3 px-3.5 w-[30%] min-w-[240px] font-display">Substance Description *</th>
                          <th className="py-3 px-2.5 w-[11%] min-w-[105px] font-display text-center">Class *</th>
                          <th className="py-3 px-2.5 w-[8%] min-w-[110px] font-display text-center">Recovery %</th>
                          <th className="py-3 px-3 w-[10%] min-w-[110px] font-display text-right">Qty (kg) *</th>
                          <th className="py-3 px-3 w-[8%] min-w-[105px] font-display text-right">Haz Waste (kg)</th>
                          <th className="py-3 px-3 w-[8%] min-w-[105px] font-display text-right">Local TSD (kg)</th>
                          <th className="py-3 px-3 w-[8%] min-w-[105px] font-display text-right">Non-Haz (kg)</th>
                          <th className="py-3 px-3 min-w-[160px] font-display">Remarks</th>
                          <th className="py-3 px-3 w-[110px] text-center font-display">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        {items.map((item, idx) => {
                          const availableDescriptions = company ? getDescriptionsForCompany(company) : getUniqueDescriptions();

                          return (
                            <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors bg-white dark:bg-slate-900">
                              {/* Description Dropdown & Custom Text Input */}
                              <td className="p-2.5 align-middle">
                                <div className="space-y-1.5">
                                  <select
                                    required
                                    disabled={!company}
                                    value={item.isCustom ? "Other..." : item.description}
                                    onChange={(e) => handleUpdateItemDescription(item.id, e.target.value)}
                                    title={item.description || "Select substance description"}
                                    className="w-full h-9 px-3 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 shadow-2xs focus:outline-none focus:ring-2 focus:ring-smei-crimson/20 focus:border-smei-crimson hover:border-slate-300 dark:hover:border-slate-600 transition-all font-sans cursor-pointer disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-900/50 disabled:cursor-not-allowed truncate"
                                  >
                                    <option value="">
                                      {!company ? "-- Select Master Company First --" : "-- Select Description --"}
                                    </option>
                                    {availableDescriptions.map((desc) => (
                                      <option key={desc} value={desc}>
                                        {desc}
                                      </option>
                                    ))}
                                    <option value="Other...">Other...</option>
                                  </select>

                                  {item.isCustom && (
                                    <input
                                      type="text"
                                      required
                                      placeholder="Enter custom material description *"
                                      value={item.customDescription !== undefined ? item.customDescription : (item.description !== "Other..." ? item.description : "")}
                                      onChange={(e) => handleUpdateCustomDescriptionText(item.id, e.target.value)}
                                      className="w-full h-8 px-2.5 text-xs rounded-lg border border-smei-crimson/40 bg-red-50/30 dark:bg-red-950/30 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-smei-crimson/20 focus:border-smei-crimson font-medium shadow-2xs"
                                    />
                                  )}
                                </div>
                              </td>

                              {/* User-Controlled Classification Dropdown */}
                              <td className="p-2.5 align-middle text-center">
                                <select
                                  required
                                  value={item.classification || ""}
                                  onChange={(e) => handleUpdateItemField(item.id, "classification", e.target.value)}
                                  title={item.classification ? `Class ${item.classification}` : "Select Classification (104 or M506)"}
                                  className={`w-full h-9 px-2 text-center text-xs font-mono font-bold rounded-lg border focus:outline-none focus:ring-2 focus:ring-smei-crimson/20 focus:border-smei-crimson transition-all font-sans cursor-pointer shadow-2xs ${
                                    item.classification === "M506"
                                      ? "bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300"
                                      : item.classification === "104"
                                      ? "bg-blue-50/80 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300"
                                      : "bg-red-50/60 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 font-sans font-normal"
                                  }`}
                                >
                                  <option value="">-- Class * --</option>
                                  <option value="104">104</option>
                                  <option value="M506">M506</option>
                                </select>
                              </td>

                              {/* Recovery Percentage (Editable for Custom Mode, Readonly System Rule for Master Data) */}
                              <td className="p-2.5 align-middle text-center">
                                {item.isCustom ? (
                                  <div className="relative">
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      max="100"
                                      required
                                      placeholder="Rec %"
                                      value={item.percentage !== undefined && item.percentage !== null ? item.percentage : ""}
                                      onChange={(e) => handleUpdateItemField(item.id, "percentage", e.target.value)}
                                      className="w-full h-9 px-2 text-center text-xs font-mono font-bold rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 shadow-2xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                                      title="Manually specify Recovery Percentage for custom item"
                                    />
                                  </div>
                                ) : (
                                  <div className="h-9 px-2 flex items-center justify-center gap-1 rounded-lg font-mono text-xs font-semibold border border-dashed border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-950/80 text-slate-700 dark:text-slate-300 select-none shadow-2xs text-center" title="Auto-assigned recovery percentage from master rule">
                                    <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                                    {item.recoveryType === "MULTIPLE" ? (
                                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold truncate">
                                        {item.percentage}% Haz / {item.secondaryPercentage}% TSD
                                      </span>
                                    ) : item.recoveryType === "NON_HAZ" ? (
                                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">0% Non-Haz</span>
                                    ) : item.percentage ? (
                                      <span className="text-slate-800 dark:text-slate-200 font-bold">{item.percentage}%</span>
                                    ) : (
                                      <span className="text-slate-400 dark:text-slate-600">—</span>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* Editable Quantity (kg) */}
                              <td className="p-2.5 align-middle text-right">
                                <input
                                  type="number"
                                  required
                                  step="any"
                                  min="0"
                                  value={item.qty === 0 ? "" : item.qty}
                                  onChange={(e) => handleUpdateItemField(item.id, "qty", e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                                  placeholder="0"
                                  className="w-full h-9 px-3 text-right bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-smei-crimson/20 focus:border-smei-crimson hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-2xs"
                                />
                              </td>

                              {/* Auto Computed Haz (kg) (Readonly Field) */}
                              <td className="p-2.5 align-middle text-right">
                                <div className={`h-9 px-3 flex items-center justify-end gap-1.5 rounded-lg font-mono text-xs font-bold border border-dashed border-slate-200 dark:border-slate-800/80 bg-slate-100/80 dark:bg-slate-950/80 select-none text-right shadow-2xs ${
                                  item.haz_waste > 0 ? "text-smei-crimson dark:text-rose-400" : "text-slate-400 dark:text-slate-600"
                                }`} title="Auto-computed Hazardous Waste output">
                                  <Lock className="w-3 h-3 text-slate-400/60 shrink-0" />
                                  <span>{item.haz_waste > 0 ? item.haz_waste.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : "0"}</span>
                                </div>
                              </td>

                              {/* Auto Computed Local TSD (kg) (Readonly Field) */}
                              <td className="p-2.5 align-middle text-right">
                                <div className={`h-9 px-3 flex items-center justify-end gap-1.5 rounded-lg font-mono text-xs font-bold border border-dashed border-slate-200 dark:border-slate-800/80 bg-slate-100/80 dark:bg-slate-950/80 select-none text-right shadow-2xs ${
                                  item.local_tsd > 0 ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-600"
                                }`} title="Auto-computed Local TSD output">
                                  <Lock className="w-3 h-3 text-slate-400/60 shrink-0" />
                                  <span>{item.local_tsd > 0 ? item.local_tsd.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : "0"}</span>
                                </div>
                              </td>

                              {/* Auto Computed Non-Haz (kg) (Readonly Field) */}
                              <td className="p-2.5 align-middle text-right">
                                <div className={`h-9 px-3 flex items-center justify-end gap-1.5 rounded-lg font-mono text-xs font-bold border border-dashed border-slate-200 dark:border-slate-800/80 bg-slate-100/80 dark:bg-slate-950/80 select-none text-right shadow-2xs ${
                                  item.non_haz > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-600"
                                }`} title="Auto-computed Non-Hazardous Residual">
                                  <Lock className="w-3 h-3 text-slate-400/60 shrink-0" />
                                  <span>{item.non_haz > 0 ? item.non_haz.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : "0"}</span>
                                </div>
                              </td>

                              {/* Remarks Input */}
                              <td className="p-2.5 align-middle">
                                <input
                                  type="text"
                                  value={item.remarks}
                                  onChange={(e) => handleUpdateItemField(item.id, "remarks", e.target.value)}
                                  placeholder="Batch notes..."
                                  className="w-full h-9 px-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-smei-crimson/20 focus:border-smei-crimson hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-2xs"
                                />
                              </td>

                              {/* Actions */}
                              <td className="p-2.5 align-middle">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => handleMoveRow(idx, "up")}
                                    className="h-8 w-8 flex items-center justify-center border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 cursor-pointer transition-all shadow-2xs"
                                    title="Move row up"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === items.length - 1}
                                    onClick={() => handleMoveRow(idx, "down")}
                                    className="h-8 w-8 flex items-center justify-center border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 cursor-pointer transition-all shadow-2xs"
                                    title="Move row down"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteItemRow(item.id)}
                                    className="h-8 w-8 flex items-center justify-center border border-red-200 dark:border-red-900/40 rounded-lg bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 hover:scale-105 active:scale-95 cursor-pointer transition-all shadow-2xs"
                                    title="Delete row"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Refactored Total Summary Footer Cards */}
                  <div className="bg-slate-50/90 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 p-3.5 grid grid-cols-2 lg:grid-cols-4 gap-3 select-none">
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1 font-mono">
                          <Scale className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                          <span>Total Net Qty</span>
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 font-semibold">100%</span>
                      </div>
                      <div className="mt-1 font-mono text-base font-extrabold text-slate-800 dark:text-slate-100">
                        {totals.totalQty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between border-l-4 border-l-smei-crimson">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase text-smei-crimson dark:text-rose-400 tracking-wider flex items-center gap-1 font-mono">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Total Haz Waste</span>
                        </span>
                        <span className="text-[10px] font-mono text-rose-500 font-bold">
                          {totals.totalQty > 0 ? ((totals.totalHaz / totals.totalQty) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-base font-extrabold text-smei-crimson dark:text-rose-400">
                        {totals.totalHaz.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between border-l-4 border-l-blue-600">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase text-blue-600 dark:text-blue-400 tracking-wider flex items-center gap-1 font-mono">
                          <Shield className="w-3.5 h-3.5" />
                          <span>Total Local TSD</span>
                        </span>
                        <span className="text-[10px] font-mono text-blue-500 font-bold">
                          {totals.totalQty > 0 ? ((totals.totalTsd / totals.totalQty) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-base font-extrabold text-blue-600 dark:text-blue-400">
                        {totals.totalTsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between border-l-4 border-l-emerald-600">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-1 font-mono">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Total Non-Haz</span>
                        </span>
                        <span className="text-[10px] font-mono text-emerald-500 font-bold">
                          {totals.totalQty > 0 ? ((totals.totalNonHaz / totals.totalQty) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                        {totals.totalNonHaz.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Preparation and Signatures Card */}
              <div className="bg-slate-50/80 dark:bg-slate-950/60 p-4.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 space-y-4">
                <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono">Preparation & Sign-off Details</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <User className="w-4 h-4 text-smei-crimson" />
                      <span>Prepared By</span>
                    </div>
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Name of preparer..."
                        value={preparedBy}
                        onChange={(e) => setPreparedBy(e.target.value.toUpperCase())}
                        className="w-full h-9 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-xs px-3 focus:outline-none focus:ring-2 focus:ring-smei-crimson/20 focus:border-smei-crimson transition-all shadow-xs"
                      />
                      <input
                        type="text"
                        placeholder="Position (e.g. EHS Coordinator)..."
                        value={preparedPosition}
                        onChange={(e) => setPreparedPosition(e.target.value)}
                        className="w-full h-9 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-xs px-3 focus:outline-none focus:ring-2 focus:ring-smei-crimson/20 focus:border-smei-crimson transition-all shadow-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <Shield className="w-4 h-4 text-blue-600" />
                      <span>Checked / Approved By</span>
                    </div>
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Name of reviewer..."
                        value={checkedApprovedBy}
                        onChange={(e) => setCheckedApprovedBy(e.target.value)}
                        className="w-full h-9 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-xs px-3 focus:outline-none focus:ring-2 focus:ring-smei-crimson/20 focus:border-smei-crimson transition-all shadow-xs"
                      />
                      <input
                        type="text"
                        placeholder="Position (e.g. Plant Manager)..."
                        value={checkedApprovedPosition}
                        onChange={(e) => setCheckedApprovedPosition(e.target.value)}
                        className="w-full h-9 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-xs px-3 focus:outline-none focus:ring-2 focus:ring-smei-crimson/20 focus:border-smei-crimson transition-all shadow-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold h-[40px] rounded-xl cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={hasWeightMismatch}
                  title={hasWeightMismatch ? "Save Disabled: Header Weight Quantity does not match computed Total Net Quantity." : ""}
                  className={`flex-1 text-xs font-semibold h-[40px] rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm ${
                    hasWeightMismatch
                      ? "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-60"
                      : "bg-smei-crimson hover:bg-smei-darkred text-white cursor-pointer hover:scale-[1.01] active:scale-95"
                  }`}
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
