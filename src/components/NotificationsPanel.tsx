/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Notification,
  User,
  PurchaseOrder,
  PaymentInstructionSlip,
  RequestForSupply,
  CanvassSheet,
  PortalType
} from "../types";
import { motion, AnimatePresence } from "motion/react";
import {
  Bell,
  Check,
  X,
  Clipboard,
  ArrowRight,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Receipt,
  FileSpreadsheet,
  ClipboardList,
  RefreshCw,
  Trash2,
  ShieldCheck,
  Activity,
  Sparkles,
  Search,
  UserCheck,
  History,
  Inbox
} from "lucide-react";
import { COAWorkflowProgress } from "../types/workflow";
import { api } from "../lib/api";
import {
  getAllowedPendingDocumentTypes,
  isPOPending,
  isPISPending,
  isRFSPending,
  isCanvassPending,
  normalizeDocumentType
} from "../utils/pendingDocumentUtils";
import { NotificationRepositoryService } from "../services/notificationRepository";

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  currentUser: User;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearReadNotifications?: () => Promise<void> | void;
  onSelectPO: (poId: string) => void;
  onNavigate?: (tab: string) => void;
  activeSystem?: "po" | "tsd" | null;
  tsdWorkflowProgress?: COAWorkflowProgress;
}

export default function NotificationsPanel({
  isOpen,
  onClose,
  notifications,
  currentUser,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearReadNotifications,
  onSelectPO,
  onNavigate,
  activeSystem,
  tsdWorkflowProgress
}: NotificationsPanelProps) {
  const isTsdPortal = activeSystem === "tsd";
  const currentPortal: PortalType = isTsdPortal ? "TSD" : "PURCHASE";

  // Tab State: "pending" (unread) vs "history" (read)
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [historySearch, setHistorySearch] = useState<string>("");

  // Role-based document type permissions matrix for Purchase Portal
  const allowedTypes = getAllowedPendingDocumentTypes(currentUser.role);

  // Filter notifications strictly relevant to this specific portal and role/user
  const relevantNotifications = notifications
    .filter((n) => {
      const matchesUser =
        (n.userId && n.userId === currentUser.id) ||
        (!n.userId && n.role === currentUser.role) ||
        currentUser.role === "Administrator";

      if (!matchesUser) return false;

      // Strict portal isolation using robust portal inference
      const nPortal = NotificationRepositoryService.inferPortal(n);
      if (nPortal !== currentPortal) return false;

      if (!isTsdPortal && n.documentType) {
        const normType = normalizeDocumentType(n.documentType);
        if (normType && !allowedTypes.includes(normType)) {
          return false;
        }
      }

      return true;
    })
    .reverse(); // latest first

  // Unread vs Read Separation
  const pendingNotifications = relevantNotifications.filter((n) => !n.isRead && n.status !== "READ");
  const historyNotifications = relevantNotifications.filter((n) => n.isRead || n.status === "READ");

  const unreadCount = pendingNotifications.length;
  const readCount = historyNotifications.length;

  // Search filter for History tab
  const filteredHistory = historyNotifications.filter((n) => {
    if (!historySearch.trim()) return true;
    const query = historySearch.toLowerCase();
    const docNum = (n.documentNumber || n.poId || n.documentId || "").toLowerCase();
    const wfId = (n.workflowId || "").toLowerCase();
    const mod = (n.module || "").toLowerCase();
    const title = (n.title || "").toLowerCase();
    const msg = (n.message || "").toLowerCase();
    const author = (n.createdBy || n.role || "").toLowerCase();

    return (
      docNum.includes(query) ||
      wfId.includes(query) ||
      mod.includes(query) ||
      title.includes(query) ||
      msg.includes(query) ||
      author.includes(query)
    );
  });

  // Clear Read confirmation modal & process state
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearFeedback, setClearFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleConfirmClearRead = async () => {
    setIsClearing(true);
    setClearFeedback(null);
    try {
      if (onClearReadNotifications) {
        await onClearReadNotifications();
      }
      setClearFeedback({ type: "success", text: "Read notifications cleared successfully." });
      setTimeout(() => {
        setShowClearConfirm(false);
        setClearFeedback(null);
      }, 700);
    } catch (err) {
      console.error("Failed to clear read notifications:", err);
      setClearFeedback({ type: "error", text: "Unable to clear read notifications." });
    } finally {
      setIsClearing(false);
    }
  };

  // Procurement documents state for dynamic pending calculations
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [pises, setPises] = useState<PaymentInstructionSlip[]>([]);
  const [rfses, setRfses] = useState<RequestForSupply[]>([]);
  const [canvasses, setCanvasses] = useState<CanvassSheet[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(false);

  // Independent collapsible container states
  const [expandedContainers, setExpandedContainers] = useState<Record<string, boolean>>({
    PO: true,
    PIS: true,
    RFS: true,
    CANVASS: true
  });

  const toggleContainer = (type: string) => {
    setExpandedContainers((prev) => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  // Synchronize dynamic procurement records whenever notification drawer is opened (ONLY for Purchase Portal)
  useEffect(() => {
    if (isOpen && !isTsdPortal) {
      setLoadingDocs(true);
      Promise.all([
        allowedTypes.includes("PO") ? api.getPOs().catch(() => []) : Promise.resolve([]),
        allowedTypes.includes("PIS") ? api.getPIS().catch(() => []) : Promise.resolve([]),
        allowedTypes.includes("RFS") ? api.getRFS().catch(() => []) : Promise.resolve([]),
        allowedTypes.includes("CANVASS") ? api.getCanvass().catch(() => []) : Promise.resolve([])
      ])
        .then(([poData, pisData, rfsData, canvData]) => {
          setPos(poData || []);
          setPises(pisData || []);
          setRfses(rfsData || []);
          setCanvasses(canvData || []);
        })
        .finally(() => {
          setLoadingDocs(false);
        });
    }
  }, [isOpen, currentUser.role, isTsdPortal]);

  // Dynamically calculate pending approval documents using centralized pending logic (0 for TSD Portal)
  const pendingPOs = (!isTsdPortal && allowedTypes.includes("PO")) ? pos.filter(isPOPending) : [];
  const pendingPIS = (!isTsdPortal && allowedTypes.includes("PIS")) ? pises.filter(isPISPending) : [];
  const pendingRFS = (!isTsdPortal && allowedTypes.includes("RFS")) ? rfses.filter(isRFSPending) : [];
  const pendingCanvass = (!isTsdPortal && allowedTypes.includes("CANVASS")) ? canvasses.filter(isCanvassPending) : [];

  const totalPendingCount = isTsdPortal
    ? 0
    : pendingPOs.length + pendingPIS.length + pendingRFS.length + pendingCanvass.length;

  const pendingGroups = isTsdPortal
    ? []
    : [
        {
          type: "PO",
          title: "Purchase Orders",
          icon: FileText,
          items: pendingPOs,
          getNumber: (po: PurchaseOrder) => po.poNumber || "PO-UNASSIGNED",
          getSubtext: (po: PurchaseOrder) => po.supplierName || po.preparedBy || "Awaiting Approval",
          destination: "procurement-approval"
        },
        {
          type: "PIS",
          title: "Payment Instruction Slips",
          icon: Receipt,
          items: pendingPIS,
          getNumber: (pis: PaymentInstructionSlip) => pis.pisNumber || "PIS-UNASSIGNED",
          getSubtext: (pis: PaymentInstructionSlip) => pis.payee || pis.requestedBy || "Awaiting Approval",
          destination: "procurement-approval"
        },
        {
          type: "RFS",
          title: "Requests For Supply",
          icon: ClipboardList,
          items: pendingRFS,
          getNumber: (rfs: RequestForSupply) => rfs.rfsNumber || "RFS-UNASSIGNED",
          getSubtext: (rfs: RequestForSupply) => rfs.department || rfs.requestedBy || "Awaiting Approval",
          destination: "procurement-approval"
        },
        {
          type: "CANVASS",
          title: "Canvass Sheets",
          icon: FileSpreadsheet,
          items: pendingCanvass,
          getNumber: (canv: CanvassSheet) =>
            canv.canvassNumber ? `CS-${canv.canvassNumber}` : "CS-UNASSIGNED",
          getSubtext: (canv: CanvassSheet) =>
            canv.recommendedSupplier || canv.supplierName || canv.requestedBy || "Awaiting Approval",
          destination: "procurement-approval"
        }
      ].filter((group) => allowedTypes.includes(group.type as any));

  // Handle clicking a pending document
  const handlePendingDocClick = (docType: string, doc: any) => {
    onClose();
    if (docType === "PO") {
      onSelectPO(doc.id);
    } else if (onNavigate) {
      onNavigate("procurement-approval");
    }
  };

  // Automatic Read Handling when opening a pending notification
  const handlePendingNotificationClick = (notif: Notification) => {
    // 1. Mark as Read automatically (moves item from Pending to History)
    onMarkAsRead(notif.id);

    // 2. Navigation
    if (notif.poId) {
      onSelectPO(notif.poId);
      onClose();
    } else if (notif.module && onNavigate) {
      onNavigate(notif.module);
      onClose();
    } else if (notif.workflowId && onNavigate) {
      onNavigate("control-no");
      onClose();
    }
  };

  // Click handler for History items (already read)
  const handleHistoryNotificationClick = (notif: Notification) => {
    if (notif.poId) {
      onSelectPO(notif.poId);
      onClose();
    } else if (notif.module && onNavigate) {
      onNavigate(notif.module);
      onClose();
    } else if (notif.workflowId && onNavigate) {
      onNavigate("control-no");
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-40 no-print"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 p-6 overflow-y-auto border-l border-gray-100 flex flex-col justify-between no-print"
          >
            <div>
              {/* Header with Portal Indicator */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Bell className={`w-5 h-5 ${isTsdPortal ? "text-emerald-600" : "text-smei-crimson"}`} />
                    {(unreadCount > 0 || totalPendingCount > 0) && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border border-white" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-800 font-display flex items-center gap-2">
                      <span>Notifications</span>
                      <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded-full border ${
                        isTsdPortal 
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                          : "bg-red-50 text-smei-crimson border-red-200"
                      }`}>
                        {isTsdPortal ? "TSD PORTAL" : "PURCHASE PORTAL"}
                      </span>
                    </h3>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Pending vs History Tabs */}
              <div className="flex border-b border-gray-200 mb-4 font-mono text-xs font-bold">
                <button
                  onClick={() => setActiveTab("pending")}
                  className={`flex-1 py-2.5 px-3 text-center border-b-2 transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    activeTab === "pending"
                      ? isTsdPortal
                        ? "border-emerald-600 text-emerald-800 bg-emerald-50/40 font-black"
                        : "border-smei-crimson text-smei-crimson bg-red-50/40 font-black"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Inbox className="w-3.5 h-3.5" />
                  <span>Pending</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    unreadCount > 0
                      ? isTsdPortal
                        ? "bg-emerald-600 text-white"
                        : "bg-smei-crimson text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}>
                    {unreadCount}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("history")}
                  className={`flex-1 py-2.5 px-3 text-center border-b-2 transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    activeTab === "history"
                      ? isTsdPortal
                        ? "border-emerald-600 text-emerald-800 bg-emerald-50/40 font-black"
                        : "border-smei-crimson text-smei-crimson bg-red-50/40 font-black"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>History</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 text-gray-600">
                    {readCount}
                  </span>
                </button>
              </div>

              {/* PENDING TAB CONTENT */}
              {activeTab === "pending" && (
                <div>
                  {/* Mark All as Read Action Header */}
                  {unreadCount > 0 && (
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                      <span className="text-[11px] font-semibold text-gray-500 font-mono">
                        {unreadCount} Unread Alert{unreadCount > 1 ? "s" : ""}
                      </span>
                      <button
                        onClick={onMarkAllAsRead}
                        className={`text-xs font-bold flex items-center gap-1 hover:underline cursor-pointer transition-colors ${
                          isTsdPortal ? "text-emerald-700 hover:text-emerald-900" : "text-smei-crimson hover:text-smei-darkred"
                        }`}
                        title={`Mark all as read for ${isTsdPortal ? "TSD Portal" : "Purchase Portal"}`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Mark All as Read</span>
                      </button>
                    </div>
                  )}

                  {/* TSD ACTIVE WORKFLOW PROGRESS SECTION */}
                  {isTsdPortal && tsdWorkflowProgress && (
                    <div className="mb-5 rounded-2xl border border-emerald-200/80 bg-linear-to-b from-emerald-50/80 via-white to-emerald-50/30 p-4 shadow-xs transition-all">
                      <div className="flex items-start justify-between pb-3 border-b border-emerald-100">
                        <div className="space-y-0.5 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-800 uppercase tracking-wider font-mono">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-pulse shrink-0" />
                            <span>ACTIVE WORKFLOW</span>
                          </div>
                          <h4 className="text-xs font-extrabold text-gray-900 font-mono truncate">
                            {tsdWorkflowProgress.workflowId}
                          </h4>
                          {tsdWorkflowProgress.selectedControlNo && (
                            <p className="text-[10px] font-semibold text-emerald-700 font-mono truncate">
                              Control No: {tsdWorkflowProgress.selectedControlNo}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={`inline-block text-xs font-black font-mono px-2 py-0.5 rounded-md border shadow-2xs ${
                            tsdWorkflowProgress.percentage === 100
                              ? "bg-emerald-600 text-white border-emerald-700"
                              : "bg-emerald-100 text-emerald-900 border-emerald-300"
                          }`}>
                            {tsdWorkflowProgress.percentage}% Complete
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-mono font-bold text-gray-500">
                          <span>COMPLETION PROGRESS</span>
                          <span>{tsdWorkflowProgress.completedCount} / 5 DOCUMENTS</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-emerald-600 h-2 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${tsdWorkflowProgress.percentage}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-3.5 space-y-1.5 pt-2 border-t border-emerald-100/60">
                        {tsdWorkflowProgress.steps.map((step) => {
                          const nextIncompleteStep = tsdWorkflowProgress.steps.find((s) => !s.isCompleted);
                          const isCurrentNext = !tsdWorkflowProgress.isReadyForCOA && nextIncompleteStep?.key === step.key;

                          return (
                            <div
                              key={step.key}
                              onClick={() => {
                                if (onNavigate) {
                                  onNavigate(step.key);
                                  onClose();
                                }
                              }}
                              className={`group flex items-center justify-between p-2 rounded-lg text-xs transition-all cursor-pointer ${
                                step.isCompleted
                                  ? "bg-emerald-50/80 border border-emerald-200/80 text-emerald-900 font-semibold hover:bg-emerald-100/70"
                                  : isCurrentNext
                                    ? "bg-amber-50 border border-amber-200 text-amber-900 font-bold shadow-2xs hover:bg-amber-100/80"
                                    : "bg-gray-50/70 border border-gray-100 text-gray-500 hover:bg-gray-100/70 hover:text-gray-800"
                              }`}
                              title={`Navigate to ${step.title} module`}
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-1">
                                <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                                  step.isCompleted
                                    ? "bg-emerald-600 text-white"
                                    : isCurrentNext
                                      ? "bg-amber-500 text-white animate-pulse"
                                      : "border border-gray-300 text-gray-400 bg-white"
                                }`}>
                                  {step.isCompleted ? (
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                  ) : (
                                    <span>○</span>
                                  )}
                                </span>
                                <span className="truncate">{step.title}</span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`text-[9px] font-bold font-mono px-1.5 py-0.2 rounded ${
                                  step.isCompleted
                                    ? "bg-emerald-100 text-emerald-800"
                                    : isCurrentNext
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-gray-100 text-gray-400"
                                }`}>
                                  {step.isCompleted ? "COMPLETED" : isCurrentNext ? "IN PROGRESS" : "PENDING"}
                                </span>
                                <ArrowRight className="w-3 h-3 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* PRIORITIZED PENDING APPROVAL SECTION (PURCHASE PORTAL ONLY) */}
                  {!isTsdPortal && totalPendingCount > 0 && (
                    <div className="mb-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-smei-crimson uppercase tracking-wider font-mono">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Pending Clearance ({totalPendingCount})</span>
                        </div>
                        {loadingDocs && (
                          <RefreshCw className="w-3 h-3 text-gray-400 animate-spin" />
                        )}
                      </div>

                      {pendingGroups.map((group) => {
                        if (group.items.length === 0) return null;

                        const isExpanded = expandedContainers[group.type] ?? true;
                        const GroupIcon = group.icon;

                        return (
                          <div
                            key={group.type}
                            className="border border-red-100 rounded-xl overflow-hidden bg-white shadow-2xs transition-all"
                          >
                            <button
                              onClick={() => toggleContainer(group.type)}
                              className="w-full px-3.5 py-2.5 bg-red-50/40 hover:bg-red-50/80 transition-colors flex items-center justify-between text-left select-none cursor-pointer"
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <GroupIcon className="w-4 h-4 text-smei-crimson shrink-0" />
                                <span className="font-bold text-xs text-gray-900 truncate">
                                  {group.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-smei-crimson text-white shadow-2xs">
                                  {group.items.length} Pending
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-gray-500" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-gray-500" />
                                )}
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="divide-y divide-gray-100 border-t border-red-100/60 bg-white">
                                {group.items.map((item: any) => {
                                  const docNumber = group.getNumber(item);
                                  const subtext = group.getSubtext(item);
                                  return (
                                    <div
                                      key={item.id}
                                      onClick={() => handlePendingDocClick(group.type, item)}
                                      className="p-3 hover:bg-red-50/20 transition-colors cursor-pointer group flex items-start justify-between gap-2"
                                    >
                                      <div className="min-w-0 flex-1 space-y-0.5">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-mono text-xs font-bold text-smei-crimson group-hover:underline truncate">
                                            {docNumber}
                                          </span>
                                          <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 shrink-0">
                                            Awaiting Clearance
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-gray-600 truncate">
                                          {subtext}
                                        </p>
                                      </div>
                                      <div className="flex items-center text-xs font-bold text-smei-crimson opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0 pt-1">
                                        <ArrowRight className="w-3.5 h-3.5" />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* UNREAD ORDINARY NOTIFICATIONS */}
                  <div className="space-y-3">
                    {pendingNotifications.length > 0 ? (
                      pendingNotifications.map((notif) => {
                        const docNumber = notif.documentNumber || notif.poId || notif.documentId;
                        const createdBy = notif.createdBy || notif.role || "System Dispatcher";

                        return (
                          <div
                            key={notif.id}
                            onClick={() => handlePendingNotificationClick(notif)}
                            className={`p-4 rounded-xl border transition-all cursor-pointer hover:shadow-sm flex items-start gap-3 relative overflow-hidden group ${
                              isTsdPortal
                                ? "bg-emerald-50/30 border-emerald-100 text-gray-800 hover:border-emerald-200 hover:bg-emerald-50/60"
                                : "bg-red-50/30 border-red-100/50 text-gray-800 hover:border-smei-lightred/40 hover:bg-red-50/40"
                            }`}
                          >
                            {/* Left active color bar for unread notifications */}
                            <span className={`absolute left-0 top-0 bottom-0 w-1 ${
                              isTsdPortal ? "bg-emerald-600" : "bg-smei-crimson"
                            }`} />

                            <div className={`p-2 rounded-lg ${
                              isTsdPortal ? "bg-emerald-100/60" : "bg-red-50"
                            } shrink-0`}>
                              {isTsdPortal ? (
                                <Activity className="w-4 h-4 text-emerald-700" />
                              ) : (
                                <Clipboard className="w-4 h-4 text-smei-crimson" />
                              )}
                            </div>

                            <div className="space-y-1 flex-1 min-w-0">
                              {/* Metadata Badges Header */}
                              <div className="flex items-center justify-between gap-1 flex-wrap">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                                    isTsdPortal ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-smei-crimson"
                                  }`}>
                                    {isTsdPortal ? "TSD" : "PURCHASE"}
                                  </span>
                                  {notif.module && (
                                    <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 bg-gray-100 text-gray-700 rounded">
                                      {notif.module}
                                    </span>
                                  )}
                                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded">
                                    UNREAD
                                  </span>
                                </div>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onMarkAsRead(notif.id);
                                  }}
                                  className={`p-1 rounded-md transition-colors ${
                                    isTsdPortal ? "text-gray-400 hover:text-emerald-700 hover:bg-emerald-100" : "text-gray-400 hover:text-smei-crimson hover:bg-red-100"
                                  }`}
                                  title="Mark as read"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                </button>
                              </div>

                              <h4 className="text-xs font-bold text-gray-900 leading-tight pt-0.5">
                                {notif.title}
                              </h4>

                              <p className="text-[11px] leading-relaxed text-gray-600 break-words">
                                {notif.message}
                              </p>

                              {/* Document & Workflow IDs */}
                              {(docNumber || notif.workflowId) && (
                                <div className="flex items-center gap-2 pt-1 font-mono text-[10px] text-gray-700 font-semibold flex-wrap">
                                  {docNumber && (
                                    <span className="bg-white/80 px-1.5 py-0.5 rounded border border-gray-200">
                                      Doc #: {docNumber}
                                    </span>
                                  )}
                                  {notif.workflowId && (
                                    <span className="bg-white/80 px-1.5 py-0.5 rounded border border-gray-200">
                                      WF ID: {notif.workflowId}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Date, Time, Created By */}
                              <div className="flex items-center justify-between text-[9px] text-gray-400 font-mono mt-1 pt-1 border-t border-gray-100/60">
                                <span className="truncate">By: {createdBy}</span>
                                <span>{notif.date} {notif.time}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : totalPendingCount === 0 ? (
                      <div className="py-12 text-center text-gray-400 font-sans space-y-2">
                        <AlertCircle className="w-8 h-8 text-gray-200 mx-auto" />
                        <p className="text-xs font-medium">
                          {isTsdPortal
                            ? "No pending unread TSD notifications."
                            : "No pending unread notifications for your clearance."}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* HISTORY TAB CONTENT */}
              {activeTab === "history" && (
                <div>
                  {/* Action Header: Search & Clear Read */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          placeholder="Search history by doc #, workflow ID, title..."
                          value={historySearch}
                          onChange={(e) => setHistorySearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-gray-800 placeholder:text-gray-400 font-sans"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (readCount === 0) return;
                          setClearFeedback(null);
                          setShowClearConfirm(true);
                        }}
                        disabled={readCount === 0}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shrink-0 ${
                          readCount > 0
                            ? "text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 cursor-pointer shadow-2xs"
                            : "text-gray-300 border border-gray-100 bg-gray-50 cursor-not-allowed opacity-60"
                        }`}
                        title={readCount > 0 ? "Clear all read notifications" : "No read notifications to clear."}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear Read</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                      <span>{filteredHistory.length} Read Record{filteredHistory.length !== 1 ? "s" : ""}</span>
                      {historySearch && (
                        <button
                          onClick={() => setHistorySearch("")}
                          className="text-gray-500 underline hover:text-gray-700"
                        >
                          Clear Filter
                        </button>
                      )}
                    </div>
                  </div>

                  {/* HISTORY NOTIFICATIONS LIST */}
                  <div className="space-y-3">
                    {filteredHistory.length > 0 ? (
                      filteredHistory.map((notif) => {
                        const docNumber = notif.documentNumber || notif.poId || notif.documentId;
                        const createdBy = notif.createdBy || notif.role || "System Dispatcher";

                        return (
                          <div
                            key={notif.id}
                            onClick={() => handleHistoryNotificationClick(notif)}
                            className="p-3.5 rounded-xl border border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50/50 transition-all cursor-pointer flex items-start gap-3 group"
                          >
                            <div className="p-2 rounded-lg bg-gray-100 shrink-0">
                              <UserCheck className="w-4 h-4 text-gray-400" />
                            </div>

                            <div className="space-y-1 flex-1 min-w-0">
                              {/* Metadata Badges Header */}
                              <div className="flex items-center justify-between gap-1 flex-wrap">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-gray-100 text-gray-600">
                                    {isTsdPortal ? "TSD" : "PURCHASE"}
                                  </span>
                                  {notif.module && (
                                    <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 bg-gray-100 text-gray-600 rounded">
                                      {notif.module}
                                    </span>
                                  )}
                                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded">
                                    READ
                                  </span>
                                </div>
                                <span className="text-[9px] font-mono text-gray-400">
                                  {notif.date}
                                </span>
                              </div>

                              <h4 className="text-xs font-bold text-gray-700 leading-tight pt-0.5">
                                {notif.title}
                              </h4>

                              <p className="text-[11px] leading-relaxed text-gray-500 break-words">
                                {notif.message}
                              </p>

                              {/* Document & Workflow IDs */}
                              {(docNumber || notif.workflowId) && (
                                <div className="flex items-center gap-2 pt-1 font-mono text-[10px] text-gray-600 font-medium flex-wrap">
                                  {docNumber && (
                                    <span className="bg-gray-50 px-1.5 py-0.5 rounded border border-gray-150">
                                      Doc #: {docNumber}
                                    </span>
                                  )}
                                  {notif.workflowId && (
                                    <span className="bg-gray-50 px-1.5 py-0.5 rounded border border-gray-150">
                                      WF ID: {notif.workflowId}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Footer metadata: Created By & Read At */}
                              <div className="flex items-center justify-between text-[9px] text-gray-400 font-mono mt-1 pt-1 border-t border-gray-100">
                                <span>Created by: {createdBy}</span>
                                <span>
                                  {notif.readAt ? `Read: ${new Date(notif.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `${notif.time}`}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-12 text-center text-gray-400 font-sans space-y-2">
                        <History className="w-8 h-8 text-gray-200 mx-auto" />
                        <p className="text-xs font-medium">
                          {historySearch ? "No history records matching search query." : "No read notification history."}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer details */}
            <div className="border-t border-gray-100 pt-4 text-center mt-6">
              <span className="text-[10px] text-gray-400 font-mono">
                SMEI Real-Time Activity Alert Dispatcher
              </span>
            </div>
          </motion.div>

          {/* CLEAR READ NOTIFICATIONS CONFIRMATION MODAL */}
          <AnimatePresence>
            {showClearConfirm && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 no-print">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-2xl border border-gray-200 p-6 max-w-sm w-full shadow-2xl space-y-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-red-50 text-smei-crimson rounded-xl shrink-0">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div className="space-y-1 min-w-0 flex-1">
                      <h4 className="text-base font-bold text-gray-900 font-display">
                        Delete all read notifications?
                      </h4>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        This action cannot be undone. All notifications currently marked as read in this portal will be permanently removed.
                      </p>
                      <p className="text-[11px] text-gray-500 font-semibold pt-1">
                        Unread and pending notifications will not be affected.
                      </p>
                    </div>
                  </div>

                  {clearFeedback && (
                    <div className={`p-2.5 rounded-lg text-xs font-semibold ${
                      clearFeedback.type === "success"
                        ? "bg-green-50 text-green-800 border border-green-200"
                        : "bg-red-50 text-red-800 border border-red-200"
                    }`}>
                      {clearFeedback.text}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      disabled={isClearing}
                      onClick={() => setShowClearConfirm(false)}
                      className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isClearing}
                      onClick={handleConfirmClearRead}
                      className="px-4 py-2 text-xs font-bold text-white bg-smei-crimson hover:bg-smei-darkred rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isClearing ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Deleting...</span>
                        </>
                      ) : (
                        <span>Delete</span>
                      )}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
