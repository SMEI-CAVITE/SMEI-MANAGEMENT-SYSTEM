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
  currencySymbol?: string;
  rfsNumber?: string;
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

export interface Notification {
  id: string;
  userId: string;
  role: UserRole;
  title: string;
  message: string;
  date: string;
  time: string;
  isRead: boolean;
  poId?: string;
}

export interface PaymentEntry {
  id: string;
  paymentPurpose: string;
  gross: number;
  ewt: number;
  total: number;
}

export interface PaymentInstructionSlip {
  id: string;
  pisNumber: string;
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
  
  status: "Draft" | "Pending" | "Approved" | "Released" | "Cancelled";
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
  addNothingFollows?: boolean;
  items: RFSItem[];
  status: "Complete" | "Incomplete" | "On Time" | "Late";
  modeOfRequest: "Emergency" | "Urgent" | "Regular" | "Irregular";
  purpose: string;
  
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
