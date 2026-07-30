import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Check,
  Clock,
  Key,
  Truck,
  Flame,
  Layers,
  FileCheck,
  ChevronRight,
  ChevronLeft,
  Lock,
  RefreshCw,
  AlertCircle,
  X,
  Sparkles,
  Info,
  ShieldAlert,
  Sliders,
  Plus,
  Download
} from "lucide-react";
import { useCOAWorkflowTracker } from "../hooks/useCOAWorkflowTracker";
import { COAWorkflowStepKey, COAWorkflowStep } from "../types/workflow";
import { User, UserRole } from "../types";
import { exportCompleteCOAPackage } from "../utils/bulkExport";
import { NewWorkflowModal } from "./NewWorkflowModal";
import { getActiveWorkflow, createNewWorkflow, isDraftWorkflowId } from "../utils/workflowManager";

export interface COAWorkflowTrackerProps {
  activeTab?: string;
  onNavigate: (tab: string) => void;
  currentUser?: User;
  className?: string;
}

const STEP_ICONS: Record<COAWorkflowStepKey, React.ElementType> = {
  "control-no": Key,
  "unloading-loading": Truck,
  "hazardous-waste": Flame,
  "waste-movement": Layers,
  timestamp: Clock
};

export const COAWorkflowTracker = React.memo(function COAWorkflowTracker({
  activeTab,
  onNavigate,
  currentUser,
  className = ""
}: COAWorkflowTrackerProps) {
  const {
    progress,
    selectedControlNo,
    selectControlNo,
    availableControlNumbers,
    refreshData,
    error
  } = useCOAWorkflowTracker(activeTab, currentUser?.role);

  // Responsiveness & drawer state
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [hoveredStepKey, setHoveredStepKey] = useState<COAWorkflowStepKey | null>(null);

  // Check role permissions per step
  const isStepLocked = useCallback(
    (stepKey: COAWorkflowStepKey) => {
      if (!currentUser) return false;
      const role = currentUser.role;

      // Restrict specific administrative views based on standard portal security
      if (role === UserRole.Viewer && stepKey === "timestamp") {
        return false; // Viewers can view
      }
      return false;
    },
    [currentUser]
  );

  const handleStepClick = useCallback(
    (step: COAWorkflowStep) => {
      if (isStepLocked(step.key)) return;
      onNavigate(step.key);
      setIsMobileDrawerOpen(false);
    },
    [isStepLocked, onNavigate]
  );

  return (
    <>
      {/* NEW WORKFLOW MODAL */}
      <NewWorkflowModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onCreated={() => {
          refreshData();
        }}
      />

      {/* MOBILE TRIGGER FLOATING BUTTON */}
      <div className="fixed bottom-5 right-5 z-40 xl:hidden">
        <button
          type="button"
          onClick={() => setIsMobileDrawerOpen(true)}
          className="flex items-center gap-2.5 px-4 py-3 bg-smei-crimson text-white font-bold text-xs rounded-full shadow-2xl hover:bg-smei-darkred transition-all transform hover:scale-105 active:scale-95 cursor-pointer border-2 border-white/20"
          aria-label="Open COA Document Progress Tracker"
        >
          <Sparkles className="w-4 h-4 animate-pulse text-amber-300" />
          <span>COA Tracker ({progress.percentage}%)</span>
          {progress.isReadyForCOA && (
            <span className="w-2 h-2 rounded-full bg-green-400 animate-ping shrink-0" />
          )}
        </button>
      </div>

      {/* MOBILE DRAWER OVERLAY */}
      <AnimatePresence>
        {isMobileDrawerOpen && (
          <div className="fixed inset-0 z-50 xl:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileDrawerOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="absolute top-0 right-0 bottom-0 w-full max-w-sm bg-white dark:bg-neutral-900 border-l border-gray-200 dark:border-neutral-800 shadow-2xl flex flex-col z-10"
            >
              <div className="p-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between bg-gray-50/80 dark:bg-neutral-800/50">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-smei-crimson" />
                  <span className="font-bold text-sm text-gray-900 dark:text-white font-display">
                    COA Workflow Progress
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <TrackerCoreContent
                  progress={progress}
                  selectedControlNo={selectedControlNo}
                  selectControlNo={selectControlNo}
                  availableControlNumbers={availableControlNumbers}
                  onStepClick={handleStepClick}
                  isStepLocked={isStepLocked}
                  hoveredStepKey={hoveredStepKey}
                  setHoveredStepKey={setHoveredStepKey}
                  onRefresh={refreshData}
                  onOpenNewWorkflow={() => setIsNewModalOpen(true)}
                  error={error}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DESKTOP / TABLET CONTAINER */}
      <aside
        className={`hidden xl:block shrink-0 transition-all duration-300 ${
          isCollapsed ? "w-14 min-w-[56px]" : "w-72 max-w-xs"
        } sticky top-4 self-start ${className}`}
        aria-label="COA Document Progress Tracker"
      >
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm p-3.5 space-y-3.5 overflow-hidden transition-all max-h-[calc(100vh-2rem)] overflow-y-auto custom-scrollbar">
          {/* HEADER BAR & COLLAPSE TOGGLE */}
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-gray-100 dark:border-neutral-800">
            {!isCollapsed && (
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-smei-crimson dark:text-red-400 shrink-0" />
                  <h3 className="text-xs font-bold tracking-wider uppercase text-gray-900 dark:text-white font-display truncate">
                    COA DOCUMENT PROGRESS
                  </h3>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-neutral-400 truncate">
                  Compliance Certification Tracker
                </p>
              </div>
            )}

            <div className="flex items-center gap-1 ml-auto shrink-0">
              {!isCollapsed && (
                <button
                  type="button"
                  onClick={refreshData}
                  className="p-1 text-gray-400 hover:text-smei-crimson dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                  title="Refresh workflow status"
                  aria-label="Refresh status"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                title={isCollapsed ? "Expand Tracker" : "Collapse Tracker"}
                aria-label={isCollapsed ? "Expand Tracker" : "Collapse Tracker"}
              >
                {isCollapsed ? (
                  <ChevronLeft className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* COLLAPSED MINI VIEW */}
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-4 py-2">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                  progress.isReadyForCOA
                    ? "bg-emerald-500 text-white animate-pulse"
                    : "bg-smei-crimson text-white"
                }`}
                title={`Progress: ${progress.percentage}% (${progress.completedCount}/5 Complete)`}
              >
                {progress.percentage}%
              </div>
              <div className="w-1 h-32 bg-gray-100 dark:bg-neutral-800 rounded-full relative overflow-hidden">
                <div
                  className="w-full bg-smei-crimson transition-all duration-500 rounded-full"
                  style={{ height: `${progress.percentage}%` }}
                />
              </div>
            </div>
          ) : (
            /* FULL EXPANDED CORE TRACKER CONTENT */
            <TrackerCoreContent
              progress={progress}
              selectedControlNo={selectedControlNo}
              selectControlNo={selectControlNo}
              availableControlNumbers={availableControlNumbers}
              onStepClick={handleStepClick}
              isStepLocked={isStepLocked}
              hoveredStepKey={hoveredStepKey}
              setHoveredStepKey={setHoveredStepKey}
              onRefresh={refreshData}
              onOpenNewWorkflow={() => setIsNewModalOpen(true)}
              error={error}
            />
          )}
        </div>
      </aside>
    </>
  );
});

/* CORE TRACKER INTERNAL CONTENT */
interface TrackerCoreContentProps {
  progress: ReturnType<typeof useCOAWorkflowTracker>["progress"];
  selectedControlNo: string;
  selectControlNo: (no: string) => void;
  availableControlNumbers: string[];
  onStepClick: (step: COAWorkflowStep) => void;
  isStepLocked: (key: COAWorkflowStepKey) => boolean;
  hoveredStepKey: COAWorkflowStepKey | null;
  setHoveredStepKey: (key: COAWorkflowStepKey | null) => void;
  onRefresh: () => void;
  onOpenNewWorkflow: () => void;
  error: string | null;
}

function TrackerCoreContent({
  progress,
  selectedControlNo,
  selectControlNo,
  availableControlNumbers,
  onStepClick,
  isStepLocked,
  hoveredStepKey,
  setHoveredStepKey,
  onRefresh,
  onOpenNewWorkflow,
  error
}: TrackerCoreContentProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [createdWfToast, setCreatedWfToast] = useState<string | null>(null);

  const activeWfObj = useMemo(() => {
    return getActiveWorkflow();
  }, [progress.workflowId, progress.lastUpdated]);

  const handleQuickCreateWorkflow = () => {
    try {
      createNewWorkflow();
      setCreatedWfToast("Draft");
      onRefresh();
      setTimeout(() => {
        setCreatedWfToast(null);
      }, 5000);
    } catch (err: any) {
      console.error("Failed to create workflow:", err);
    }
  };

  const handleBulkExport = async () => {
    if (!progress.isReadyForCOA) return;
    setIsExporting(true);
    setExportStatus("Preparing COA Package...");
    try {
      await exportCompleteCOAPackage((msg) => setExportStatus(msg));
    } catch (err: any) {
      alert(err.message || "Failed to export COA package.");
    } finally {
      setIsExporting(false);
      setExportStatus(null);
    }
  };

  if (error) {
    return (
      <div className="p-3.5 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900/50 space-y-2.5 text-center">
        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mx-auto" />
        <p className="text-xs font-semibold text-red-800 dark:text-red-300">
          Unable to load workflow.
        </p>
        <button
          type="button"
          onClick={onRefresh}
          className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* + NEW COA WORKFLOW BUTTON (1-CLICK AUTOMATIC DRAFT GENERATOR) */}
      <button
        type="button"
        onClick={handleQuickCreateWorkflow}
        className="w-full py-2.5 px-3 bg-smei-crimson hover:bg-smei-darkred text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-white/20"
      >
        <Plus className="w-4 h-4 stroke-[3]" />
        <span className="uppercase tracking-wider font-display">+ New COA Workflow</span>
      </button>

      {/* CREATED TOAST BANNER */}
      {createdWfToast && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -4 }}
          className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100 rounded-xl text-xs flex items-center justify-between shadow-xs font-sans"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
            <div>
              <p className="font-bold text-[11px] text-amber-800 dark:text-amber-200">✓ Draft Workflow Started</p>
              <p className="text-[10px] text-amber-700 dark:text-amber-400">Workflow ID will be generated upon first document save.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCreatedWfToast(null)}
            className="text-amber-600 hover:text-amber-800 dark:text-amber-400 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}

      {/* WORKFLOW & CONTROL NUMBER SELECTOR */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold tracking-wider uppercase text-gray-500 dark:text-neutral-400 flex items-center gap-1">
          <Key className="w-3 h-3 text-smei-crimson shrink-0" />
          <span>ACTIVE COA WORKFLOW</span>
        </label>
        {progress.availableWorkflows && progress.availableWorkflows.length > 0 ? (
          <select
            value={progress.workflowId || selectedControlNo}
            onChange={(e) => selectControlNo(e.target.value)}
            className="w-full text-xs font-bold px-2.5 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-smei-crimson transition-all cursor-pointer truncate"
            title={selectedControlNo ? `Active Control No: ${selectedControlNo}` : `Active Workflow: ${progress.workflowId}`}
          >
            <option value="">-- Select Active Workflow --</option>
            {progress.availableWorkflows.map((wf) => (
              <option key={wf.id} value={wf.id}>
                {wf.label}
              </option>
            ))}
          </select>
        ) : availableControlNumbers.length > 0 ? (
          <select
            value={selectedControlNo}
            onChange={(e) => selectControlNo(e.target.value)}
            className="w-full text-xs font-bold px-2.5 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-smei-crimson transition-all cursor-pointer truncate"
            title={selectedControlNo ? `Active Control No: ${selectedControlNo}` : "Select a Control Number"}
          >
            <option value="">-- Select Control Number --</option>
            {availableControlNumbers.map((no) => (
              <option key={no} value={no}>
                Control No: {no}
              </option>
            ))}
          </select>
        ) : (
          <div className="p-2.5 bg-gray-50 dark:bg-neutral-800/60 rounded-lg border border-dashed border-gray-200 dark:border-neutral-700 text-center">
            <span className="text-[11px] text-gray-500 dark:text-neutral-400 font-medium">
              No Active Workflows
            </span>
          </div>
        )}
      </div>

      {/* CURRENT WORKFLOW STATUS CARD */}
      <div className="p-2.5 bg-slate-50 dark:bg-neutral-800/60 rounded-xl border border-slate-200 dark:border-neutral-700/80 space-y-1 font-mono text-[11px]">
        <div className="flex items-center justify-between text-slate-700 dark:text-neutral-300 font-sans">
          <span className="text-[10px] uppercase font-bold text-gray-500 font-mono">ACTIVE COA WORKFLOW</span>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
            activeWfObj?.status === "completed"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200"
              : activeWfObj?.status === "active"
              ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200"
              : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200"
          }`}>
            {activeWfObj?.status || "Draft"}
          </span>
        </div>
        <div className="flex items-center justify-between font-bold">
          <span className="text-gray-500 dark:text-neutral-400 font-normal">Workflow:</span>
          <span className="text-gray-900 dark:text-white font-mono">
            {isDraftWorkflowId(progress.workflowId) || progress.workflowId === "Not Assigned Yet" ? (
              <span className="text-amber-600 dark:text-amber-400 font-sans italic text-[10px]">
                Not Assigned Yet
              </span>
            ) : (
              progress.workflowId
            )}
          </span>
        </div>
        <div className="flex items-center justify-between font-bold">
          <span className="text-gray-500 dark:text-neutral-400 font-normal">Control Number:</span>
          <span className={progress.selectedControlNo ? "text-smei-crimson dark:text-red-400 font-bold font-mono" : "text-amber-600 dark:text-amber-400 font-sans italic text-[10px]"}>
            {progress.selectedControlNo || "Not Assigned Yet"}
          </span>
        </div>
      </div>

      {/* TOP PROGRESS BAR & BADGES */}
      <div className="p-3 bg-gray-50/80 dark:bg-neutral-800/40 rounded-xl border border-gray-100 dark:border-neutral-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-gray-700 dark:text-neutral-300 font-display text-[11px]">
            Overall Completion
          </span>
          <span className="font-bold text-smei-crimson dark:text-red-400 font-mono text-xs">
            {progress.percentage}%
          </span>
        </div>

        {/* PROGRESS BAR */}
        <div className="w-full h-2 bg-gray-200 dark:bg-neutral-700 rounded-full overflow-hidden p-0.5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress.percentage}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className={`h-full rounded-full transition-colors ${
              progress.isReadyForCOA
                ? "bg-emerald-500 shadow-xs"
                : "bg-smei-crimson"
            }`}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] font-medium text-gray-500 dark:text-neutral-400 pt-0.5">
          <span>{progress.completedCount} of 5 Complete</span>
          <span>5 Required Docs</span>
        </div>

        {/* READY FOR COA BANNER */}
        {progress.isReadyForCOA && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-lg flex items-center justify-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold text-[11px] shadow-xs"
          >
            <FileCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-bounce" />
            <span>✔ READY FOR COA</span>
          </motion.div>
        )}
      </div>

      {/* VERTICAL TIMELINE STAGE FLOW */}
      <div className="relative pl-2.5 space-y-2.5 pt-1">
        {/* VERTICAL CONNECTOR LINE */}
        <div className="absolute left-[18px] top-3 bottom-5 w-0.5 bg-gray-200 dark:bg-neutral-800 z-0" />

        {progress.steps.map((step) => {
          const locked = isStepLocked(step.key);

          // Node styling & State Priority Badges
          let nodeBg = "bg-gray-100 dark:bg-neutral-800 text-gray-400 border-gray-300 dark:border-neutral-700";
          let statusText = "○ Waiting";
          let statusColor = "text-gray-400 dark:text-neutral-500 font-medium";

          if (locked) {
            nodeBg = "bg-amber-100 text-amber-700 border-amber-300";
            statusText = "🔒 Locked";
            statusColor = "text-amber-600";
          } else if (step.isCompleted) {
            nodeBg = "bg-emerald-500 text-white border-emerald-600 shadow-xs";
            statusText = "✔ Completed";
            statusColor = "text-emerald-600 dark:text-emerald-400 font-bold";
          } else if (step.status === "in_progress") {
            nodeBg = "bg-amber-500 text-white border-amber-600 shadow-xs animate-pulse";
            statusText = "🟡 In Progress";
            statusColor = "text-amber-600 dark:text-amber-400 font-bold";
          }

          return (
            <div
              key={step.key}
              className="relative z-10"
              onMouseEnter={() => setHoveredStepKey(step.key)}
              onMouseLeave={() => setHoveredStepKey(null)}
            >
              <div
                onClick={() => onStepClick(step)}
                tabIndex={locked ? -1 : 0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onStepClick(step);
                  }
                }}
                className={`group flex items-center gap-2.5 p-2.5 rounded-xl border transition-all duration-200 ease-in-out cursor-pointer hover:shadow-xs ${
                  step.isCurrent
                    ? "bg-amber-50/60 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/80 shadow-xs hover:border-amber-400"
                    : step.isCompleted
                    ? "bg-emerald-50/30 dark:bg-emerald-950/20 border-gray-100 dark:border-slate-800 hover:border-emerald-300"
                    : "bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 hover:border-smei-crimson/40 dark:hover:border-red-500/40 hover:bg-red-50/50 dark:hover:bg-red-950/20"
                }`}
                role="button"
                aria-label={`${step.stepNumber}. ${step.title}: ${statusText}`}
              >
                {/* NODE ICON */}
                <div
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[11px] font-bold shrink-0 transition-transform duration-200 ease-in-out group-hover:scale-105 ${nodeBg}`}
                >
                  {locked ? (
                    <Lock className="w-3 h-3" />
                  ) : step.isCompleted ? (
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  ) : step.status === "in_progress" ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <span className="font-mono text-[10px]">{step.stepNumber}</span>
                  )}
                </div>

                {/* TEXT CONTENT */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-[11px] font-bold text-gray-900 dark:text-white truncate font-display group-hover:text-smei-crimson dark:group-hover:text-red-400 transition-colors duration-200">
                      {step.stepNumber}. {step.title}
                    </h4>
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0 ${statusColor}`}
                    >
                      {statusText}
                    </span>
                  </div>

                  <p
                    className="text-[10px] text-gray-500 dark:text-neutral-400 truncate"
                    title={step.subtitle}
                  >
                    {step.subtitle}
                  </p>

                  <div className="flex items-center justify-end text-[9px] text-gray-400 dark:text-neutral-500 font-mono">
                    <span className="shrink-0">{step.formattedDate}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ENTERPRISE BULK EXPORT */}
      <div className="pt-3 border-t border-gray-100 dark:border-neutral-800 mt-2">
        <button
          type="button"
          onClick={handleBulkExport}
          disabled={!progress.isReadyForCOA || isExporting}
          className={`w-full flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all duration-300 font-bold text-xs ${
            progress.isReadyForCOA && !isExporting
              ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-md hover:shadow-lg cursor-pointer transform hover:scale-[1.02] active:scale-95"
              : "bg-gray-100 dark:bg-neutral-800 text-gray-400 border-gray-200 dark:border-neutral-700 cursor-not-allowed opacity-80"
          }`}
          title={
            !progress.isReadyForCOA
              ? "Complete all required documents before exporting."
              : "Export complete COA package"
          }
        >
          <div className="flex items-center gap-2">
            {isExporting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span className="uppercase tracking-wider font-display">
              Export Complete COA Package
            </span>
          </div>
          {isExporting && exportStatus && (
            <span className="text-[10px] font-mono text-emerald-100 animate-pulse">
              {exportStatus}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

export default COAWorkflowTracker;
