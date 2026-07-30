/**
 * Centralized Workflow Manager
 * SMEI TSD Portal Compliance Engine
 *
 * Implements Workflow-First Architecture (Workflow -> 5 Child Documents)
 * The Workflow is the Single Source of Truth for all compliance processes.
 */

import { COAWorkflowStepKey, WorkflowRecord } from "../types/workflow";
export type { WorkflowRecord };
import { normalizeControlNo, getTrackingCode } from "./controlNumber";
import { safeSetLocalStorage } from "./heavyStorage";

import { WorkflowRepository } from "../services/workflowRepository";
import { notificationRepository } from "../services/notificationRepository";

export const WORKFLOWS_STORAGE_KEY = "tsd_workflows";
export const ACTIVE_WORKFLOW_ID_KEY = "tsd_active_workflow_id";
export const ACTIVE_CONTROL_NO_KEY = "tsd_active_control_no";
export const DRAFT_WORKFLOW_ID = "WF-DRAFT";

let lastSavedWorkflowsJson = "";

export interface WorkflowCreatePayload {
  title: string;
  description?: string;
  department?: string;
  site?: string;
  preparedBy?: string;
  remarks?: string;
}

/**
 * Helper to check if a Workflow ID represents an unassigned draft workflow.
 */
export function isDraftWorkflowId(id?: string): boolean {
  if (!id) return false;
  return (
    id === DRAFT_WORKFLOW_ID ||
    id === "DRAFT" ||
    id === "WF-PENDING" ||
    id === "WF-FALLBACK" ||
    id.startsWith("DRAFT-")
  );
}

/**
 * Generate a new unique, sequential Workflow ID (e.g. WF-2026-000001)
 * Calculates sequence safely from maximum existing WF-YYYY-XXXXXX number in storage.
 */
export function generateWorkflowId(): string {
  const year = new Date().getFullYear();
  const yearPrefix = `WF-${year}-`;
  let maxSeq = 0;

  try {
    const raw = localStorage.getItem(WORKFLOWS_STORAGE_KEY);
    const workflows: WorkflowRecord[] = raw ? JSON.parse(raw) : [];

    for (const w of workflows) {
      if (w && w.id && !isDraftWorkflowId(w.id)) {
        if (w.id.startsWith(yearPrefix)) {
          const numStr = w.id.replace(yearPrefix, "");
          const num = parseInt(numStr, 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
        if (w.workflowCode && w.workflowCode.startsWith(yearPrefix)) {
          const numStr = w.workflowCode.replace(yearPrefix, "");
          const num = parseInt(numStr, 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    }
  } catch (err) {
    console.warn("Error calculating max sequence for workflow ID:", err);
  }

  const seq = String(maxSeq + 1).padStart(6, "0");
  return `WF-${year}-${seq}`;
}

/**
 * Verify if a workflow is real and has at least one saved document or linked control number.
 */
export function hasSavedDocumentsOrControlNo(w: WorkflowRecord): boolean {
  if (!w || isDraftWorkflowId(w.id)) return false;

  if (w.documentIds) {
    const keys = Object.keys(w.documentIds);
    if (keys.some((k) => Boolean((w.documentIds as any)[k]))) {
      return true;
    }
  }

  if (w.controlNo) return true;

  const collections = [
    "tsd_uploaded_compliance_docs",
    "tsd_manifests",
    "tsd_compliance_records",
    "tsd_hazwaste_records",
    "tsd_waste_movements",
    "tsd_timestamp_records"
  ];

  for (const key of collections) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const records = JSON.parse(raw);
        if (Array.isArray(records) && records.some((r: any) => r && r.workflowId === w.id)) {
          return true;
        }
      }
    } catch {
      // ignore
    }
  }

  return false;
}

/**
 * Get all stored real workflows from LocalStorage
 */
export function getAllWorkflows(): WorkflowRecord[] {
  try {
    const raw = localStorage.getItem(WORKFLOWS_STORAGE_KEY);
    const list: WorkflowRecord[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];

    // Deduplicate workflows and filter out unsaved draft / empty orphaned workflows
    const seen = new Set<string>();
    const unique: WorkflowRecord[] = [];
    for (const item of list) {
      if (item && item.id && !isDraftWorkflowId(item.id) && !seen.has(item.id)) {
        if (hasSavedDocumentsOrControlNo(item)) {
          seen.add(item.id);
          unique.push(item);
        }
      }
    }
    return unique;
  } catch (err) {
    console.error("Failed to parse tsd_workflows:", err);
    return [];
  }
}

/**
 * Save workflows list to LocalStorage safely without infinite event loops & sync to Firestore
 */
export function saveWorkflows(workflows: WorkflowRecord[]): void {
  try {
    const seen = new Set<string>();
    const cleanList: WorkflowRecord[] = [];
    for (const w of workflows) {
      if (w && w.id && !seen.has(w.id)) {
        seen.add(w.id);
        cleanList.push(w);
      }
    }

    const json = JSON.stringify(cleanList);
    if (json !== lastSavedWorkflowsJson) {
      safeSetLocalStorage(WORKFLOWS_STORAGE_KEY, json);
      lastSavedWorkflowsJson = json;
      window.dispatchEvent(new Event("tsd_workflows_updated"));
    }

    // Async batch write to Firestore in real-time
    WorkflowRepository.saveWorkflowsBatch(cleanList).catch((err) => {
      console.warn("[WorkflowManager] Firestore saveWorkflowsBatch notice:", err);
    });
  } catch (err) {
    console.warn("Failed to save tsd_workflows:", err);
  }
}

/**
 * Get the current active draft workflow object or create a default draft object.
 */
export function getDraftWorkflow(): WorkflowRecord {
  try {
    const raw = localStorage.getItem("tsd_draft_workflow_data");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id && isDraftWorkflowId(parsed.id)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Error reading draft workflow data:", e);
  }

  const now = new Date().toISOString();
  return {
    id: DRAFT_WORKFLOW_ID,
    workflowCode: "Not Assigned Yet",
    title: "New Draft COA Workflow",
    status: "draft",
    isDraft: true,
    createdAt: now,
    updatedAt: now,
    completion: 0,
    documentIds: {}
  };
}

/**
 * Get active workflow ID from storage
 */
export function getActiveWorkflowId(): string {
  return localStorage.getItem(ACTIVE_WORKFLOW_ID_KEY) || "";
}

/**
 * Get active workflow object
 */
export function getActiveWorkflow(): WorkflowRecord | null {
  const activeId = getActiveWorkflowId();
  const workflows = getAllWorkflows();

  if (isDraftWorkflowId(activeId)) {
    return getDraftWorkflow();
  }

  if (activeId) {
    const found = workflows.find((w) => w.id === activeId);
    if (found) return found;
  }

  // Check if active draft data exists
  try {
    const draftRaw = localStorage.getItem("tsd_draft_workflow_data");
    if (draftRaw) {
      const parsed = JSON.parse(draftRaw);
      if (parsed && parsed.id && isDraftWorkflowId(parsed.id)) {
        return parsed;
      }
    }
  } catch (e) {
    // ignore
  }

  const activeControlNo = localStorage.getItem(ACTIVE_CONTROL_NO_KEY);
  if (activeControlNo) {
    const norm = normalizeControlNo(activeControlNo);
    const found = workflows.find((w) => w.controlNo && normalizeControlNo(w.controlNo) === norm);
    if (found) return found;
  }

  if (workflows.length > 0) {
    return workflows[workflows.length - 1];
  }

  return null;
}

/**
 * Set active workflow explicitly
 */
export function setActiveWorkflow(workflowId: string, controlNo?: string): void {
  try {
    localStorage.setItem(ACTIVE_WORKFLOW_ID_KEY, workflowId);
    if (controlNo) {
      localStorage.setItem(ACTIVE_CONTROL_NO_KEY, normalizeControlNo(controlNo));
    } else {
      const workflows = getAllWorkflows();
      const target = workflows.find((w) => w.id === workflowId);
      if (target?.controlNo) {
        localStorage.setItem(ACTIVE_CONTROL_NO_KEY, normalizeControlNo(target.controlNo));
      } else {
        localStorage.removeItem(ACTIVE_CONTROL_NO_KEY);
      }
    }
    window.dispatchEvent(new Event("tsd_workflows_updated"));
    window.dispatchEvent(new Event("tsd_data_changed"));
    window.dispatchEvent(new Event("tsd_storage_updated"));
  } catch (err) {
    console.warn("Failed to set active workflow:", err);
  }
}

/**
 * Create a brand new Draft COA Workflow explicitly from "+ New COA Workflow".
 * Does NOT generate a permanent Workflow ID or persist an empty record until the first document is saved.
 */
export function createNewWorkflow(payload?: Partial<WorkflowCreatePayload>): WorkflowRecord {
  const now = new Date().toISOString();

  const draftWorkflow: WorkflowRecord = {
    id: DRAFT_WORKFLOW_ID,
    workflowCode: "Not Assigned Yet",
    title: payload?.title || "New Draft COA Workflow",
    description: payload?.description || "",
    department: payload?.department || "TSD / Compliance Operations",
    site: payload?.site || "SMEI Main Facility",
    preparedBy: payload?.preparedBy || "",
    remarks: payload?.remarks || "",
    status: "draft",
    isDraft: true,
    createdAt: now,
    updatedAt: now,
    completion: 0,
    documentIds: {}
  };

  try {
    safeSetLocalStorage("tsd_draft_workflow_data", JSON.stringify(draftWorkflow));
  } catch (e) {
    console.warn("Failed to persist draft workflow data:", e);
  }

  setActiveWorkflow(DRAFT_WORKFLOW_ID);

  window.dispatchEvent(new Event("tsd_workflows_updated"));
  window.dispatchEvent(new Event("tsd_data_changed"));

  return draftWorkflow;
}

/**
 * Helper to propagate Control Number to all local document records belonging to a workflow
 */
export function propagateControlNoToWorkflowDocs(workflowId: string, controlNo: string): void {
  if (!workflowId || !controlNo || isDraftWorkflowId(workflowId)) return;
  const norm = normalizeControlNo(controlNo);

  const updateCollection = (key: string, caField: string) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return;
      let modified = false;
      const updated = list.map((item: any) => {
        if (item && item.workflowId === workflowId) {
          if (!item[caField] || normalizeControlNo(item[caField]) !== norm) {
            item[caField] = norm;
            if (caField === "caNumber") item.controlNo = norm;
            if (caField === "controlNo") item.caNumber = norm;
            modified = true;
          }
        }
        return item;
      });
      if (modified) {
        safeSetLocalStorage(key, JSON.stringify(updated));
      }
    } catch (err) {
      console.warn(`Failed to propagate controlNo to ${key}:`, err);
    }
  };

  updateCollection("tsd_compliance_records", "caNumber");
  updateCollection("tsd_hazwaste_records", "controlNo");
  updateCollection("tsd_waste_movements", "controlNo");
  updateCollection("tsd_timestamp_records", "controlNo");
  updateCollection("tsd_uploaded_compliance_docs", "caNumber");
  updateCollection("tsd_manifests", "controlNo");
}

export interface AttachWorkflowOptions {
  setAsActive?: boolean;
  preserveActiveWorkflow?: boolean;
}

/**
 * Attach a newly created document to active Workflow.
 * Generates official sequential Workflow ID atomically on the FIRST document save.
 */
export function attachRecordToWorkflow(
  moduleKey: COAWorkflowStepKey,
  record: any,
  extractedControlNo?: string,
  options?: AttachWorkflowOptions
): WorkflowRecord {
  const workflows = getAllWorkflows();
  const activeWf = getActiveWorkflow();
  const rawCode = extractedControlNo || (record ? getTrackingCode(record) : "");
  const normCode = rawCode ? normalizeControlNo(rawCode) : "";

  let targetWf: WorkflowRecord | null = null;

  // 1. Edit Mode: Preserve existing workflowId if present on document
  if (record && record.workflowId && !isDraftWorkflowId(record.workflowId)) {
    targetWf = workflows.find((w) => w.id === record.workflowId) || null;
  }

  // 2. Otherwise use Active Workflow from Tracking Panel
  if (!targetWf) {
    if (activeWf) {
      targetWf = activeWf;
    }
  }

  // 3. Validation: If no active workflow exists, throw error to block save
  if (!targetWf) {
    throw new Error("No active workflow is selected. Please select or create a workflow before saving this document.");
  }

  // 4. Draft Workflow Promotion on First Document Save
  let isNewWorkflowCreation = false;
  if (isDraftWorkflowId(targetWf.id)) {
    isNewWorkflowCreation = true;
    const newWfId = generateWorkflowId();
    const now = new Date().toISOString();

    const draftData = targetWf;

    targetWf = {
      id: newWfId,
      workflowCode: newWfId,
      title: draftData.title && draftData.title !== "New Draft COA Workflow"
        ? draftData.title
        : (normCode ? `Workflow ${normCode}` : `Workflow ${newWfId}`),
      description: draftData.description || "",
      department: draftData.department || "TSD / Compliance Operations",
      site: draftData.site || "SMEI Main Facility",
      preparedBy: draftData.preparedBy || "",
      remarks: draftData.remarks || "",
      status: "active",
      controlNo: normCode || undefined,
      createdAt: now,
      updatedAt: now,
      completion: 20,
      documentIds: {}
    };

    try {
      localStorage.removeItem("tsd_draft_workflow_data");
    } catch (e) {
      // ignore
    }

    // Generate TSD Notification for official COA Workflow creation
    notificationRepository.createNotification({
      portal: "TSD",
      module: "COA Workflow",
      workflowId: targetWf.id,
      title: "COA Workflow Created",
      message: `New COA Workflow ${targetWf.workflowCode || targetWf.id} officially created upon first document save.`,
      priority: "MEDIUM"
    }).catch(() => {});
  }

  const docId = record?.id || record?.docId || String(Date.now());
  if (record) {
    record.workflowId = targetWf.id;
  }

  // Update documentIds map with both alias keys for complete compatibility
  if (!targetWf.documentIds) targetWf.documentIds = {};

  if (moduleKey === "control-no") {
    targetWf.documentIds.controlNumber = docId;
    targetWf.documentIds["control-no"] = docId;
  } else if (moduleKey === "unloading-loading") {
    targetWf.documentIds.unloadingLoading = docId;
    targetWf.documentIds["unloading-loading"] = docId;
  } else if (moduleKey === "hazardous-waste") {
    targetWf.documentIds.hazardousWaste = docId;
    targetWf.documentIds["hazardous-waste"] = docId;
  } else if (moduleKey === "waste-movement") {
    targetWf.documentIds.wasteMovement = docId;
    targetWf.documentIds["waste-movement"] = docId;
  } else if (moduleKey === "timestamp") {
    targetWf.documentIds.timestamp = docId;
  }

  // Assign/preserve control number on targetWf
  if (normCode) {
    if (!targetWf.controlNo || moduleKey === "control-no") {
      targetWf.controlNo = normCode;
    }
    if (targetWf.status === "draft") {
      targetWf.status = "active";
    }
    if (record) {
      if (!record.caNumber) record.caNumber = normCode;
      if (!record.controlNo) record.controlNo = normCode;
    }
    propagateControlNoToWorkflowDocs(targetWf.id, targetWf.controlNo);
  }

  // Recalculate completion percentage & status across 5 steps
  const stepKeys: COAWorkflowStepKey[] = [
    "control-no",
    "unloading-loading",
    "hazardous-waste",
    "waste-movement",
    "timestamp"
  ];
  let completedStepsCount = 0;
  stepKeys.forEach((k) => {
    if (
      targetWf!.documentIds?.[k] ||
      (k === "control-no" && targetWf!.documentIds?.controlNumber) ||
      (k === "unloading-loading" && targetWf!.documentIds?.unloadingLoading) ||
      (k === "hazardous-waste" && targetWf!.documentIds?.hazardousWaste) ||
      (k === "waste-movement" && targetWf!.documentIds?.wasteMovement) ||
      (k === "timestamp" && targetWf!.documentIds?.timestamp)
    ) {
      completedStepsCount++;
    }
  });

  targetWf.completion = Math.round((completedStepsCount / 5) * 100);
  if (completedStepsCount === 5) {
    targetWf.status = "completed";
  } else if (targetWf.status === "draft") {
    targetWf.status = "active";
  }

  targetWf.updatedAt = new Date().toISOString();

  const idx = workflows.findIndex((w) => w.id === targetWf!.id);
  if (idx >= 0) {
    workflows[idx] = targetWf;
  } else {
    workflows.push(targetWf);
  }

  saveWorkflows(workflows);

  // Sync child record & workflow document to Firestore atomically
  WorkflowRepository.attachRecordToWorkflowInFirestore(moduleKey, record, targetWf).catch((err) => {
    console.warn("[WorkflowManager] Firestore attachRecordToWorkflow notice:", err);
  });

  // Generate TSD Notification for document attached to workflow
  const moduleLabels: Record<string, string> = {
    "control-no": "Control Number",
    "unloading-loading": "Unloading / Loading",
    "hazardous-waste": "Hazardous Waste",
    "waste-movement": "Waste Movement",
    "timestamp": "Timestamp Timeline"
  };
  const modTitle = moduleLabels[moduleKey] || moduleKey;
  notificationRepository.createNotification({
    portal: "TSD",
    module: moduleKey,
    workflowId: targetWf.id,
    documentId: docId,
    documentNumber: targetWf.controlNo || normCode,
    title: `${modTitle} Record Updated`,
    message: `${modTitle} record updated for Workflow ${targetWf.workflowCode || targetWf.id}${targetWf.controlNo ? ` (${targetWf.controlNo})` : ""}.`,
    priority: "LOW"
  }).catch(() => {});

  // Set active workflow ID to the official target workflow ID
  const shouldSetActive = isNewWorkflowCreation || (options?.setAsActive ?? (!activeWf || activeWf.id === targetWf.id));
  if (shouldSetActive) {
    setActiveWorkflow(targetWf.id, targetWf.controlNo);
  }

  return targetWf;
}

/**
 * Backward Compatibility Migration Routine.
 * Scans all document collections in storage and assigns a Workflow ID to existing legacy records without workflowId.
 */
export function migrateLegacyDocumentsToWorkflows(): WorkflowRecord[] {
  try {
    const workflows = getAllWorkflows();
    let isModified = false;

    const getCollection = (key: string) => {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    };

    const collections = [
      { key: "tsd_uploaded_compliance_docs", stepKey: "control-no" as COAWorkflowStepKey },
      { key: "tsd_manifests", stepKey: "control-no" as COAWorkflowStepKey },
      { key: "tsd_compliance_records", stepKey: "unloading-loading" as COAWorkflowStepKey },
      { key: "tsd_hazwaste_records", stepKey: "hazardous-waste" as COAWorkflowStepKey },
      { key: "tsd_waste_movements", stepKey: "waste-movement" as COAWorkflowStepKey },
      { key: "tsd_timestamp_records", stepKey: "timestamp" as COAWorkflowStepKey }
    ];

    // Map control numbers to existing workflows
    const controlNoMap = new Map<string, WorkflowRecord>();
    workflows.forEach((w) => {
      if (w.controlNo) {
        controlNoMap.set(normalizeControlNo(w.controlNo), w);
      }
    });

    collections.forEach(({ key, stepKey }) => {
      const items = getCollection(key);
      if (!Array.isArray(items) || items.length === 0) return;

      let itemsChanged = false;

      items.forEach((rec) => {
        if (!rec) return;

        // If already has workflowId, ensure it's registered in documentIds
        if (rec.workflowId) {
          const targetWf = workflows.find((w) => w.id === rec.workflowId);
          if (targetWf) {
            if (!targetWf.documentIds) targetWf.documentIds = {};
            const docId = rec.id || rec.docId;
            if (docId && targetWf.documentIds[stepKey] !== docId) {
              targetWf.documentIds[stepKey] = docId;
              if (stepKey === "control-no") {
                targetWf.documentIds.controlNumber = docId;
                targetWf.documentIds["control-no"] = docId;
              } else if (stepKey === "unloading-loading") {
                targetWf.documentIds.unloadingLoading = docId;
                targetWf.documentIds["unloading-loading"] = docId;
              } else if (stepKey === "hazardous-waste") {
                targetWf.documentIds.hazardousWaste = docId;
                targetWf.documentIds["hazardous-waste"] = docId;
              } else if (stepKey === "waste-movement") {
                targetWf.documentIds.wasteMovement = docId;
                targetWf.documentIds["waste-movement"] = docId;
              } else if (stepKey === "timestamp") {
                targetWf.documentIds.timestamp = docId;
              }
              isModified = true;
            }
          }
          return;
        }

        // Unattached legacy record found
        const code = getTrackingCode(rec);
        const normCode = code ? normalizeControlNo(code) : "";

        let targetWf: WorkflowRecord | undefined;
        if (normCode) {
          targetWf = controlNoMap.get(normCode);
        }

        if (!targetWf) {
          const year = new Date().getFullYear();
          const seq = String(workflows.length + 1).padStart(6, "0");
          const newWfId = `WF-${year}-${seq}`;

          targetWf = {
            id: newWfId,
            workflowCode: newWfId,
            title: normCode ? `Legacy Workflow (${normCode})` : `Legacy Draft Workflow (${newWfId})`,
            controlNo: normCode || undefined,
            createdAt: rec.createdAt || rec.uploadedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: normCode ? "active" : "draft",
            documentIds: {}
          };

          workflows.push(targetWf);
          isModified = true;
          if (normCode) {
            controlNoMap.set(normCode, targetWf);
          }
        }

        rec.workflowId = targetWf.id;
        const recDocId = rec.id || rec.docId || String(Date.now());
        if (!targetWf.documentIds) targetWf.documentIds = {};
        targetWf.documentIds[stepKey] = recDocId;

        itemsChanged = true;
        isModified = true;
      });

      if (itemsChanged) {
        safeSetLocalStorage(key, JSON.stringify(items));
      }
    });

    if (isModified) {
      saveWorkflows(workflows);
      window.dispatchEvent(new Event("tsd_workflows_updated"));
      window.dispatchEvent(new Event("tsd_data_changed"));
    }

    return workflows;
  } catch (err) {
    console.warn("Legacy migration warning:", err);
    return getAllWorkflows();
  }
}

/**
 * Synchronize all storage collections with Workflows. Alias for migration routine.
 */
export function syncAllWorkflowsWithStorage(): WorkflowRecord[] {
  return migrateLegacyDocumentsToWorkflows();
}

/**
 * Helper to get workflows summary list with completion percentage for future sidebar/list views
 */
export function getWorkflowSummaryList(): (WorkflowRecord & { percentage: number })[] {
  const workflows = getAllWorkflows();
  return workflows.map((wf) => {
    const docIds = wf.documentIds || {};
    const keys: COAWorkflowStepKey[] = [
      "control-no",
      "unloading-loading",
      "hazardous-waste",
      "waste-movement",
      "timestamp"
    ];
    let count = 0;
    keys.forEach((k) => {
      if (docIds[k] || (docIds as any)[k.replace("-", "")]) {
        count++;
      }
    });
    const percentage = Math.round((count / 5) * 100);
    return {
      ...wf,
      completion: percentage,
      percentage
    };
  });
}
