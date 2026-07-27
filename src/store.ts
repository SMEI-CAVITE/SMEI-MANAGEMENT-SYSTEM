/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, UserRole, Supplier, PurchaseOrder, AuditLog, Notification, POStatus, POItem } from "./types";

// Standard VAT/EWT computation
export function calculatePOFinancials(
  items: POItem[],
  category: string, // "Vatable" | "Zero Rated" | "VAT Exempt"
  discountVatAmount: number = 0,
  partsRate: number = 0.01,
  laborRate: number = 0.02
) {
  const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  
  let vatableAmount = 0;
  let vat12 = 0;
  let vatExemptAmount = 0;
  let zeroRatedAmount = 0;

  const catLower = category.toLowerCase();
  if (catLower.includes("vatable")) {
    vatableAmount = Math.round((totalAmount / 1.12) * 100) / 100;
    vat12 = totalAmount - vatableAmount;
  } else if (catLower.includes("zero")) {
    zeroRatedAmount = totalAmount;
  } else {
    // VAT Exempt
    vatExemptAmount = totalAmount;
  }

  // Calculate EWT
  // Parts EWT (1%): Applied on parts item totals
  // Labor EWT (2%): Applied on labor item totals
  let partsTotal = 0;
  let laborTotal = 0;

  items.forEach(item => {
    const desc = item.description.toLowerCase();
    const isLabor = desc.includes("labor") || desc.includes("service") || desc.includes("repair") || desc.includes("install") || desc.includes("work");
    if (isLabor) {
      laborTotal += (item.quantity * item.unitPrice);
    } else {
      partsTotal += (item.quantity * item.unitPrice);
    }
  });

  // For EWT, if vatable, compute on VAT-exclusive basis; otherwise compute on full amount
  const partsBase = catLower.includes("vatable") ? (partsTotal / 1.12) : partsTotal;
  const laborBase = catLower.includes("vatable") ? (laborTotal / 1.12) : laborTotal;

  const partsEwt1 = Math.round((partsBase * partsRate) * 100) / 100;
  const laborEwt2 = Math.round((laborBase * laborRate) * 100) / 100;
  const ewtAdjustments = partsEwt1 + laborEwt2;

  // Gross Amount = Total Amount + EWT Adjustments
  const grossAmount = Math.round((totalAmount + ewtAdjustments) * 100) / 100;

  // TOTAL = Final Computed Amount
  const total = Math.round((totalAmount - partsEwt1 - laborEwt2 - discountVatAmount) * 100) / 100;

  return {
    grossAmount,
    vatableAmount,
    vat12: Math.round(vat12 * 100) / 100,
    vatExemptAmount: Math.round(vatExemptAmount * 100) / 100,
    zeroRatedAmount: Math.round(zeroRatedAmount * 100) / 100,
    discountVatAmount: Math.round(discountVatAmount * 100) / 100,
    partsEwt1,
    laborEwt2,
    ewtAdjustments,
    totalAmount: total // Final net total to be stored as the primary PO total amount
  };
}

// Minimal legacy state loaders to prevent compile errors in any unrefactored components
export function loadState() {
  return { 
    users: [] as User[], 
    suppliers: [] as Supplier[], 
    pos: [] as PurchaseOrder[], 
    auditLogs: [] as AuditLog[], 
    notifications: [] as Notification[], 
    currentUser: null as User | null 
  };
}

export function saveState(state: any) {
  // Legacy stub - now managed by backend Cloud SQL / Firestore databases
}
