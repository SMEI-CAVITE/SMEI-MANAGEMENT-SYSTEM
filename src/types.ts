/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  Administrator = "Administrator",
  PurchasingStaff = "Purchasing Staff",
  DepartmentHead = "Department Head",
  AccountingStaff = "Accounting Staff",
  Director = "Director",
  Viewer = "Viewer"
}

declare global {
  interface Window {
    smeiHasUnsavedChanges?: boolean;
  }
}

export interface User {
  id: string;
  employeeId?: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  realRole?: UserRole;
  department: string;
  avatarUrl?: string;
  profile_image?: string;
  phone_number?: string;
  position?: string;
  notificationPreferences?: {
    email: boolean;
    system: boolean;
  };
}

export interface Supplier {
  id: string;
  name: string;
  supplier_name?: string;
  attention: string;
  phone: string;
  fax: string;
  address: string;
  category: string;
  createdAt: string;
  created_at?: string;
  created_by?: string;
  status?: "Active" | "Disabled";
}

export interface POItem {
  id: string;
  quantity: number;
  unit: string;
  description: string;
  unitPrice: number;
  amount: number;
}

export type POStatus = 
  | "Draft"
  | "Pending Review"
  | "Pending Approval"
  | "Approved"
  | "Rejected"
  | "Cancelled"
  | "Closed";

export type ApprovalStatus =
  | "Draft"
  | "Pending Approval"
  | "Approved"
  | "Rejected"
  | "Cancelled";

export interface DocumentApprovalSignature {
  id: string;
  userId?: string;
  userName: string;
  position?: string;
  note?: string;
  signedAt: string;
  signatureType: "APPROVAL" | "NOTE" | "SIGNATURE";
}

export interface ApprovalHistoryEntry {
  id: string;
  documentType: "PO" | "PIS" | "RFS" | "CANVASS";
  documentId: string;
  documentNumber: string;
  action: "Submitted for Approval" | "Approved" | "Rejected" | "Cancelled" | "EXPORTED" | "SIGNED" | "NOTE_ADDED";
  performedBy: string;
  performedByName: string;
  performedByRole?: string;
  performedByPosition?: string;
  timestamp: string;
  reason?: string;
  note?: string;
  details?: string;
}

export interface UnifiedProcurementDocument {
  id: string;
  documentType: "PO" | "PIS" | "RFS" | "CANVASS";
  documentNumber: string;
  controlNumber?: string;
  requestedBy: string;
  department: string;
  date: string;
  amount: number | null;
  operationalStatus: string;
  approvalStatus: ApprovalStatus;
  rawDocument: PurchaseOrder | PaymentInstructionSlip | RequestForSupply | CanvassSheet;
  submittedBy?: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedByName?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  exportStatus?: "NOT_EXPORTED" | "EXPORTED";
  exportedAt?: string;
  exportedBy?: string;
  exportedByName?: string;
  exportedByPosition?: string;
  signatureHistory?: DocumentApprovalSignature[];
  approvalHistory?: ApprovalHistoryEntry[];
}

export interface Signatory {
  id: string;
  name: string;
  role: string;
  signature?: string;
  date?: string;
  status?: "Pending" | "Signed";
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  poDate: string;
  deliveryDate: string;
  supplierId: string;
  supplierName: string;
  attention: string;
  telNo: string;
  faxNo: string;
  purpose: string;
  category: string; // Tax Type
  poCategory: string; // New Category
  
  // Items
  items: POItem[];
  
  // Tax & VAT Calculations
  overrideVat?: boolean;
  vatableAmount: number;
  vat12: number;
  vatExemptAmount: number;
  zeroRatedAmount: number;
  grossAmount: number;
  discountVatAmount: number;
  partsEwt1: number;
  laborEwt2: number;
  ewtType?: string;
  ewtPercentage?: number;
  partsEwtPercentage?: number;
  laborEwtPercentage?: number;
  totalAmount: number;
  
  // Terms
  paymentTerms: string;
  workDuration: string;
  warranty: string;
  remarks: string;
  
  // Approval Workflow
  preparedBy: string;
  preparedByTitle?: string;
  checkedBy?: string;
  checkedByTitle?: string;
  verifiedBy?: string;
  verifiedByTitle?: string;
  verifiedBy2?: string;
  verifiedBy2Title?: string;
  approvedBy?: string;
  approvedByTitle?: string;
  conforme?: string;
  conformeTitle?: string;
  excludePreparedBy?: boolean;
  excludeCheckedBy?: boolean;
  excludeVerifiedBy?: boolean;
  excludeVerifiedBy2?: boolean;
  excludeApprovedBy?: boolean;
  excludeConforme?: boolean;
  
  additionalSignatories?: Signatory[];
  
  signature?: string;
  dateApproved?: string;
  status: POStatus;
  approvalStatus?: ApprovalStatus;
  approvalHistory?: ApprovalHistoryEntry[];
  submittedBy?: string;
  submittedAt?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedByName?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  currencySymbol?: string;
  rfsNumber?: string;
  rfsId?: string;
  created_by?: string;
  createdAt?: string;
  
  // History or Log
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  username: string;
  role: string;
  action: string;
  date: string;
  time: string;
  oldValue: string;
  newValue: string;
  ipAddress: string;
  timestamp?: string;
  targetId?: string;
  details?: string;
}

export type ProcurementDocumentType = "PO" | "PIS" | "RFS" | "CANVASS";
export type NotificationStatus = "ACTIVE" | "RESOLVED" | "EXPIRED";
export type NotificationEventType = "SUBMITTED" | "APPROVED" | "REJECTED" | "RETURNED" | "VERIFIED" | "INFO";

export interface Notification {
  id: string;
  portal?: PortalType | "po" | "tsd" | string;
  module?: string;
  priority?: "HIGH" | "MEDIUM" | "LOW" | string;
  workflowId?: string;
  userId: string;
  role: UserRole | string;
  title: string;
  message: string;
  date: string;
  time: string;
  isRead: boolean;
  poId?: string;
  documentType?: ProcurementDocumentType | string;
  documentId?: string;
  documentNumber?: string;
  status?: NotificationStatus | string;
  eventType?: NotificationEventType | string;
  createdAt?: string;
  readAt?: string;
  createdBy?: string;
}

export interface PaymentEntry {
  id: string;
  completedPOId?: string;
  completedPONumber?: string;
  poNumber?: string;
  paymentPurpose: string;
  gross: number;
  ewt: number;
  total: number;
}

export interface PaymentInstructionSlip {
  id: string;
  pisNumber: string;
  completedPOId?: string;
  completedPONumber?: string;
  poNumber?: string;
  scheduleDate: string;
  scheduleTime: string;
  ampm: "AM" | "PM";
  payee: string;
  amount: number;
  gross?: number;
  ewt?: number;
  total?: number;
  currency: "PHP" | "USD" | "JP Yen" | "Others";
  currencyOthers?: string;
  paymentMode: "Cash" | "Check Crossed" | "Check Not Crossed" | "T/T" | "Others";
  paymentModeOthers?: string;
  remarks: string;
  payments?: PaymentEntry[];
  
  // Signatories
  requestedBy: string;
  requestedDate: string;
  checkedAndVerifiedBy: string;
  checkedAndVerifiedByPosition?: string;
  verifiedBy: string;
  verifiedByPosition?: string;
  verifiedByDate?: string;
  acceptedBy: string;
  acceptedByPosition?: string;
  acceptedByDate?: string;
  
  status: "Draft" | "Pending" | "Approved" | "Released" | "Cancelled" | "Rejected";
  approvalStatus?: ApprovalStatus;
  approvalHistory?: ApprovalHistoryEntry[];
  submittedBy?: string;
  submittedAt?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedByName?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  created_by: string;
  created_department?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RFSItem {
  id: string;
  quantity: number;
  unit: string;
  description: string;
  lastPurchaseDate: string;
  lastPurchaseQuantity: number;
  lastPurchaseUnitPrice: number;
  currentPurchaseDate: string;
  currentPurchaseQuantity: number;
  currentPurchaseUnitPrice: number;
  remarks: string;
}

export interface RequestForSupply {
  id: string;
  rfsNumber: string;
  dateRequested: string;
  dueDate: string;
  department: string;
  departmentOthers?: string;
  controlNumber: string;
  purchaseOrderNumber: string;
  items: RFSItem[];
  status: "Complete" | "Incomplete" | "On Time" | "Late";
  approvalStatus?: ApprovalStatus;
  approvalHistory?: ApprovalHistoryEntry[];
  submittedBy?: string;
  submittedAt?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedByName?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  modeOfRequest: "Emergency" | "Urgent" | "Regular" | "Irregular";
  purpose: string;
  addNothingFollows?: boolean;
  
  // Signatories
  requestedBy: string;
  verifiedBy: string;
  approvedBy: string;
  
  created_by: string;
  created_department?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CanvassItem {
  id: string;
  item: string;
  specification: string;
  quantity: number;
  unit: string;
  supplierAPrice: number;
  supplierBPrice: number;
  supplierCPrice: number;
  selectedSupplier: "Supplier A" | "Supplier B" | "Supplier C";
  remarks: string;
}

export interface CanvassSheet {
  id: string;
  canvassNumber: string;
  canvassDate: string;
  supplierName: string;
  address: string;
  contactPerson: string;
  phoneNumber: string;
  email: string;
  items: CanvassItem[];
  lowestPrice: number;
  recommendedSupplier: string;
  totalCost: number;
  status?: string;
  approvalStatus?: ApprovalStatus;
  approvalHistory?: ApprovalHistoryEntry[];
  submittedBy?: string;
  submittedAt?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedByName?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  
  // New input fields for the Canvass Sheet template
  category?: string;
  plateNo?: string;
  scopeOfWorks?: string;
  shopName1?: string;
  shopName2?: string;
  contactPerson1?: string;
  contactPerson2?: string;
  contactNo1?: string;
  contactNo2?: string;
  remarks?: string;
  workDuration1?: string;
  workDuration2?: string;
  warranty1?: string;
  warranty2?: string;
  paymentTerms1?: string;
  paymentTerms2?: string;

  // Signatories with positions
  requestedBy: string;
  preparedByPosition?: string;
  checkedBy?: string;
  checkedByPosition?: string;
  verifiedBy?: string;
  verifiedByPosition?: string;
  approvedBy?: string;
  approvedByPosition?: string;

  // Dynamic Lists Support
  suppliersList?: any[];
  partsList?: any[];
  shops?: any[];
  parts?: any[];
  
  created_by: string;
  created_department?: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// SYSTEM RESOURCE & STORAGE MONITORING TYPES
// ==========================================

export type PortalType = "SMEI_MANAGEMENT_SYSTEM" | "TSD_PORTAL" | "PURCHASE" | "TSD" | "po" | "tsd";

export type FileStatusType = "ACTIVE" | "TEMPORARY" | "DELETED" | "ARCHIVED";

export type SystemHealthStatus = "NORMAL" | "WARNING" | "CRITICAL" | "EXTREME" | "LIMIT_REACHED";

export interface MonitoringFileRecord {
  id: string;
  portal: PortalType;
  documentType: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  relatedRecordId?: string;
  uploadedBy?: string;
  createdAt: string;
  updatedAt?: string;
  status: FileStatusType;
  metadata?: {
    controlNo?: string;
    manifestYear?: number;
    sheetCount?: number;
    sourceFileId?: string;
    generatedFileId?: string;
    mergedFileId?: string;
    [key: string]: any;
  };
}

export interface MonitoringOperationLog {
  id: string;
  timestamp: string;
  date: string;
  portal: PortalType;
  module: string;
  operation: "READ" | "CREATE" | "UPDATE" | "DELETE";
  count?: number;
}

export interface MonitoringSnapshot {
  id: string;
  date: string;
  timestamp: string;
  totalStorageBytes: number;
  totalFilesCount: number;
  smeiStorageBytes: number;
  smeiFilesCount: number;
  tsdStorageBytes: number;
  tsdFilesCount: number;
  dbReads: number;
  dbCreates: number;
  dbUpdates: number;
  dbDeletes: number;
}

export interface MonitoringSettings {
  storageLimitBytes: number; // Default 5GB (5368709120 bytes)
  warningThresholdPct: number; // Default 70%
  criticalThresholdPct: number; // Default 85%
  extremeThresholdPct: number; // Default 95%
}

export interface DocumentTypeStorageStat {
  documentType: string;
  displayName: string;
  portal: PortalType;
  fileCount: number;
  sizeBytes: number;
  percentageOfTotal: number;
}

export interface DatabaseOperationStat {
  module: string;
  portal: PortalType;
  reads: number;
  creates: number;
  updates: number;
  deletes: number;
  totalOperations: number;
}

export interface MonitoringOverviewData {
  totalStorageBytes: number;
  storageLimitBytes: number;
  storagePercentageUsed: number;
  totalFilesCount: number;
  activeFilesCount: number;
  dbReadsToday: number;
  dbWritesToday: number;
  dbUpdatesToday: number;
  dbDeletesToday: number;
  healthStatus: SystemHealthStatus;
  portalStats: {
    smei: {
      storageBytes: number;
      filesCount: number;
      percentage: number;
    };
    tsd: {
      storageBytes: number;
      filesCount: number;
      percentage: number;
    };
  };
  docTypeStats: DocumentTypeStorageStat[];
  dbOperationStats: DatabaseOperationStat[];
  thresholds: MonitoringSettings;
}

