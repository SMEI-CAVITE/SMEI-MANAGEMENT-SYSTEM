import { useState, useEffect, useMemo, useCallback } from "react";
import { COAWorkflowProgress, COAWorkflowStep, COAWorkflowStepKey } from "../types/workflow";
import { normalizeControlNo, getTrackingCode } from "../utils/controlNumber";
import {
  getAllWorkflows,
  getActiveWorkflow,
  getActiveWorkflowId,
  setActiveWorkflow,
  syncAllWorkflowsWithStorage,
  isDraftWorkflowId,
  WorkflowRecord
} from "../utils/workflowManager";
import { WorkflowRepository } from "../services/workflowRepository";

/**
 * Custom React Hook: Real-Time COA Workflow Progress Tracker
 * Centralized Firestore-Driven Workflow Engine
 */
export function useCOAWorkflowTracker(
  activeTabProp?: string,
  userRole?: string
) {
  const activeTab = activeTabProp || localStorage.getItem("tsd_current_active_module") || "control-no";

  useEffect(() => {
    if (activeTabProp) {
      try {
        localStorage.setItem("tsd_current_active_module", activeTabProp);
      } catch (e) {
        console.warn("Failed to persist current active module:", e);
      }
    }
  }, [activeTabProp]);

  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());

  // Firestore real-time collection states
  const [firestoreWorkflows, setFirestoreWorkflows] = useState<WorkflowRecord[]>([]);
  const [complianceDocs, setComplianceDocs] = useState<any[]>([]);
  const [manifestRecords, setManifestRecords] = useState<any[]>([]);
  const [unloadingRecords, setUnloadingRecords] = useState<any[]>([]);
  const [hazWasteRecords, setHazWasteRecords] = useState<any[]>([]);
  const [wasteMovements, setWasteMovements] = useState<any[]>([]);
  const [timestampRecords, setTimestampRecords] = useState<any[]>([]);

  // Local Storage Data Hydration Fallback
  const loadLocalStorageData = useCallback(() => {
    try {
      // 1. Control No / Compliance Docs
      const rawCompDocs = localStorage.getItem("tsd_uploaded_compliance_docs");
      const docs = rawCompDocs ? JSON.parse(rawCompDocs) : [];
      setComplianceDocs(Array.isArray(docs) ? docs : []);

      // 2. Manifests
      const rawManifests = localStorage.getItem("tsd_manifests");
      const manifests = rawManifests ? JSON.parse(rawManifests) : [];
      setManifestRecords(Array.isArray(manifests) ? manifests : []);

      // 3. Unloading / Loading
      const rawUnloading = localStorage.getItem("tsd_compliance_records");
      const unloading = rawUnloading ? JSON.parse(rawUnloading) : [];
      setUnloadingRecords(Array.isArray(unloading) ? unloading : []);

      // 4. Hazardous Waste
      const rawHazWaste = localStorage.getItem("tsd_hazwaste_records");
      const hazwaste = rawHazWaste ? JSON.parse(rawHazWaste) : [];
      setHazWasteRecords(Array.isArray(hazwaste) ? hazwaste : []);

      // 5. Waste Movement
      const rawMovement = localStorage.getItem("tsd_waste_movements");
      const movements = rawMovement ? JSON.parse(rawMovement) : [];
      setWasteMovements(Array.isArray(movements) ? movements : []);

      // 6. Timestamp Timeline
      const rawTimestamps = localStorage.getItem("tsd_timestamp_records");
      const timestamps = rawTimestamps ? JSON.parse(rawTimestamps) : [];
      setTimestampRecords(Array.isArray(timestamps) ? timestamps : []);

      setLastUpdated(new Date().toISOString());
      setError(null);
    } catch (e: any) {
      console.error("[COA Workflow Tracker] Error parsing storage data:", e);
      setError("Unable to load workflow.");
    }
  }, []);

  // Firestore Real-time Snapshot Subscription Effect
  useEffect(() => {
    try {
      syncAllWorkflowsWithStorage();
    } catch (e) {
      console.warn("Initial workflow sync skipped:", e);
    }

    loadLocalStorageData();

    // Subscribe to Firestore Real-time Snapshot Listeners (onSnapshot)
    const unsubscribeAll = WorkflowRepository.subscribeToCOATrackingData(
      (data) => {
        if (data.workflows && data.workflows.length > 0) {
          setFirestoreWorkflows(data.workflows);
        }
        if (data.complianceDocs) setComplianceDocs(data.complianceDocs);
        if (data.manifestRecords) setManifestRecords(data.manifestRecords);
        if (data.unloadingRecords) setUnloadingRecords(data.unloadingRecords);
        if (data.hazWasteRecords) setHazWasteRecords(data.hazWasteRecords);
        if (data.wasteMovements) setWasteMovements(data.wasteMovements);
        if (data.timestampRecords) setTimestampRecords(data.timestampRecords);

        setLastUpdated(new Date().toISOString());
        setError(null);
      },
      (err) => {
        console.warn("[COA Workflow Tracker] Real-time listener fallback to local cache:", err);
      }
    );

    // Fallback storage listeners for single-browser offline mode
    const handleStorageChange = () => {
      loadLocalStorageData();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("tsd_data_changed", handleStorageChange);
    window.addEventListener("tsd_storage_updated", handleStorageChange);
    window.addEventListener("tsd_workflows_updated", handleStorageChange);

    return () => {
      unsubscribeAll();
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("tsd_data_changed", handleStorageChange);
      window.removeEventListener("tsd_storage_updated", handleStorageChange);
      window.removeEventListener("tsd_workflows_updated", handleStorageChange);
    };
  }, [loadLocalStorageData]);

  // Derive all active Workflows list (combining real-time Firestore and local fallback)
  const availableWorkflows = useMemo(() => {
    const localList = getAllWorkflows();
    const map = new Map<string, WorkflowRecord>();

    // Add local workflows first
    localList.forEach((w) => {
      if (w && w.id) map.set(w.id, w);
    });

    // Add/override with real-time Firestore workflows
    firestoreWorkflows.forEach((w) => {
      if (w && w.id) map.set(w.id, w);
    });

    const combined = Array.from(map.values());
    return combined.map((w) => {
      const controlText = w.controlNo ? w.controlNo : "Not Assigned Yet";
      const label = `${w.id} (Control No: ${controlText})`;
      return {
        id: w.id,
        controlNo: w.controlNo,
        label
      };
    });
  }, [firestoreWorkflows, lastUpdated]);

  // Derive unique list of available Control Numbers
  const availableControlNumbers = useMemo(() => {
    const set = new Set<string>();
    availableWorkflows.forEach((w) => {
      if (w.controlNo) set.add(w.controlNo);
    });
    return Array.from(set).sort();
  }, [availableWorkflows]);

  // Derive active workflow object directly from workflowManager (single source of truth)
  const activeWorkflow: WorkflowRecord | null = useMemo(() => {
    const localList = getAllWorkflows();
    const map = new Map<string, WorkflowRecord>();
    localList.forEach((w) => {
      if (w && w.id) map.set(w.id, w);
    });
    firestoreWorkflows.forEach((w) => {
      if (w && w.id) map.set(w.id, w);
    });

    const all = Array.from(map.values());
    const activeId = getActiveWorkflowId();
    if (activeId) {
      const found = all.find((w) => w.id === activeId);
      if (found) return found;
    }

    const activeControlNo = localStorage.getItem("tsd_active_control_no");
    if (activeControlNo) {
      const norm = normalizeControlNo(activeControlNo);
      const found = all.find((w) => w.controlNo && normalizeControlNo(w.controlNo) === norm);
      if (found) return found;
    }

    if (all.length > 0) {
      return all[all.length - 1];
    }

    return getActiveWorkflow();
  }, [firestoreWorkflows, lastUpdated]);

  // Compute 5 Workflow Steps for the Active Workflow
  const progress: COAWorkflowProgress = useMemo(() => {
    const currentWf = activeWorkflow;
    const currentWfId = currentWf?.id || "WF-PENDING";
    const currentControlNo = currentWf?.controlNo || "";
    const standardizedSubtitle = currentControlNo
      ? `Control No: ${currentControlNo}`
      : "Control No: Not Assigned Yet";

    const formatDate = (dateVal: any) => {
      if (!dateVal) return "Today";
      try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return String(dateVal);
        return d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric"
        });
      } catch {
        return String(dateVal);
      }
    };

    const isMatch = (doc: any, stepKey: COAWorkflowStepKey) => {
      if (!doc || !currentWf) return false;

      // 1. Check if expectedDocId exists in currentWf.documentIds for this stepKey
      const expectedDocId =
        currentWf.documentIds?.[stepKey] ||
        (currentWf.documentIds as any)?.[stepKey.replace("-", "")] ||
        (stepKey === "control-no" ? currentWf.documentIds?.controlNumber : undefined) ||
        (stepKey === "unloading-loading" ? currentWf.documentIds?.unloadingLoading : undefined) ||
        (stepKey === "hazardous-waste" ? currentWf.documentIds?.hazardousWaste : undefined) ||
        (stepKey === "waste-movement" ? currentWf.documentIds?.wasteMovement : undefined);

      if (expectedDocId && (doc.id === expectedDocId || doc.docId === expectedDocId)) {
        return true;
      }

      // 2. Match by explicit workflowId property on document
      if (doc.workflowId && doc.workflowId === currentWf.id) {
        return true;
      }

      // 3. Fallback match by normalized control number IF workflow is not draft and control number matches
      if (currentWf.controlNo && !isDraftWorkflowId(currentWf.id)) {
        const normWfCode = normalizeControlNo(currentWf.controlNo);
        const docCode = getTrackingCode(doc);
        if (docCode && normalizeControlNo(docCode) === normWfCode) {
          return true;
        }
      }

      return false;
    };

    // 1. Control Number Step
    const matchedCompDoc = complianceDocs.find((d) => isMatch(d, "control-no"));
    const matchedManifest = manifestRecords.find((m) => isMatch(m, "control-no"));
    const hasControlNoDoc = Boolean(matchedCompDoc || matchedManifest);

    const step1: COAWorkflowStep = {
      key: "control-no",
      stepNumber: 1,
      title: "Control Number",
      subtitle: standardizedSubtitle,
      status: hasControlNoDoc ? "completed" : activeTab === "control-no" ? "in_progress" : "pending",
      isCompleted: hasControlNoDoc,
      isCurrent: activeTab === "control-no",
      documentNumber: matchedCompDoc?.caNumber || matchedCompDoc?.controlNo || matchedManifest?.manifestNo || (hasControlNoDoc ? (currentControlNo || "Recorded") : "Not Assigned Yet"),
      timestamp: matchedCompDoc?.uploadedAt || matchedManifest?.createdAt,
      formattedDate: (matchedCompDoc?.uploadedAt || matchedManifest?.createdAt) ? formatDate(matchedCompDoc?.uploadedAt || matchedManifest?.createdAt) : "Pending",
      createdBy: matchedCompDoc?.uploadedBy || (matchedManifest ? "Documentation Staff" : "Compliance Staff"),
      updatedAt: matchedCompDoc?.uploadedAt || matchedManifest?.createdAt,
      details: {
        fileName: matchedCompDoc?.fileName || (matchedManifest ? `Manifest: ${matchedManifest.manifestNo}` : "Regulatory Manifest PDF"),
        caNumber: matchedCompDoc?.caNumber || matchedManifest?.manifestNo || (hasControlNoDoc ? (currentControlNo || "Recorded") : "Not Assigned Yet")
      }
    };

    // 2. Unloading / Loading Step
    const matchedUnloading = unloadingRecords.find((r) => isMatch(r, "unloading-loading"));
    const hasUnloading = Boolean(matchedUnloading);

    const step2: COAWorkflowStep = {
      key: "unloading-loading",
      stepNumber: 2,
      title: "Unloading / Loading",
      subtitle: standardizedSubtitle,
      status: hasUnloading ? "completed" : activeTab === "unloading-loading" ? "in_progress" : "pending",
      isCompleted: hasUnloading,
      isCurrent: activeTab === "unloading-loading",
      documentNumber: matchedUnloading?.caNumber || matchedUnloading?.controlNo || (hasUnloading ? (currentControlNo || "Recorded") : "Not Assigned Yet"),
      timestamp: matchedUnloading?.deliveryDate || matchedUnloading?.createdAt,
      formattedDate: (matchedUnloading?.deliveryDate || matchedUnloading?.createdAt) ? formatDate(matchedUnloading?.deliveryDate || matchedUnloading?.createdAt) : "Pending",
      createdBy: matchedUnloading?.createdBy || "Weighing Scale Inspector",
      updatedAt: matchedUnloading?.updatedAt || matchedUnloading?.deliveryDate,
      details: {
        cargoType: matchedUnloading?.cargoType || "Raw Industrial Scrap",
        grossWeight: matchedUnloading?.grossWeight || "Recorded"
      }
    };

    // 3. Hazardous Waste Step
    const matchedHazWaste = hazWasteRecords.find((r) => isMatch(r, "hazardous-waste"));
    const hasHazWaste = Boolean(matchedHazWaste);

    const step3: COAWorkflowStep = {
      key: "hazardous-waste",
      stepNumber: 3,
      title: "Hazardous Waste",
      subtitle: standardizedSubtitle,
      status: hasHazWaste ? "completed" : activeTab === "hazardous-waste" ? "in_progress" : "pending",
      isCompleted: hasHazWaste,
      isCurrent: activeTab === "hazardous-waste",
      documentNumber: matchedHazWaste?.manifestNo || matchedHazWaste?.controlNo || (hasHazWaste ? (currentControlNo || "Recorded") : "Not Assigned Yet"),
      timestamp: matchedHazWaste?.createdAt,
      formattedDate: matchedHazWaste?.createdAt ? formatDate(matchedHazWaste?.createdAt) : "Pending",
      createdBy: matchedHazWaste?.preparedBy || "Documentation Staff",
      updatedAt: matchedHazWaste?.updatedAt || matchedHazWaste?.createdAt,
      details: {
        wasteClass: matchedHazWaste?.wasteName || "Standard HazWaste",
        quantity: matchedHazWaste?.quantity || "Verified"
      }
    };

    // 4. Waste Movement Step
    const matchedMovement = wasteMovements.find((r) => isMatch(r, "waste-movement"));
    const hasMovement = Boolean(matchedMovement);

    const step4: COAWorkflowStep = {
      key: "waste-movement",
      stepNumber: 4,
      title: "Waste Movement",
      subtitle: standardizedSubtitle,
      status: hasMovement ? "completed" : activeTab === "waste-movement" ? "in_progress" : "pending",
      isCompleted: hasMovement,
      isCurrent: activeTab === "waste-movement",
      documentNumber: matchedMovement?.controlNo || (hasMovement ? (currentControlNo || "Recorded") : "Not Assigned Yet"),
      timestamp: matchedMovement?.createdAt,
      formattedDate: matchedMovement?.createdAt ? formatDate(matchedMovement?.createdAt) : "Pending",
      createdBy: matchedMovement?.createdBy || "Plant Movement Officer",
      updatedAt: matchedMovement?.updatedAt || matchedMovement?.createdAt,
      details: {
        sourceDoc: matchedMovement?.sourceFileName || "COA Verified",
        storageLoc: matchedMovement?.storageLocation || "Processing Yard"
      }
    };

    // 5. Time Stamp Step
    const matchedTimestamp = timestampRecords.find((r) => isMatch(r, "timestamp"));
    const hasTimestamp = Boolean(matchedTimestamp);

    const step5: COAWorkflowStep = {
      key: "timestamp",
      stepNumber: 5,
      title: "Time Stamp",
      subtitle: standardizedSubtitle,
      status: hasTimestamp ? "completed" : activeTab === "timestamp" ? "in_progress" : "pending",
      isCompleted: hasTimestamp,
      isCurrent: activeTab === "timestamp",
      documentNumber: matchedTimestamp?.caNumber || matchedTimestamp?.controlNo || (hasTimestamp ? (currentControlNo || "Recorded") : "Not Assigned Yet"),
      timestamp: matchedTimestamp?.timestamp || matchedTimestamp?.createdAt,
      formattedDate: (matchedTimestamp?.timestamp || matchedTimestamp?.createdAt) ? formatDate(matchedTimestamp?.timestamp || matchedTimestamp?.createdAt) : "Pending",
      createdBy: matchedTimestamp?.createdBy || "Audit SLA Verification",
      updatedAt: matchedTimestamp?.updatedAt || matchedTimestamp?.createdAt,
      details: {
        photoAttached: Boolean(matchedTimestamp?.photoData),
        slaStatus: "Verified compliant"
      }
    };

    const steps = [step1, step2, step3, step4, step5];
    const completedCount = steps.filter((s) => s.isCompleted).length;
    const totalCount = 5;
    const percentage = Math.round((completedCount / totalCount) * 100);
    const isReadyForCOA = completedCount === totalCount;

    return {
      workflowId: currentWfId,
      selectedControlNo: currentControlNo,
      availableControlNumbers,
      availableWorkflows,
      completedCount,
      totalCount,
      percentage,
      isReadyForCOA,
      steps,
      lastUpdated
    };
  }, [
    activeWorkflow,
    availableControlNumbers,
    availableWorkflows,
    complianceDocs,
    manifestRecords,
    unloadingRecords,
    hazWasteRecords,
    wasteMovements,
    timestampRecords,
    activeTab,
    lastUpdated
  ]);

  const selectControlNo = useCallback((value: string) => {
    if (!value) return;
    const all = getAllWorkflows();
    // Check if value is workflow ID
    const foundWf = all.find((w) => w.id === value || (w.controlNo && normalizeControlNo(w.controlNo) === normalizeControlNo(value)));
    if (foundWf) {
      setActiveWorkflow(foundWf.id, foundWf.controlNo);
    } else {
      setActiveWorkflow(value, value);
    }
    setLastUpdated(new Date().toISOString());
  }, []);

  const selectWorkflow = useCallback((workflowId: string) => {
    setActiveWorkflow(workflowId);
    setLastUpdated(new Date().toISOString());
  }, []);

  const refreshData = useCallback(() => {
    loadLocalStorageData();
  }, [loadLocalStorageData]);

  return {
    progress,
    selectedControlNo: activeWorkflow?.controlNo || "",
    activeWorkflowId: activeWorkflow?.id || "",
    selectControlNo,
    selectWorkflow,
    availableControlNumbers,
    availableWorkflows,
    refreshData,
    error
  };
}
