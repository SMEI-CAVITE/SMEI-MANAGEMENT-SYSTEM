/**
 * COA (Certificate of Acceptance) Document Progress Tracker Types
 * SMEI TSD Portal Compliance Engine & Workflow Hierarchy
 */

export type COAWorkflowStepKey =
  | "control-no"
  | "unloading-loading"
  | "hazardous-waste"
  | "waste-movement"
  | "timestamp";

export type COAStepStatus = "completed" | "in_progress" | "pending" | "locked";

export interface WorkflowRecord {
  id: string; // e.g. "WF-2026-000001"
  workflowCode?: string; // e.g. "WF-2026-000001"
  title?: string;
  description?: string;
  department?: string;
  site?: string;
  preparedBy?: string;
  remarks?: string;
  controlNo?: string; // e.g. "M-R3-2026-07-12345" or undefined if not assigned yet
  createdAt: string;
  updatedAt: string;
  status: "draft" | "active" | "completed" | "archived";
  isDraft?: boolean;
  completion?: number; // percentage 0-100
  documentIds: {
    "control-no"?: string;
    "unloading-loading"?: string;
    "hazardous-waste"?: string;
    "waste-movement"?: string;
    controlNumber?: string;
    unloadingLoading?: string;
    hazardousWaste?: string;
    wasteMovement?: string;
    timestamp?: string;
  };
}

export interface COAWorkflowStep {
  key: COAWorkflowStepKey;
  stepNumber: number; // 1 to 5
  title: string;
  subtitle: string;
  status: COAStepStatus;
  isCompleted: boolean;
  isCurrent: boolean;
  documentNumber?: string;
  timestamp?: string;
  formattedDate?: string;
  createdBy?: string;
  updatedAt?: string;
  details?: Record<string, any>;
  isLocked?: boolean;
}

export interface COAWorkflowProgress {
  workflowId: string;
  selectedControlNo: string;
  availableControlNumbers: string[];
  availableWorkflows: { id: string; controlNo?: string; label: string }[];
  completedCount: number;
  totalCount: number; // Always 5
  percentage: number;
  isReadyForCOA: boolean;
  steps: COAWorkflowStep[];
  lastUpdated: string;
}
