import React, { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  RefreshCw,
  AlertCircle,
  Building2,
  Calendar,
  User,
  DollarSign,
  ShieldCheck,
  History,
  Check,
  X,
  ChevronRight,
  Send,
  FileCheck,
  FileSpreadsheet,
  Receipt,
  ClipboardList,
  ArrowLeft,
  Download,
  Lock,
  Link,
  Info,
  PenTool,
  CheckSquare,
  Sparkles
} from "lucide-react";
import {
  User as AppUser,
  UserRole,
  PurchaseOrder,
  PaymentInstructionSlip,
  RequestForSupply,
  CanvassSheet,
  ApprovalStatus,
  ApprovalHistoryEntry,
  UnifiedProcurementDocument,
  DocumentApprovalSignature
} from "../types";
import { api } from "../lib/api";
import { exportPOToWord, exportPOToXLSM } from "../utils/wordExport";
import { exportWordWithTemplate, exportExcelWithTemplate } from "../utils/templateExport";
import { mapPISData, mapRFSData, mapCanvassData, formatRFSNo } from "../utils/templateMapping";
import { SecurityService } from "../services/securityService";
import ModuleSecurityGate from "./ModuleSecurityGate";
import SecurityPINModal from "./SecurityPINModal";

interface ProcurementApprovalModuleProps {
  currentUser: AppUser;
}

type ViewMode = "LANDING" | "PO" | "PIS" | "RFS" | "CANVASS";

export const ProcurementApprovalModule: React.FC<ProcurementApprovalModuleProps> = ({
  currentUser
}) => {
  // Navigation State
  const [activeView, setActiveView] = useState<ViewMode>("LANDING");

  // Map ViewMode to gate key
  const viewToGateKey = (view: ViewMode): string => {
    switch (view) {
      case "PO":
        return "po_approval_gate";
      case "PIS":
        return "pis_approval_gate";
      case "RFS":
        return "rfs_approval_gate";
      case "CANVASS":
        return "canvass_approval_gate";
      default:
        return "po_approval_gate";
    }
  };

  // Verified approval queues tracking (Security PIN Validation per Queue)
  const [verifiedApprovalModules, setVerifiedApprovalModules] = useState<Record<ViewMode, boolean>>(() => {
    return {
      LANDING: true,
      PO: !SecurityService.isPINRequired("po_approval_gate", currentUser).required,
      PIS: !SecurityService.isPINRequired("pis_approval_gate", currentUser).required,
      RFS: !SecurityService.isPINRequired("rfs_approval_gate", currentUser).required,
      CANVASS: !SecurityService.isPINRequired("canvass_approval_gate", currentUser).required,
    };
  });

  // Security challenge state for queue navigation
  const [pendingTargetView, setPendingTargetView] = useState<ViewMode | null>(null);

  // Check if Security PIN validation is required when attempting to navigate to target view
  const isPinRequiredForModule = (view: ViewMode): boolean => {
    if (view === "LANDING") return false;
    const gateKey = viewToGateKey(view);
    const status = SecurityService.isPINRequired(gateKey, currentUser);
    return status.required;
  };

  // Central Navigation Handler with Security PIN Check
  const handleNavigateToQueue = (targetView: ViewMode) => {
    if (targetView === "LANDING") {
      setActiveView("LANDING");
      setStatusTab("ALL");
      setSearchQuery("");
      setSelectedDocument(null);
      return;
    }

    if (targetView === activeView) return;

    if (isPinRequiredForModule(targetView)) {
      setPendingTargetView(targetView);
    } else {
      setActiveView(targetView);
      setStatusTab("ALL");
      setSelectedDocument(null);
    }
  };

  // Loading & Feedback State
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Raw documents from backend API
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [pises, setPises] = useState<PaymentInstructionSlip[]>([]);
  const [rfses, setRfses] = useState<RequestForSupply[]>([]);
  const [canvasses, setCanvasses] = useState<CanvassSheet[]>([]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusTab, setStatusTab] = useState<string>("ALL"); // "ALL" | "Pending Approval" | "Approved" | "Rejected" | "Completed"
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Selected document state for header action bar
  const [selectedDocument, setSelectedDocument] = useState<UnifiedProcurementDocument | null>(null);

  // Modal States
  const [reviewDoc, setReviewDoc] = useState<UnifiedProcurementDocument | null>(null);
  const [reviewTab, setReviewTab] = useState<"details" | "history" | "signatures" | "related">("details");

  const [approveConfirmDoc, setApproveConfirmDoc] = useState<UnifiedProcurementDocument | null>(null);
  const [approveRfsDueDate, setApproveRfsDueDate] = useState<string>("");
  const [approveRfsStatus, setApproveRfsStatus] = useState<"Complete" | "Incomplete" | "On Time" | "Late">("Complete");

  const openApproveModal = (doc: UnifiedProcurementDocument) => {
    setApproveConfirmDoc(doc);
    if (doc.documentType === "RFS") {
      const rawRFS = doc.rawDocument as RequestForSupply;
      setApproveRfsDueDate(rawRFS?.dueDate || new Date().toISOString().split("T")[0]);
      const currentStatus = rawRFS?.status;
      setApproveRfsStatus(currentStatus && currentStatus !== "Incomplete" ? currentStatus : "Complete");
    }
  };
  const [rejectConfirmDoc, setRejectConfirmDoc] = useState<UnifiedProcurementDocument | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");

  const [exportConfirmDoc, setExportConfirmDoc] = useState<UnifiedProcurementDocument | null>(null);

  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Synchronize data from backend
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [posData, pisData, rfsData, canvData] = await Promise.all([
        api.getPOs().catch(() => []),
        api.getPIS().catch(() => []),
        api.getRFS().catch(() => []),
        api.getCanvass().catch(() => [])
      ]);
      setPos(posData);
      setPises(pisData);
      setRfses(rfsData);
      setCanvasses(canvData);
    } catch (err: any) {
      console.error("Failed to load procurement documents:", err);
      setError("Failed to synchronize procurement records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Normalize all raw documents into UnifiedProcurementDocument items
  const unifiedDocuments: UnifiedProcurementDocument[] = useMemo(() => {
    const list: UnifiedProcurementDocument[] = [];

    // 1. Purchase Orders
    pos.forEach((po) => {
      let appStatus: ApprovalStatus = po.approvalStatus || "Pending Approval";
      if (po.status === "Approved") appStatus = "Approved";
      else if (po.status === "Rejected") appStatus = "Rejected";
      else if (po.status === "Cancelled") appStatus = "Cancelled";
      else if (po.status === "Draft") appStatus = "Draft";

      let totalAmount = 0;
      if (po.items && Array.isArray(po.items)) {
        totalAmount = po.items.reduce(
          (acc, item) => acc + (Number(item.amount) || (Number(item.quantity) * Number(item.unitPrice)) || 0),
          0
        );
      }

      list.push({
        id: po.id,
        documentType: "PO",
        documentNumber: po.poNumber || "PO-UNASSIGNED",
        controlNumber: po.rfsNumber || po.poNumber,
        requestedBy: po.preparedBy || po.created_by || "Purchasing Staff",
        department: po.created_department || "Purchasing",
        date: po.poDate || po.createdAt?.split("T")[0] || "-",
        amount: totalAmount > 0 ? totalAmount : null,
        operationalStatus: po.status,
        approvalStatus: appStatus,
        rawDocument: po,
        submittedBy: po.preparedBy,
        approvedBy: po.approvedBy,
        approvedByName: po.approvedByName || po.approvedBy,
        approvedAt: po.approvedAt || po.dateApproved,
        rejectedBy: po.rejectedBy,
        rejectedByName: po.rejectedByName,
        rejectedAt: po.rejectedAt,
        rejectionReason: po.rejectionReason,
        exportStatus: (po as any).exportStatus || "NOT_EXPORTED",
        exportedAt: (po as any).exportedAt,
        exportedBy: (po as any).exportedBy,
        exportedByName: (po as any).exportedByName,
        exportedByPosition: (po as any).exportedByPosition,
        signatureHistory: (po as any).signatureHistory || [],
        approvalHistory: po.approvalHistory || []
      });
    });

    // 2. Payment Instruction Slips (PIS)
    pises.forEach((pis) => {
      let appStatus: ApprovalStatus =
        pis.approvalStatus ||
        (pis.status === "Approved"
          ? "Approved"
          : pis.status === "Rejected"
          ? "Rejected"
          : pis.status === "Cancelled"
          ? "Cancelled"
          : pis.status === "Draft"
          ? "Draft"
          : "Pending Approval");

      list.push({
        id: pis.id,
        documentType: "PIS",
        documentNumber: pis.pisNumber || "PIS-UNASSIGNED",
        controlNumber: pis.pisNumber,
        requestedBy: pis.requestedBy || "Purchasing Staff",
        department: pis.created_department || "Finance / Accounting",
        date: pis.scheduleDate || pis.createdAt?.split("T")[0] || "-",
        amount: pis.amount ? Number(pis.amount) : null,
        operationalStatus: pis.status,
        approvalStatus: appStatus,
        rawDocument: pis,
        submittedBy: pis.requestedBy,
        approvedBy: pis.acceptedBy,
        approvedByName: pis.approvedByName || pis.acceptedBy,
        approvedAt: pis.approvedAt,
        rejectedBy: pis.rejectedBy,
        rejectedByName: pis.rejectedByName,
        rejectedAt: pis.rejectedAt,
        rejectionReason: pis.rejectionReason,
        exportStatus: (pis as any).exportStatus || "NOT_EXPORTED",
        exportedAt: (pis as any).exportedAt,
        exportedBy: (pis as any).exportedBy,
        exportedByName: (pis as any).exportedByName,
        exportedByPosition: (pis as any).exportedByPosition,
        signatureHistory: (pis as any).signatureHistory || [],
        approvalHistory: pis.approvalHistory || []
      });
    });

    // 3. Requests for Supply (RFS)
    rfses.forEach((rfs) => {
      let appStatus: ApprovalStatus =
        rfs.approvalStatus ||
        (rfs.approvedBy
          ? "Approved"
          : rfs.rejectedBy
          ? "Rejected"
          : "Pending Approval");

      list.push({
        id: rfs.id,
        documentType: "RFS",
        documentNumber: rfs.rfsNumber || "RFS-UNASSIGNED",
        controlNumber: rfs.controlNumber || rfs.rfsNumber,
        requestedBy: rfs.requestedBy || "Department Staff",
        department: rfs.department || "Operations",
        date: rfs.dateRequested || rfs.createdAt?.split("T")[0] || "-",
        amount: null,
        operationalStatus: rfs.status,
        approvalStatus: appStatus,
        rawDocument: rfs,
        submittedBy: rfs.requestedBy,
        approvedBy: rfs.approvedBy,
        approvedByName: rfs.approvedByName || rfs.approvedBy,
        approvedAt: rfs.approvedAt,
        rejectedBy: rfs.rejectedBy,
        rejectedByName: rfs.rejectedByName,
        rejectedAt: rfs.rejectedAt,
        rejectionReason: rfs.rejectionReason,
        exportStatus: (rfs as any).exportStatus || "NOT_EXPORTED",
        exportedAt: (rfs as any).exportedAt,
        exportedBy: (rfs as any).exportedBy,
        exportedByName: (rfs as any).exportedByName,
        exportedByPosition: (rfs as any).exportedByPosition,
        signatureHistory: (rfs as any).signatureHistory || [],
        approvalHistory: rfs.approvalHistory || []
      });
    });

    // 4. Canvass Sheets
    canvasses.forEach((canv) => {
      let appStatus: ApprovalStatus =
        canv.approvalStatus ||
        (canv.status === "Approved"
          ? "Approved"
          : canv.status === "Rejected"
          ? "Rejected"
          : "Pending Approval");

      list.push({
        id: canv.id,
        documentType: "CANVASS",
        documentNumber: canv.canvassNumber || "00000",
        controlNumber: canv.canvassNumber,
        requestedBy: canv.requestedBy || "Purchasing Staff",
        department: canv.created_department || "Procurement",
        date: canv.canvassDate || canv.createdAt?.split("T")[0] || "-",
        amount: canv.totalCost ? Number(canv.totalCost) : canv.lowestPrice ? Number(canv.lowestPrice) : null,
        operationalStatus: canv.status || "Active",
        approvalStatus: appStatus,
        rawDocument: canv,
        submittedBy: canv.requestedBy,
        approvedBy: canv.approvedBy,
        approvedByName: canv.approvedByName || canv.approvedBy,
        approvedAt: canv.approvedAt,
        rejectedBy: canv.rejectedBy,
        rejectedByName: canv.rejectedByName,
        rejectedAt: canv.rejectedAt,
        rejectionReason: canv.rejectionReason,
        exportStatus: (canv as any).exportStatus || "NOT_EXPORTED",
        exportedAt: (canv as any).exportedAt,
        exportedBy: (canv as any).exportedBy,
        exportedByName: (canv as any).exportedByName,
        exportedByPosition: (canv as any).exportedByPosition,
        signatureHistory: (canv as any).signatureHistory || [],
        approvalHistory: canv.approvalHistory || []
      });
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [pos, pises, rfses, canvasses]);

  // Compute breakdown stats per document type
  const docTypeStats = useMemo(() => {
    const computeStatsFor = (type: "PO" | "PIS" | "RFS" | "CANVASS") => {
      const docs = unifiedDocuments.filter((d) => d.documentType === type);
      const total = docs.length;
      const pending = docs.filter((d) => d.approvalStatus === "Pending Approval").length;
      const approved = docs.filter((d) => d.approvalStatus === "Approved").length;
      const rejected = docs.filter((d) => d.approvalStatus === "Rejected").length;
      const completed = docs.filter(
        (d) => d.operationalStatus === "Closed" || d.operationalStatus === "Complete" || d.operationalStatus === "Released"
      ).length;
      return { total, pending, approved, rejected, completed };
    };

    return {
      PO: computeStatsFor("PO"),
      PIS: computeStatsFor("PIS"),
      RFS: computeStatsFor("RFS"),
      CANVASS: computeStatsFor("CANVASS")
    };
  }, [unifiedDocuments]);

  // Total pending across all document types
  const totalGlobalPending = useMemo(() => {
    return (
      docTypeStats.PO.pending +
      docTypeStats.PIS.pending +
      docTypeStats.RFS.pending +
      docTypeStats.CANVASS.pending
    );
  }, [docTypeStats]);

  // Filtered documents for active view
  const currentViewDocuments = useMemo(() => {
    if (activeView === "LANDING") return [];

    return unifiedDocuments.filter((doc) => {
      // 1. Doc Type match
      if (doc.documentType !== activeView) return false;

      // 2. Status Tab match
      if (statusTab === "Pending Approval" && doc.approvalStatus !== "Pending Approval") return false;
      if (statusTab === "Approved" && doc.approvalStatus !== "Approved") return false;
      if (statusTab === "Rejected" && doc.approvalStatus !== "Rejected") return false;
      if (statusTab === "Completed") {
        if (
          doc.operationalStatus !== "Closed" &&
          doc.operationalStatus !== "Complete" &&
          doc.operationalStatus !== "Released" &&
          doc.approvalStatus !== "Approved"
        ) {
          return false;
        }
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const numMatch = doc.documentNumber.toLowerCase().includes(q);
        const reqMatch = doc.requestedBy.toLowerCase().includes(q);
        const deptMatch = doc.department.toLowerCase().includes(q);

        let rawMatch = false;
        if (doc.documentType === "PO") {
          const po = doc.rawDocument as PurchaseOrder;
          if (po.supplierName?.toLowerCase().includes(q)) rawMatch = true;
        } else if (doc.documentType === "PIS") {
          const pis = doc.rawDocument as PaymentInstructionSlip;
          if (pis.payee?.toLowerCase().includes(q)) rawMatch = true;
        } else if (doc.documentType === "CANVASS") {
          const c = doc.rawDocument as CanvassSheet;
          if (c.supplierName?.toLowerCase().includes(q) || c.recommendedSupplier?.toLowerCase().includes(q)) rawMatch = true;
        }

        if (!numMatch && !reqMatch && !deptMatch && !rawMatch) return false;
      }

      // 4. Date From / Date To
      if (dateFrom) {
        const docTime = new Date(doc.date).getTime();
        const fromTime = new Date(dateFrom).getTime();
        if (!isNaN(docTime) && !isNaN(fromTime) && docTime < fromTime) return false;
      }

      if (dateTo) {
        const docTime = new Date(doc.date).getTime();
        const toTime = new Date(dateTo).getTime();
        if (!isNaN(docTime) && !isNaN(toTime) && docTime > toTime) return false;
      }

      return true;
    });
  }, [unifiedDocuments, activeView, statusTab, searchQuery, dateFrom, dateTo]);

  // User Authority Check
  const canApproveReject = useMemo(() => {
    return currentUser.role !== UserRole.Viewer;
  }, [currentUser]);

  // Derived active selected document
  const activeSelectedDoc = useMemo(() => {
    if (!selectedDocument) return null;
    return (
      unifiedDocuments.find(
        (d) => d.id === selectedDocument.id && d.documentType === selectedDocument.documentType
      ) || null
    );
  }, [selectedDocument, unifiedDocuments]);

  // Selected Document Status Checks
  const isSelectedApproved = useMemo(() => {
    if (!activeSelectedDoc) return false;
    return (
      activeSelectedDoc.approvalStatus === "Approved" ||
      activeSelectedDoc.operationalStatus === "Closed" ||
      activeSelectedDoc.operationalStatus === "Complete" ||
      activeSelectedDoc.operationalStatus === "Released"
    );
  }, [activeSelectedDoc]);

  const canExportSelected = isSelectedApproved;

  // Handlers
  const handleOpenReview = async (doc: UnifiedProcurementDocument) => {
    setReviewDoc(doc);
    setReviewTab("details");
    try {
      await api.logProcurementView(doc.documentType, doc.id);
    } catch (e) {
      // Ignore background log errors
    }
  };

  const handleApprove = async () => {
    if (!approveConfirmDoc) return;
    setActionLoading(true);
    setError(null);
    try {
      const extraData: Record<string, any> = {};
      if (approveConfirmDoc.documentType === "RFS") {
        extraData.dueDate = approveRfsDueDate || new Date().toISOString().split("T")[0];
        extraData.status = approveRfsStatus || "Complete";
      }
      await api.approveProcurementDocument(approveConfirmDoc.documentType, approveConfirmDoc.id, extraData);
      setSuccessMsg(`Successfully approved ${approveConfirmDoc.documentType} ${approveConfirmDoc.documentNumber}.`);
      setApproveConfirmDoc(null);
      if (reviewDoc && reviewDoc.id === approveConfirmDoc.id) {
        setReviewDoc(null);
      }
      await loadData();
    } catch (err: any) {
      console.error("Approval error:", err);
      setError(err.message || "Failed to approve document.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectConfirmDoc) return;
    if (!rejectionReason.trim()) {
      setError("Please specify a reason for rejection.");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await api.rejectProcurementDocument(rejectConfirmDoc.documentType, rejectConfirmDoc.id, rejectionReason.trim());
      setSuccessMsg(`Document ${rejectConfirmDoc.documentNumber} has been rejected.`);
      setRejectConfirmDoc(null);
      setRejectionReason("");
      if (reviewDoc && reviewDoc.id === rejectConfirmDoc.id) {
        setReviewDoc(null);
      }
      await loadData();
    } catch (err: any) {
      console.error("Rejection error:", err);
      setError(err.message || "Failed to reject document.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDocumentExport = async (doc: UnifiedProcurementDocument, format: "excel" | "word") => {
    const isApproved =
      doc.approvalStatus === "Approved" ||
      doc.operationalStatus === "Closed" ||
      doc.operationalStatus === "Complete";

    if (!isApproved) {
      setError(`Cannot export ${doc.documentNumber}: Document must be approved before export.`);
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      if (doc.documentType === "PO") {
        const po = doc.rawDocument as PurchaseOrder;
        if (format === "excel") {
          await exportPOToXLSM(po);
        } else {
          await exportPOToWord(po);
        }
      } else if (doc.documentType === "PIS") {
        const pis = doc.rawDocument as PaymentInstructionSlip;
        const exportData = mapPISData(pis);
        const pisNo = (pis.pisNumber || "PIS").toUpperCase();
        if (format === "excel") {
          await exportExcelWithTemplate("PIS_TEMPLATE.xlsm", exportData, "items", [], `${pisNo}_SMEI_PIS.xlsm`);
        } else {
          await exportWordWithTemplate("PIS_TEMPLATE_WORD.docx", exportData, `${pisNo}_SMEI_PIS.docx`);
        }
      } else if (doc.documentType === "RFS") {
        const rfs = doc.rawDocument as RequestForSupply;
        const { exportData, items } = mapRFSData(rfs);
        const formattedRFS = formatRFSNo(rfs.rfsNumber || rfs.controlNumber, rfs.dateRequested);
        if (format === "excel") {
          await exportExcelWithTemplate("RFS_TEMPLATE.xlsm", exportData, "items", items, `${formattedRFS}_SMEI_RFS.xlsm`);
        } else {
          await exportWordWithTemplate("RFS_TEMPLATE_WORD.docx", { ...exportData, items }, `${formattedRFS}_SMEI_RFS.docx`);
        }
      } else if (doc.documentType === "CANVASS") {
        const canvass = doc.rawDocument as CanvassSheet;
        const { exportData, excelShops, excelItems } = mapCanvassData(canvass);
        const canvNo = (canvass.canvassNumber || "CANVASS").toUpperCase();
        if (format === "excel") {
          await exportExcelWithTemplate(
            "CANVASS_TEMPLATE.xlsx",
            { ...exportData, shops: excelShops },
            "items",
            excelItems,
            `${canvNo}_SMEI_CANVASS.xlsx`
          );
        } else {
          await exportWordWithTemplate("CANVASS_TEMPLATE.docx", exportData, `${canvNo}_SMEI_CANVASS.docx`);
        }
      }

      await api.exportProcurementDocument(doc.documentType, doc.id);
      setSuccessMsg(`${doc.documentType} ${doc.documentNumber} (${format.toUpperCase()}) successfully exported.`);
      setExportConfirmDoc(null);
      await loadData();
    } catch (err: any) {
      console.error("Export error:", err);
      setError(err.message || "Failed to export document template.");
    } finally {
      setActionLoading(false);
    }
  };

  // Status Badge UI Component
  const getStatusBadge = (status: ApprovalStatus, opStatus?: string) => {
    if (opStatus === "Closed" || opStatus === "Complete") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
          <CheckSquare className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" /> Completed
        </span>
      );
    }

    switch (status) {
      case "Approved":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Approved
          </span>
        );
      case "Rejected":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-700/60">
            <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /> Rejected
          </span>
        );
      case "Pending Approval":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 animate-pulse">
            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Pending Approval
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700">
            {status}
          </span>
        );
    }
  };

  const getTypeBadge = (type: "PO" | "PIS" | "RFS" | "CANVASS") => {
    switch (type) {
      case "PO":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Purchase Order
          </span>
        );
      case "PIS":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50">
            <Receipt className="w-3.5 h-3.5" /> PIS
          </span>
        );
      case "RFS":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
            <ClipboardList className="w-3.5 h-3.5" /> RFS
          </span>
        );
      case "CANVASS":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
            <FileText className="w-3.5 h-3.5" /> Canvass Sheet
          </span>
        );
    }
  };

  // Find related documents based on control/PO/RFS numbers
  const getRelatedDocuments = (doc: UnifiedProcurementDocument) => {
    const keyNumber = doc.documentNumber.toLowerCase();
    const ctrlNum = doc.controlNumber?.toLowerCase();

    return unifiedDocuments.filter((d) => {
      if (d.id === doc.id && d.documentType === doc.documentType) return false;

      const otherNum = d.documentNumber.toLowerCase();
      const otherCtrl = d.controlNumber?.toLowerCase();

      if (ctrlNum && (otherNum.includes(ctrlNum) || otherCtrl?.includes(ctrlNum))) return true;
      if (keyNumber && (otherNum.includes(keyNumber) || otherCtrl?.includes(keyNumber))) return true;

      return false;
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-smei-crimson/10 text-smei-crimson rounded-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">
              Procurement Approval
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
              Centralized authorization dashboard for PO, PIS, RFS, and Canvass Sheets
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          {activeView !== "LANDING" && (
            <button
              onClick={() => handleNavigateToQueue("LANDING")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard Entry
            </button>
          )}

          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh Queue
          </button>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-950/50 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/50 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =========================================================================
                                1. LANDING DASHBOARD VIEW
         ========================================================================= */}
      {activeView === "LANDING" && (
        <div className="space-y-6 animate-fade-in">
          {/* Summary Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-neutral-900 to-neutral-800 text-white shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/10 rounded-xl">
                <Clock className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Pending Approvals Queue</h3>
                <p className="text-xs text-neutral-300 mt-0.5">
                  You have <strong className="text-amber-400 font-mono text-sm">{totalGlobalPending}</strong> procurement documents awaiting sign-off across all workflows.
                </p>
              </div>
            </div>
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Action Needed
            </span>
          </div>

          {/* 4 ENTRY CARDS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CARD 1: PURCHASE ORDER APPROVAL */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5">
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                    <FileSpreadsheet className="w-7 h-7" />
                  </div>
                  {docTypeStats.PO.pending > 0 && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700 animate-pulse">
                      {docTypeStats.PO.pending} Pending
                    </span>
                  )}
                </div>

                <h2 className="text-xl font-bold text-neutral-900 dark:text-white mt-4">
                  Purchase Order Approval
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Review and authorize official PO supplier commitments, VAT calculations, and pricing details.
                </p>

                {/* Counts Breakdown */}
                <div className="grid grid-cols-4 gap-2 mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-800/80">
                  <div className="text-center p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/50">
                    <div className="text-[10px] uppercase font-bold text-neutral-400">Pending</div>
                    <div className="text-base font-bold text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                      {docTypeStats.PO.pending}
                    </div>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/50">
                    <div className="text-[10px] uppercase font-bold text-neutral-400">Approved</div>
                    <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                      {docTypeStats.PO.approved}
                    </div>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/50">
                    <div className="text-[10px] uppercase font-bold text-neutral-400">Rejected</div>
                    <div className="text-base font-bold text-rose-600 dark:text-rose-400 font-mono mt-0.5">
                      {docTypeStats.PO.rejected}
                    </div>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/50">
                    <div className="text-[10px] uppercase font-bold text-neutral-400">Total</div>
                    <div className="text-base font-bold text-neutral-800 dark:text-neutral-200 font-mono mt-0.5">
                      {docTypeStats.PO.total}
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleNavigateToQueue("PO")}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-2 group"
              >
                Open Purchase Order Approval Queue
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* CARD 2: PIS APPROVAL */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5">
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                    <Receipt className="w-7 h-7" />
                  </div>
                  {docTypeStats.PIS.pending > 0 && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700 animate-pulse">
                      {docTypeStats.PIS.pending} Pending
                    </span>
                  )}
                </div>

                <h2 className="text-xl font-bold text-neutral-900 dark:text-white mt-4">
                  PIS Approval
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Authorize Payment Instruction Slips, payment schedule dates, payee accounts, and payment modes.
                </p>

                {/* Counts Breakdown */}
                <div className="grid grid-cols-4 gap-2 mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-800/80">
                  <div className="text-center p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/50">
                    <div className="text-[10px] uppercase font-bold text-neutral-400">Pending</div>
                    <div className="text-base font-bold text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                      {docTypeStats.PIS.pending}
                    </div>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/50">
                    <div className="text-[10px] uppercase font-bold text-neutral-400">Approved</div>
                    <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                      {docTypeStats.PIS.approved}
                    </div>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/50">
                    <div className="text-[10px] uppercase font-bold text-neutral-400">Rejected</div>
                    <div className="text-base font-bold text-rose-600 dark:text-rose-400 font-mono mt-0.5">
                      {docTypeStats.PIS.rejected}
                    </div>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/50">
                    <div className="text-[10px] uppercase font-bold text-neutral-400">Total</div>
                    <div className="text-base font-bold text-neutral-800 dark:text-neutral-200 font-mono mt-0.5">
                      {docTypeStats.PIS.total}
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleNavigateToQueue("PIS")}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-2 group"
              >
                Open PIS Approval Queue
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* CARD 3: RFS APPROVAL */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5">
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                    <ClipboardList className="w-7 h-7" />
                  </div>
                  {docTypeStats.RFS.pending > 0 && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700 animate-pulse">
                      {docTypeStats.RFS.pending} Pending
                    </span>
                  )}
                </div>

                <h2 className="text-xl font-bold text-neutral-900 dark:text-white mt-4">
                  RFS Approval
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Review departmental Request for Supply applications, emergency material requirements, and item line specifications.
                </p>

                {/* Counts Breakdown */}
                <div className="grid grid-cols-4 gap-2 mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-800/80">
                  <div className="text-center p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/50">
                    <div className="text-[10px] uppercase font-bold text-neutral-400">Pending</div>
                    <div className="text-base font-bold text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                      {docTypeStats.RFS.pending}
                    </div>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/50">
                    <div className="text-[10px] uppercase font-bold text-neutral-400">Approved</div>
                    <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                      {docTypeStats.RFS.approved}
                    </div>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/50">
                    <div className="text-[10px] uppercase font-bold text-neutral-400">Rejected</div>
                    <div className="text-base font-bold text-rose-600 dark:text-rose-400 font-mono mt-0.5">
                      {docTypeStats.RFS.rejected}
                    </div>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/50">
                    <div className="text-[10px] uppercase font-bold text-neutral-400">Total</div>
                    <div className="text-base font-bold text-neutral-800 dark:text-neutral-200 font-mono mt-0.5">
                      {docTypeStats.RFS.total}
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleNavigateToQueue("RFS")}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-2 group"
              >
                Open RFS Approval Queue
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* CARD 4: CANVASS SHEET APPROVAL */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5">
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                    <FileText className="w-7 h-7" />
                  </div>
                  {docTypeStats.CANVASS.pending > 0 && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700 animate-pulse">
                      {docTypeStats.CANVASS.pending} Pending
                    </span>
                  )}
                </div>

                <h2 className="text-xl font-bold text-neutral-900 dark:text-white mt-4">
                  Canvass Sheet Approval
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Evaluate supplier quotations, price comparisons, warranty terms, and recommended vendors.
                </p>

                {/* Counts Breakdown */}
                <div className="grid grid-cols-4 gap-2 mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-800/80">
                  <div className="text-center p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/50">
                    <div className="text-[10px] uppercase font-bold text-neutral-400">Pending</div>
                    <div className="text-base font-bold text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                      {docTypeStats.CANVASS.pending}
                    </div>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/50">
                    <div className="text-[10px] uppercase font-bold text-neutral-400">Approved</div>
                    <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                      {docTypeStats.CANVASS.approved}
                    </div>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/50">
                    <div className="text-[10px] uppercase font-bold text-neutral-400">Rejected</div>
                    <div className="text-base font-bold text-rose-600 dark:text-rose-400 font-mono mt-0.5">
                      {docTypeStats.CANVASS.rejected}
                    </div>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/50">
                    <div className="text-[10px] uppercase font-bold text-neutral-400">Total</div>
                    <div className="text-base font-bold text-neutral-800 dark:text-neutral-200 font-mono mt-0.5">
                      {docTypeStats.CANVASS.total}
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleNavigateToQueue("CANVASS")}
                className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-2 group"
              >
                Open Canvass Sheet Approval Queue
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
                          2. DOCUMENT-SPECIFIC APPROVAL DIRECTORY
         ========================================================================= */}
      {activeView !== "LANDING" && (
        <div id="smei-procurement-approval" className="p-4 md:p-6 space-y-4 max-w-[130rem] mx-auto w-full">
          {/* Upper Action Bar Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white tracking-tight font-display">
                {activeView === "PO"
                  ? "Purchase Orders Directory"
                  : activeView === "PIS"
                  ? "Payment Instruction Slips Directory"
                  : activeView === "RFS"
                  ? "Request for Supply Directory"
                  : "Canvass Sheets Directory"}
              </h2>
              <p className="text-xs md:text-sm text-gray-500 dark:text-neutral-400 mt-0.5">
                Review, approve, reject, or export compliance-validated Cavite EPZA procurement sheets
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full lg:w-auto lg:justify-end">
              {/* Selected Badge */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-gray-500 uppercase font-mono tracking-wider">SELECTED:</span>
                <span className="text-[11px] font-bold font-mono text-smei-crimson bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 px-2.5 py-1 rounded-md">
                  {activeSelectedDoc ? activeSelectedDoc.documentNumber : "NONE"}
                </span>
              </div>

              {/* Quick Document Switcher Pills */}
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-neutral-800 p-1 rounded-lg shrink-0">
                {(["PO", "PIS", "RFS", "CANVASS"] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => handleNavigateToQueue(mode)}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                      activeView === mode
                        ? "bg-smei-crimson text-white shadow-xs"
                        : "text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {/* Centralized Export & Note/Sign Action Buttons based on activeView (Rule 6) */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {/* PO: Excel + Word + Note/Sign */}
                {activeView === "PO" && (
                  <>
                    <button
                      onClick={() => activeSelectedDoc && handleDocumentExport(activeSelectedDoc, "excel")}
                      disabled={!canExportSelected || actionLoading}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold h-[38px] px-3.5 rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-all whitespace-nowrap cursor-pointer"
                      title={!activeSelectedDoc ? "Select a document from the table first" : !canExportSelected ? "Document must be approved before export" : "Export Excel Template"}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Excel</span>
                    </button>
                    <button
                      onClick={() => activeSelectedDoc && handleDocumentExport(activeSelectedDoc, "word")}
                      disabled={!canExportSelected || actionLoading}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold h-[38px] px-3.5 rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-all whitespace-nowrap cursor-pointer"
                      title={!activeSelectedDoc ? "Select a document from the table first" : !canExportSelected ? "Document must be approved before export" : "Export Word Template"}
                    >
                      <FileText className="w-4 h-4" />
                      <span>Word</span>
                    </button>
                  </>
                )}

                {/* PIS: Excel + Note/Sign (Word Removed per Rule 6) */}
                {activeView === "PIS" && (
                  <button
                    onClick={() => activeSelectedDoc && handleDocumentExport(activeSelectedDoc, "excel")}
                    disabled={!canExportSelected || actionLoading}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold h-[38px] px-3.5 rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-all whitespace-nowrap cursor-pointer"
                    title={!activeSelectedDoc ? "Select a document from the table first" : !canExportSelected ? "Document must be approved before export" : "Export Excel Template"}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Excel</span>
                  </button>
                )}

                {/* RFS: Excel + Note/Sign (Word Removed per Rule 6) */}
                {activeView === "RFS" && (
                  <button
                    onClick={() => activeSelectedDoc && handleDocumentExport(activeSelectedDoc, "excel")}
                    disabled={!canExportSelected || actionLoading}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold h-[38px] px-3.5 rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-all whitespace-nowrap cursor-pointer"
                    title={!activeSelectedDoc ? "Select a document from the table first" : !canExportSelected ? "Document must be approved before export" : "Export Excel Template"}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Excel</span>
                  </button>
                )}

                {/* CANVASS: Word + Note/Sign (Excel Removed per Rule 6) */}
                {activeView === "CANVASS" && (
                  <button
                    onClick={() => activeSelectedDoc && handleDocumentExport(activeSelectedDoc, "word")}
                    disabled={!canExportSelected || actionLoading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold h-[38px] px-3.5 rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-all whitespace-nowrap cursor-pointer"
                    title={!activeSelectedDoc ? "Select a document from the table first" : !canExportSelected ? "Document must be approved before export" : "Export Word Template"}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Word</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Advanced Searching & Filters Board (Card Container from Old UI) */}
          <div className="bg-white dark:bg-neutral-900 p-3 rounded-xl border border-gray-100 dark:border-neutral-800 shadow-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {/* Search Keywords */}
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider block">
                  Search Keywords
                </label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="PO#, supplier..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-7.5 pr-2 py-1.5 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent focus:bg-white dark:focus:bg-neutral-800 transition-all text-gray-700 dark:text-neutral-200"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider block">
                  Status
                </label>
                <div className="relative">
                  <Filter className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <select
                    value={statusTab}
                    onChange={(e) => setStatusTab(e.target.value)}
                    className="w-full pl-7.5 pr-2 py-1.5 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent focus:bg-white dark:focus:bg-neutral-800 transition-all text-gray-700 dark:text-neutral-200 appearance-none"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="Pending Approval">Pending Approval</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              {/* Date From */}
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider block">
                  Date From
                </label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full pl-7.5 pr-2 py-1.5 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent focus:bg-white dark:focus:bg-neutral-800 transition-all text-gray-700 dark:text-neutral-200 font-mono"
                  />
                </div>
              </div>

              {/* Date To */}
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider block">
                  Date To
                </label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full pl-7.5 pr-2 py-1.5 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent focus:bg-white dark:focus:bg-neutral-800 transition-all text-gray-700 dark:text-neutral-200 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* List Table Container (Old UI Design System) */}
          <div className="flex-1 bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table id="smei-procurement-table" className="w-full text-left border-collapse min-w-[700px]">
                <thead className="sticky top-0 bg-gray-50 dark:bg-neutral-800/80 z-10 shadow-sm">
                  <tr className="text-gray-500 dark:text-neutral-400 text-xs uppercase tracking-wider font-semibold border-b border-gray-100 dark:border-neutral-800">
                    <th className="py-3.5 px-6 font-display whitespace-nowrap">PO Number</th>
                    <th className="py-3.5 px-6 font-display whitespace-nowrap">Supplier</th>
                    <th className="py-3.5 px-6 font-display whitespace-nowrap">Purchase Category</th>
                    <th className="py-3.5 px-6 font-display whitespace-nowrap">Creation Date</th>
                    <th className="py-3.5 px-6 font-display text-right whitespace-nowrap">Gross Total Amount</th>
                    <th className="py-3.5 px-6 font-display whitespace-nowrap">Workflow Status</th>
                    <th className="py-3.5 px-6 font-display whitespace-nowrap">Prepared By</th>
                    <th className="py-3.5 px-6 font-display text-center whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800 text-xs font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-400 font-sans">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-smei-crimson mb-2" />
                        <span>Synchronizing {activeView} procurement records...</span>
                      </td>
                    </tr>
                  ) : currentViewDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-400 font-sans">
                        No {activeView} documents match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    currentViewDocuments.map((doc, index) => {
                      const isSelected = activeSelectedDoc?.id === doc.id && activeSelectedDoc?.documentType === doc.documentType;

                      return (
                        <tr
                          key={`${doc.documentType}_${doc.id}`}
                          onClick={() => setSelectedDocument(doc)}
                          onDoubleClick={() => {
                            setSelectedDocument(doc);
                            handleOpenReview(doc);
                          }}
                          title="Click to select document. Double-click to open review & approval details."
                          className={`cursor-pointer transition-all group ${
                            isSelected
                              ? "bg-red-600/20 dark:bg-red-950/40 border-l-4 border-l-smei-crimson font-medium"
                              : index % 2 === 1
                              ? "bg-gray-50/45 dark:bg-neutral-800/30 hover:bg-red-600/10"
                              : "bg-white dark:bg-neutral-900 hover:bg-red-600/10"
                          }`}
                        >
                          {/* PO Number / Document Number */}
                          <td className="py-4 px-6 font-mono font-bold text-smei-crimson">
                            <div className="flex items-center gap-2">
                              {isSelected && (
                                <div className="w-1.5 h-1.5 bg-smei-crimson rounded-full animate-pulse shrink-0" />
                              )}
                              <span>{doc.documentNumber}</span>
                            </div>
                          </td>

                          {/* Supplier / Payee / Requester */}
                          <td className="py-4 px-6 font-medium text-gray-800 dark:text-neutral-200 max-w-xs truncate">
                            {doc.requestedBy}
                          </td>

                          {/* Purchase Category / Dept */}
                          <td className="py-4 px-6">
                            <span className="bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-300 px-2 py-0.5 rounded font-mono font-semibold uppercase tracking-wide text-[10px]">
                              {doc.department || "VATABLE"}
                            </span>
                          </td>

                          {/* Creation Date */}
                          <td className="py-4 px-6 text-gray-500 dark:text-neutral-400 font-mono">
                            {doc.date}
                          </td>

                          {/* Gross Total Amount */}
                          <td className="py-4 px-6 text-right font-mono font-bold text-gray-800 dark:text-white">
                            {doc.amount !== null
                              ? new Intl.NumberFormat("en-PH", {
                                  style: "currency",
                                  currency: "PHP",
                                  minimumFractionDigits: 2
                                }).format(doc.amount)
                              : "-"}
                          </td>

                          {/* Workflow Status */}
                          <td className="py-4 px-6">
                            {doc.approvalStatus === "Approved" || doc.operationalStatus === "Closed" || doc.operationalStatus === "Complete" ? (
                              <span className="inline-flex px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border bg-green-50 text-green-700 border-green-200 dark:bg-green-950/60 dark:text-green-300 dark:border-green-800">
                                APPROVED
                              </span>
                            ) : doc.approvalStatus === "Rejected" ? (
                              <span className="inline-flex px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800">
                                REJECTED
                              </span>
                            ) : (
                              <span className="inline-flex px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/60 dark:text-yellow-300 dark:border-yellow-800">
                                PENDING APPROVAL
                              </span>
                            )}
                          </td>

                          {/* Prepared By / Submitted By */}
                          <td className="py-4 px-6 text-gray-600 dark:text-neutral-300 font-medium">
                            {doc.submittedBy || doc.requestedBy}
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedDocument(doc);
                                  handleOpenReview(doc);
                                }}
                                className="p-1.5 hover:bg-red-50 hover:text-smei-crimson text-gray-400 rounded-lg transition-all"
                                title="Review Document"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {canApproveReject && doc.approvalStatus === "Pending Approval" && (
                                <>
                                  <button
                                    onClick={() => {
                                      setSelectedDocument(doc);
                                      openApproveModal(doc);
                                    }}
                                    className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-2xs transition-colors"
                                    title="Approve Document"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedDocument(doc);
                                      setRejectConfirmDoc(doc);
                                      setRejectionReason("");
                                    }}
                                    className="px-2 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shadow-2xs transition-colors"
                                    title="Reject Document"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
                          3. REVIEW DOCUMENT MODAL
         ========================================================================= */}
      {reviewDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/40">
              <div className="flex items-center gap-3">
                {getTypeBadge(reviewDoc.documentType)}
                <div>
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white font-mono flex items-center gap-2">
                    {reviewDoc.documentNumber}
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Requested by <span className="font-medium text-neutral-800 dark:text-neutral-200">{reviewDoc.requestedBy}</span> ({reviewDoc.department})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {getStatusBadge(reviewDoc.approvalStatus, reviewDoc.operationalStatus)}
                <button
                  onClick={() => setReviewDoc(null)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-x-auto shrink-0">
              <div className="px-4 sm:px-6 flex gap-4 sm:gap-6 min-w-max">
                <button
                  type="button"
                  onClick={() => setReviewTab("details")}
                  className={`py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer select-none ${
                    reviewTab === "details"
                      ? "border-smei-crimson text-smei-crimson dark:border-red-500 dark:text-red-400"
                      : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
                  }`}
                >
                  <FileText className="w-4 h-4" /> Document Details
                </button>
                <button
                  type="button"
                  onClick={() => setReviewTab("history")}
                  className={`py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer select-none ${
                    reviewTab === "history"
                      ? "border-smei-crimson text-smei-crimson dark:border-red-500 dark:text-red-400"
                      : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
                  }`}
                >
                  <History className="w-4 h-4" /> Approval Audit Log ({reviewDoc.approvalHistory?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewTab("signatures")}
                  className={`py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer select-none ${
                    reviewTab === "signatures"
                      ? "border-smei-crimson text-smei-crimson dark:border-red-500 dark:text-red-400"
                      : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
                  }`}
                >
                  <PenTool className="w-4 h-4" /> Notes & Signatures ({reviewDoc.signatureHistory?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewTab("related")}
                  className={`py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer select-none ${
                    reviewTab === "related"
                      ? "border-smei-crimson text-smei-crimson dark:border-red-500 dark:text-red-400"
                      : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
                  }`}
                >
                  <Link className="w-4 h-4" /> Related Documents
                </button>
              </div>
            </div>

            {/* Modal Body Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* TAB 1: DETAILS */}
              {reviewTab === "details" && (
                <div>
                  {reviewDoc.documentType === "PO" && (
                    <PODetailsView po={reviewDoc.rawDocument as PurchaseOrder} />
                  )}
                  {reviewDoc.documentType === "PIS" && (
                    <PISDetailsView pis={reviewDoc.rawDocument as PaymentInstructionSlip} />
                  )}
                  {reviewDoc.documentType === "RFS" && (
                    <RFSDetailsView rfs={reviewDoc.rawDocument as RequestForSupply} />
                  )}
                  {reviewDoc.documentType === "CANVASS" && (
                    <CanvassDetailsView canvass={reviewDoc.rawDocument as CanvassSheet} />
                  )}
                </div>
              )}

              {/* TAB 2: APPROVAL AUDIT HISTORY */}
              {reviewTab === "history" && (
                <div className="space-y-4">
                  {(!reviewDoc.approvalHistory || reviewDoc.approvalHistory.length === 0) ? (
                    <div className="p-8 text-center text-neutral-400 italic">
                      No approval log history recorded for this document yet.
                    </div>
                  ) : (
                    <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-neutral-200 dark:before:bg-neutral-800">
                      {reviewDoc.approvalHistory.map((entry, idx) => (
                        <div key={entry.id || idx} className="flex gap-4 relative">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 z-10 font-bold text-white text-[10px] ${
                              entry.action === "Approved"
                                ? "bg-emerald-600"
                                : entry.action === "Rejected"
                                ? "bg-rose-600"
                                : entry.action === "EXPORTED"
                                ? "bg-purple-600"
                                : "bg-blue-600"
                            }`}
                          >
                            {entry.action === "Approved" ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : entry.action === "Rejected" ? (
                              <X className="w-3.5 h-3.5" />
                            ) : entry.action === "EXPORTED" ? (
                              <Download className="w-3.5 h-3.5" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div className="bg-neutral-50 dark:bg-neutral-800/50 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700/80 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-neutral-900 dark:text-white">
                                {entry.performedByName} ({entry.performedByRole || "User"})
                              </span>
                              <span className="text-[10px] text-neutral-400 font-mono">
                                {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : "-"}
                              </span>
                            </div>
                            <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mt-1">
                              Action: <span className="font-bold uppercase tracking-wider">{entry.action}</span>
                            </div>
                            {entry.reason && (
                              <div className="mt-2 p-2 rounded bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                                <strong>Reason:</strong> {entry.reason}
                              </div>
                            )}
                            {entry.note && (
                              <div className="mt-2 p-2 rounded bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900">
                                <strong>Note:</strong> {entry.note}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: NOTES & SIGNATURES */}
              {reviewTab === "signatures" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-neutral-900 dark:text-white text-sm">
                      Attached Notes & Signatures
                    </h4>
                  </div>

                  {(!reviewDoc.signatureHistory || reviewDoc.signatureHistory.length === 0) ? (
                    <div className="p-8 text-center text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
                      No additional signatures or post-export notes recorded yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {reviewDoc.signatureHistory.map((sig, idx) => (
                        <div
                          key={sig.id || idx}
                          className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/80 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-neutral-400" />
                              {sig.userName} ({sig.position || "Staff"})
                            </span>
                            <span className="text-[10px] text-neutral-400 font-mono">
                              {new Date(sig.signedAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-700 dark:text-neutral-300 italic bg-white dark:bg-neutral-900 p-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800">
                            "{sig.note}"
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: RELATED DOCUMENTS */}
              {reviewTab === "related" && (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-800 dark:text-blue-300 flex items-start gap-2">
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-xs font-bold">Document Isolation Policy</strong>
                      Each procurement document maintains an independent lifecycle. Approving one document does NOT automatically approve related items.
                    </div>
                  </div>

                  {(() => {
                    const related = getRelatedDocuments(reviewDoc);
                    if (related.length === 0) {
                      return (
                        <div className="p-8 text-center text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
                          No related documents found matching control/PO reference numbers.
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2">
                        {related.map((rel) => (
                          <div
                            key={`${rel.documentType}_${rel.id}`}
                            className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700/80 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              {getTypeBadge(rel.documentType)}
                              <div>
                                <div className="font-mono font-bold text-neutral-900 dark:text-white">
                                  {rel.documentNumber}
                                </div>
                                <div className="text-[11px] text-neutral-500">
                                  Requester: {rel.requestedBy}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {getStatusBadge(rel.approvalStatus)}
                              <button
                                onClick={() => handleOpenReview(rel)}
                                className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800"
                              >
                                View
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 flex items-center justify-between gap-3">
              <button
                onClick={() => setReviewDoc(null)}
                className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-xs font-semibold transition-colors"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {/* Approve/Reject if pending */}
                {canApproveReject && reviewDoc.approvalStatus === "Pending Approval" && (
                  <>
                    <button
                      onClick={() => {
                        setRejectConfirmDoc(reviewDoc);
                        setRejectionReason("");
                      }}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                    >
                      <X className="w-4 h-4" /> Reject Document
                    </button>
                    <button
                      onClick={() => openApproveModal(reviewDoc)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" /> Approve Document
                    </button>
                  </>
                )}

                {/* Export buttons */}
                {(reviewDoc.approvalStatus === "Approved" || reviewDoc.operationalStatus === "Closed" || reviewDoc.operationalStatus === "Complete") ? (
                  <div className="flex items-center gap-2">
                    {(reviewDoc.documentType === "PO" || reviewDoc.documentType === "PIS" || reviewDoc.documentType === "RFS") && (
                      <button
                        type="button"
                        onClick={() => handleDocumentExport(reviewDoc, "excel")}
                        disabled={actionLoading}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Export Excel
                      </button>
                    )}
                    {(reviewDoc.documentType === "PO" || reviewDoc.documentType === "CANVASS") && (
                      <button
                        type="button"
                        onClick={() => handleDocumentExport(reviewDoc, "word")}
                        disabled={actionLoading}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Export Word
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* APPROVE CONFIRMATION MODAL */}
      {approveConfirmDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Confirm Approval</h3>
            </div>

            <p className="text-xs text-neutral-600 dark:text-neutral-300">
              Are you sure you want to approve <strong className="font-mono text-neutral-900 dark:text-white">{approveConfirmDoc.documentType} ({approveConfirmDoc.documentNumber})</strong>?
            </p>

            <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-xl border border-neutral-200 dark:border-neutral-700/80 text-xs space-y-1">
              <div><strong>Requester:</strong> {approveConfirmDoc.requestedBy}</div>
              <div><strong>Department:</strong> {approveConfirmDoc.department}</div>
              {approveConfirmDoc.amount !== null && (
                <div><strong>Amount:</strong> ₱{approveConfirmDoc.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</div>
              )}
            </div>

            {approveConfirmDoc.documentType === "RFS" && (
              <div className="space-y-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">
                  RFS Parameters
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Due Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={approveRfsDueDate}
                    onChange={(e) => setApproveRfsDueDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    RFS Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={approveRfsStatus}
                    onChange={(e) => setApproveRfsStatus(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Complete">Complete</option>
                    <option value="On Time">On Time</option>
                    <option value="Late">Late</option>
                    <option value="Incomplete">Incomplete</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setApproveConfirmDoc(null)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-2"
              >
                {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL WITH REASON */}
      {rejectConfirmDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 rounded-xl">
                <XCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Reject Document</h3>
            </div>

            <p className="text-xs text-neutral-600 dark:text-neutral-300">
              Please provide a clear reason for rejecting <strong className="font-mono text-neutral-900 dark:text-white">{rejectConfirmDoc.documentType} ({rejectConfirmDoc.documentNumber})</strong>.
            </p>

            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter detailed reason for returning or rejecting this document..."
                rows={3}
                className="w-full p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-white focus:ring-2 focus:ring-rose-500/30 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setRejectConfirmDoc(null);
                  setRejectionReason("");
                }}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectionReason.trim()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-2"
              >
                {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Security PIN verification modal for switching approval queues */}
      {pendingTargetView && (
        <SecurityPINModal
          moduleName={viewToGateKey(pendingTargetView)}
          currentUser={currentUser}
          onSuccess={() => {
            const target = pendingTargetView;
            setVerifiedApprovalModules((prev) => ({
              ...prev,
              [target]: true,
            }));
            setActiveView(target);
            setStatusTab("ALL");
            setSelectedDocument(null);
            setPendingTargetView(null);
          }}
          onClose={() => {
            setPendingTargetView(null);
          }}
        />
      )}
    </div>
  );
};

// ---------------- SUB-COMPONENT DETAILS RENDERERS ----------------

const PODetailsView: React.FC<{ po: PurchaseOrder }> = ({ po }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-200 dark:border-neutral-700/80">
      <div>
        <span className="text-[10px] text-neutral-400 uppercase font-bold block">PO Date</span>
        <span className="font-semibold text-neutral-800 dark:text-neutral-200 font-mono">{po.poDate || "-"}</span>
      </div>
      <div>
        <span className="text-[10px] text-neutral-400 uppercase font-bold block">Supplier</span>
        <span className="font-semibold text-neutral-800 dark:text-neutral-200">{po.supplierName || "-"}</span>
      </div>
      <div>
        <span className="text-[10px] text-neutral-400 uppercase font-bold block">Payment Terms</span>
        <span className="font-semibold text-neutral-800 dark:text-neutral-200">{po.paymentTerms || "-"}</span>
      </div>
      <div>
        <span className="text-[10px] text-neutral-400 uppercase font-bold block">Prepared By</span>
        <span className="font-semibold text-neutral-800 dark:text-neutral-200">{po.preparedBy || "-"}</span>
      </div>
      <div>
        <span className="text-[10px] text-neutral-400 uppercase font-bold block">Approved By</span>
        <span className="font-semibold text-neutral-800 dark:text-neutral-200">{po.approvedBy || "-"}</span>
      </div>
      <div>
        <span className="text-[10px] text-neutral-400 uppercase font-bold block">Tax Category</span>
        <span className="font-semibold text-neutral-800 dark:text-neutral-200">{po.category || "Vatable"}</span>
      </div>
    </div>

    {/* Line Items */}
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
      <div className="bg-neutral-100 dark:bg-neutral-800 px-4 py-2 font-bold text-neutral-700 dark:text-neutral-300 text-xs">
        Line Items ({po.items?.length || 0})
      </div>
      <table className="w-full text-left">
        <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-[10px] font-bold text-neutral-500 uppercase border-b border-neutral-200 dark:border-neutral-800">
          <tr>
            <th className="p-2.5 pl-4">Description</th>
            <th className="p-2.5 text-center">Qty</th>
            <th className="p-2.5 text-center">Unit</th>
            <th className="p-2.5 text-right">Unit Price</th>
            <th className="p-2.5 text-right pr-4">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {po.items?.map((item, i) => (
            <tr key={i}>
              <td className="p-2.5 pl-4 font-medium">{item.description}</td>
              <td className="p-2.5 text-center font-mono">{item.quantity}</td>
              <td className="p-2.5 text-center">{item.unit}</td>
              <td className="p-2.5 text-right font-mono">₱{Number(item.unitPrice).toFixed(2)}</td>
              <td className="p-2.5 text-right pr-4 font-bold font-mono">₱{Number(item.amount).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const PISDetailsView: React.FC<{ pis: PaymentInstructionSlip }> = ({ pis }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-200 dark:border-neutral-700/80">
      <div>
        <span className="text-[10px] text-neutral-400 uppercase font-bold block">Payee</span>
        <span className="font-semibold text-neutral-800 dark:text-neutral-200">{pis.payee || "-"}</span>
      </div>
      <div>
        <span className="text-[10px] text-neutral-400 uppercase font-bold block">Schedule Date</span>
        <span className="font-semibold text-neutral-800 dark:text-neutral-200 font-mono">{pis.scheduleDate || "-"} {pis.scheduleTime || ""}</span>
      </div>
      <div>
        <span className="text-[10px] text-neutral-400 uppercase font-bold block">Total Amount</span>
        <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">₱{Number(pis.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
      </div>
      <div>
        <span className="text-[10px] text-neutral-400 uppercase font-bold block">Payment Mode</span>
        <span className="font-semibold text-neutral-800 dark:text-neutral-200">{pis.paymentMode || "-"}</span>
      </div>
      <div>
        <span className="text-[10px] text-neutral-400 uppercase font-bold block">Currency</span>
        <span className="font-semibold text-neutral-800 dark:text-neutral-200">{pis.currency || "PHP"}</span>
      </div>
      <div>
        <span className="text-[10px] text-neutral-400 uppercase font-bold block">Requested By</span>
        <span className="font-semibold text-neutral-800 dark:text-neutral-200">{pis.requestedBy || "-"}</span>
      </div>
    </div>

    {/* Payments Breakdown List */}
    {pis.payments && pis.payments.length > 0 && (
      <div className="space-y-2">
        <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">Payment Breakdown Details:</span>
        <div className="space-y-2">
          {pis.payments.map((p, idx) => (
            <div key={p.id || idx} className="p-3 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-200 dark:border-neutral-700/80 space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-[10px] font-mono text-neutral-400 font-bold">
                <span>ENTRY #{idx + 1}</span>
                {(p.completedPONumber || p.poNumber) && (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 rounded font-semibold border border-emerald-200 dark:border-emerald-800">
                    PO REF: {(p.completedPONumber || p.poNumber)?.toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 uppercase font-bold block">Payment Purpose</span>
                <p className="font-medium text-neutral-800 dark:text-neutral-200">{p.paymentPurpose || "-"}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-neutral-200/50 dark:border-neutral-700/50 font-mono text-[11px]">
                <div>
                  <span className="text-[9px] text-neutral-400 block font-sans">Gross:</span>
                  <span>₱{Number(p.gross || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                </div>
                <div>
                  <span className="text-[9px] text-neutral-400 block font-sans">EWT:</span>
                  <span>₱{Number(p.ewt || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                </div>
                <div>
                  <span className="text-[9px] text-neutral-400 block font-sans">Net Total:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">₱{Number(p.total || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    {pis.remarks && (
      <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-200 dark:border-neutral-700/80">
        <span className="text-[10px] text-neutral-400 uppercase font-bold block">Remarks</span>
        <p className="text-neutral-800 dark:text-neutral-200 mt-1 text-xs">{pis.remarks}</p>
      </div>
    )}
  </div>
);

const RFSDetailsView: React.FC<{ rfs: RequestForSupply }> = ({ rfs }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-200 dark:border-neutral-700/80">
      <div>
        <span className="text-[10px] text-neutral-400 uppercase font-bold block">Date Requested</span>
        <span className="font-semibold text-neutral-800 dark:text-neutral-200 font-mono">{rfs.dateRequested || "-"}</span>
      </div>
      <div>
        <span className="text-[10px] text-neutral-400 uppercase font-bold block">Due Date</span>
        <span className="font-semibold text-neutral-800 dark:text-neutral-200 font-mono">{rfs.dueDate || "-"}</span>
      </div>
      <div>
        <span className="text-[10px] text-neutral-400 uppercase font-bold block">Department</span>
        <span className="font-semibold text-neutral-800 dark:text-neutral-200">{rfs.department || "-"}</span>
      </div>
      <div>
        <span className="text-[10px] text-neutral-400 uppercase font-bold block">Control No.</span>
        <span className="font-semibold text-neutral-800 dark:text-neutral-200 font-mono">{rfs.controlNumber || "-"}</span>
      </div>
      <div>
        <span className="text-[10px] text-neutral-400 uppercase font-bold block">Mode of Request</span>
        <span className="font-semibold text-neutral-800 dark:text-neutral-200">{rfs.modeOfRequest || "-"}</span>
      </div>
      <div>
        <span className="text-[10px] text-neutral-400 uppercase font-bold block">Associated PO</span>
        <span className="font-semibold text-neutral-800 dark:text-neutral-200 font-mono">{rfs.purchaseOrderNumber || "None"}</span>
      </div>
    </div>

    {rfs.purpose && (
      <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-200 dark:border-neutral-700/80">
        <span className="text-[10px] text-neutral-400 uppercase font-bold block">Purpose</span>
        <p className="text-neutral-800 dark:text-neutral-200 mt-1">{rfs.purpose}</p>
      </div>
    )}

    {/* RFS Items Table */}
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
      <div className="bg-neutral-100 dark:bg-neutral-800 px-4 py-2 font-bold text-neutral-700 dark:text-neutral-300 text-xs">
        Requested Items ({rfs.items?.length || 0})
      </div>
      <table className="w-full text-left">
        <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-[10px] font-bold text-neutral-500 uppercase border-b border-neutral-200 dark:border-neutral-800">
          <tr>
            <th className="p-2.5 pl-4">Description</th>
            <th className="p-2.5 text-center">Qty</th>
            <th className="p-2.5 text-center">Unit</th>
            <th className="p-2.5">Remarks</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {rfs.items?.map((item, i) => (
            <tr key={i}>
              <td className="p-2.5 pl-4 font-medium">{item.description}</td>
              <td className="p-2.5 text-center font-mono">{item.quantity}</td>
              <td className="p-2.5 text-center">{item.unit}</td>
              <td className="p-2.5 text-neutral-500">{item.remarks || "-"}</td>
            </tr>
          ))}
          {rfs.addNothingFollows && (
            <tr className="bg-neutral-50/50 dark:bg-neutral-800/20 italic">
              <td className="p-2.5 pl-4 font-semibold italic text-neutral-500 dark:text-neutral-400">*****NOTHING FOLLOWS*****</td>
              <td className="p-2.5 text-center font-mono text-neutral-400">-</td>
              <td className="p-2.5 text-center text-neutral-400">-</td>
              <td className="p-2.5 text-neutral-400">-</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const CanvassDetailsView: React.FC<{ canvass: CanvassSheet }> = ({ canvass }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-200 dark:border-neutral-700/80">
      <div>
        <span className="text-[10px] text-neutral-400 uppercase font-bold block">Canvass Date</span>
        <span className="font-semibold text-neutral-800 dark:text-neutral-200 font-mono">{canvass.canvassDate || "-"}</span>
      </div>
      <div>
        <span className="text-[10px] text-neutral-400 uppercase font-bold block">Recommended Supplier</span>
        <span className="font-bold text-emerald-600 dark:text-emerald-400">{canvass.recommendedSupplier || "-"}</span>
      </div>
      <div>
        <span className="text-[10px] text-neutral-400 uppercase font-bold block">Lowest Price / Total</span>
        <span className="font-bold text-neutral-900 dark:text-white font-mono">
          ₱{Number(canvass.totalCost || canvass.lowestPrice || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
        </span>
      </div>
      <div>
        <span className="text-[10px] text-neutral-400 uppercase font-bold block">Contact Person</span>
        <span className="font-semibold text-neutral-800 dark:text-neutral-200">{canvass.contactPerson || "-"}</span>
      </div>
      <div>
        <span className="text-[10px] text-neutral-400 uppercase font-bold block">Phone / Mobile</span>
        <span className="font-semibold text-neutral-800 dark:text-neutral-200 font-mono">{canvass.phoneNumber || "-"}</span>
      </div>
      <div>
        <span className="text-[10px] text-neutral-400 uppercase font-bold block">Requested By</span>
        <span className="font-semibold text-neutral-800 dark:text-neutral-200">{canvass.requestedBy || "-"}</span>
      </div>
    </div>

    {canvass.remarks && (
      <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-200 dark:border-neutral-700/80">
        <span className="text-[10px] text-neutral-400 uppercase font-bold block">Remarks</span>
        <p className="text-neutral-800 dark:text-neutral-200 mt-1">{canvass.remarks}</p>
      </div>
    )}

    {canvass.items && canvass.items.length > 0 && (
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div className="bg-neutral-100 dark:bg-neutral-800 px-4 py-2 font-bold text-neutral-700 dark:text-neutral-300 text-xs">
          Quoted Items & Comparison
        </div>
        <table className="w-full text-left">
          <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-[10px] font-bold text-neutral-500 uppercase border-b border-neutral-200 dark:border-neutral-800">
            <tr>
              <th className="p-2.5 pl-4">Item / Spec</th>
              <th className="p-2.5 text-center">Qty</th>
              <th className="p-2.5 text-right">Supplier A Price</th>
              <th className="p-2.5 text-right">Supplier B Price</th>
              <th className="p-2.5 text-right pr-4">Selected</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {canvass.items.map((item, i) => (
              <tr key={i}>
                <td className="p-2.5 pl-4 font-medium">{item.item} ({item.specification})</td>
                <td className="p-2.5 text-center font-mono">{item.quantity} {item.unit}</td>
                <td className="p-2.5 text-right font-mono">₱{Number(item.supplierAPrice || 0).toFixed(2)}</td>
                <td className="p-2.5 text-right font-mono">₱{Number(item.supplierBPrice || 0).toFixed(2)}</td>
                <td className="p-2.5 text-right pr-4 font-bold text-emerald-600">{item.selectedSupplier || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);
