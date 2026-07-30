/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ProcurementDocumentType = "PO" | "PIS" | "RFS" | "CANVASS";

/**
 * Single Source of Truth for Role-Based Pending Procurement Document Visibility
 * 
 * Visibility Matrix:
 * - Administrator: PO, PIS, RFS, CANVASS
 * - Purchasing Staff: PO, PIS, RFS, CANVASS
 * - Sales: PO, RFS (Must NOT see PIS or CANVASS)
 */
export const PENDING_DOCUMENT_VISIBILITY: Record<string, ProcurementDocumentType[]> = {
  Administrator: ["PO", "PIS", "RFS", "CANVASS"],
  "Purchasing Staff": ["PO", "PIS", "RFS", "CANVASS"],
  Sales: ["PO", "RFS"],
};

/**
 * Normalizes any string representation of a document type to standard ProcurementDocumentType
 */
export function normalizeDocumentType(rawType: string | undefined | null): ProcurementDocumentType | null {
  if (!rawType) return null;
  const upper = String(rawType).trim().toUpperCase();
  if (upper === "PO" || upper === "PURCHASE ORDER" || upper === "PURCHASEORDER" || upper === "PURCHASE_ORDER") {
    return "PO";
  }
  if (upper === "PIS" || upper === "PAYMENT INSTRUCTION SLIP" || upper === "PAYMENT_INSTRUCTION_SLIP") {
    return "PIS";
  }
  if (upper === "RFS" || upper === "REQUEST FOR SUPPLY" || upper === "REQUEST_FOR_SUPPLY") {
    return "RFS";
  }
  if (
    upper === "CANVASS" ||
    upper === "CANVASS SHEET" ||
    upper === "CANVASSSHEET" ||
    upper === "CANVASS_SHEET" ||
    upper === "CS"
  ) {
    return "CANVASS";
  }
  return null;
}

/**
 * Returns allowed document types for pending visibility based on user role
 */
export function getAllowedPendingDocumentTypes(userRole: string | undefined | null): ProcurementDocumentType[] {
  if (!userRole) return [];
  const cleanRole = String(userRole).trim();

  // Explicit Sales Role Check (Sales must NOT see PIS or CANVASS)
  if (cleanRole.toLowerCase().includes("sales") || cleanRole === "Sales") {
    return ["PO", "RFS"];
  }

  if (cleanRole === "Administrator") {
    return ["PO", "PIS", "RFS", "CANVASS"];
  }

  if (cleanRole === "Purchasing Staff" || cleanRole === "PurchasingStaff") {
    return ["PO", "PIS", "RFS", "CANVASS"];
  }

  // Department Head, Accounting Staff, Director, Approver, etc.
  if (
    cleanRole === "Department Head" ||
    cleanRole === "Accounting Staff" ||
    cleanRole === "Director"
  ) {
    return ["PO", "PIS", "RFS", "CANVASS"];
  }

  // Viewer / Other roles
  if (cleanRole === "Viewer") {
    return ["PO", "RFS"];
  }

  // Default fallback for any other role
  return PENDING_DOCUMENT_VISIBILITY[cleanRole] || ["PO", "RFS"];
}

/**
 * Determines if a Purchase Order is currently in an active pending workflow state
 */
export function isPOPending(po: any): boolean {
  if (!po) return false;
  const status = po.status;
  const approvalStatus = po.approvalStatus;

  // Terminal / non-pending states
  if (
    status === "Approved" ||
    status === "Rejected" ||
    status === "Cancelled" ||
    status === "Closed" ||
    status === "Draft"
  ) {
    return false;
  }

  if (approvalStatus === "Approved" || approvalStatus === "Rejected") {
    return false;
  }

  // Active pending states
  return (
    status === "Pending Review" ||
    status === "Pending Verification" ||
    status === "Pending Approval" ||
    approvalStatus === "Pending Approval" ||
    approvalStatus === "Pending"
  );
}

/**
 * Determines if a Payment Instruction Slip (PIS) is currently in an active pending workflow state
 */
export function isPISPending(pis: any): boolean {
  if (!pis) return false;
  const status = pis.status;
  const approvalStatus = pis.approvalStatus;

  // Terminal / non-pending states
  if (
    status === "Approved" ||
    status === "Rejected" ||
    status === "Cancelled" ||
    status === "Draft" ||
    status === "Released" ||
    status === "Complete" ||
    status === "Closed"
  ) {
    return false;
  }

  if (approvalStatus === "Approved" || approvalStatus === "Rejected") {
    return false;
  }

  return (
    approvalStatus === "Pending Approval" ||
    approvalStatus === "Pending" ||
    status === "Pending" ||
    status === "Pending Approval" ||
    (!status && !approvalStatus)
  );
}

/**
 * Determines if a Request For Supply (RFS) is currently in an active pending workflow state
 */
export function isRFSPending(rfs: any): boolean {
  if (!rfs) return false;

  // Terminal / signed states
  if (rfs.approvedBy || rfs.rejectedBy) return false;

  const status = rfs.status;
  const approvalStatus = rfs.approvalStatus;

  if (approvalStatus === "Approved" || approvalStatus === "Rejected") return false;
  if (
    status === "Approved" ||
    status === "Rejected" ||
    status === "Cancelled" ||
    status === "Draft" ||
    status === "Complete" ||
    status === "Closed"
  ) {
    return false;
  }

  return true;
}

/**
 * Determines if a Canvass Sheet is currently in an active pending workflow state
 */
export function isCanvassPending(canv: any): boolean {
  if (!canv) return false;

  // Terminal / signed states
  if (canv.approvedBy || canv.rejectedBy) return false;

  const status = canv.status;
  const approvalStatus = canv.approvalStatus;

  if (approvalStatus === "Approved" || approvalStatus === "Rejected") return false;
  if (
    status === "Approved" ||
    status === "Rejected" ||
    status === "Cancelled" ||
    status === "Draft" ||
    status === "Complete" ||
    status === "Closed"
  ) {
    return false;
  }

  return true;
}

/**
 * Checks if a given document is pending based on its document type
 */
export function isDocumentPending(docType: string, doc: any): boolean {
  const normType = normalizeDocumentType(docType);
  if (!normType) return false;
  switch (normType) {
    case "PO":
      return isPOPending(doc);
    case "PIS":
      return isPISPending(doc);
    case "RFS":
      return isRFSPending(doc);
    case "CANVASS":
      return isCanvassPending(doc);
    default:
      return false;
  }
}
