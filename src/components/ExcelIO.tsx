/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { PurchaseOrder, POItem, Supplier, User } from "../types";
import { FileText } from "lucide-react";

export function ExcelTemplateDownloadButton() {
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const headers = [[
      "PO Number", "Supplier", "PO Date", "Delivery Date", "Category", 
      "Quantity", "Unit", "Description", "Unit Price", "Attention", 
      "Purpose", "Payment Terms", "Work Duration", "Warranty", "Remarks"
    ]];
    const sampleRow = [
      "SMEI-2026-9999", "Cavite Metal Casting Corp.", "2026-06-25", "2026-07-25", "Zero Rated",
      "100", "pcs", "Anchor Bolts M16 Grade 10.9", "120", "Mr. Arthur Alcantara",
      "Structural anchors for kiln furnace", "Net 30 Days", "7 Days", "1 Year", "Deliver directly to kiln dock."
    ];

    const ws = XLSX.utils.aoa_to_sheet([...headers, sampleRow]);
    XLSX.utils.book_append_sheet(wb, ws, "SMEI PO Import Template");
    XLSX.writeFile(wb, "SMEI_PO_Import_Template.xlsx");
  };

  return (
    <button
      onClick={handleDownloadTemplate}
      className="text-xs text-smei-crimson hover:text-smei-darkred hover:underline font-bold flex items-center gap-1 bg-red-50/50 px-2 py-1 rounded border border-red-100"
      title="Download pre-formatted spreadsheet template"
    >
      <FileText className="w-3.5 h-3.5" />
      <span>Download Import Template (.xlsx)</span>
    </button>
  );
}

export const exportPOToExcel = (po: PurchaseOrder) => {
  const wb = XLSX.utils.book_new();
  
  // Construct printable matrix rows
  const dataRows = [
    ["SOUTHCOAST METAL ENTERPRISE, INC."],
    ["Block 8A, Phase 1, East Avenue, Cavite Economic Zone, Rosario, Cavite, Philippines"],
    ["Purchase Order Document"],
    [""],
    ["PO Number:", po.poNumber, "", "PO Date:", po.poDate],
    ["Delivery Date:", po.deliveryDate, "", "Category:", po.category],
    [""],
    ["SUPPLIER DETAILS"],
    ["Supplier:", po.supplierName, "", "Attention:", po.attention],
    ["Tel / Fax No:", `${po.telNo} / ${po.faxNo}`, "", "Purpose:", po.purpose],
    [""],
    ["ITEM DETAILS TABLE"],
    ["Quantity", "Unit", "Name / Description of Item", "Unit Price (PHP)", "Amount (PHP)"]
  ];

  // Add items
  po.items.forEach((item) => {
    dataRows.push([
      String(item.quantity),
      item.unit,
      item.description,
      String(item.unitPrice),
      String(item.amount)
    ]);
  });

  dataRows.push([""]);
  dataRows.push(["TAX & COMPUTATION DETAILS"]);
  dataRows.push(["Gross Amount:", String(po.grossAmount)]);
  dataRows.push(["Discount VAT Amount:", String(po.discountVatAmount)]);
  dataRows.push(["Vatable Amount (12%):", String(po.vatableAmount)]);
  dataRows.push(["12% VAT:", String(po.vat12)]);
  dataRows.push(["VAT Exempt Amount:", String(po.vatExemptAmount)]);
  dataRows.push(["Zero Rated Amount:", String(po.zeroRatedAmount)]);
  if (po.ewtType && po.ewtPercentage !== undefined) {
    dataRows.push([`${po.ewtType} (${po.ewtPercentage}%):`, String(po.partsEwt1 || po.laborEwt2 || 0)]);
  } else {
    dataRows.push(["Parts EWT (1%):", String(po.partsEwt1)]);
    dataRows.push(["Labor EWT (2%):", String(po.laborEwt2)]);
  }
  dataRows.push(["TOTAL AMOUNT PAYABLE (PHP):", String(po.totalAmount)]);
  dataRows.push([""]);
  dataRows.push(["TERMS SECTION"]);
  dataRows.push(["Payment Terms:", po.paymentTerms]);
  dataRows.push(["Work Duration:", po.workDuration]);
  dataRows.push(["Warranty:", po.warranty]);
  dataRows.push(["Remarks:", po.remarks]);
  dataRows.push([""]);
  dataRows.push(["SIGN-OFF AUTHORIZATIONS"]);
  dataRows.push(["Prepared By:", po.preparedBy]);
  dataRows.push(["Checked By:", po.checkedBy || "N/A"]);
  dataRows.push(["Verified By:", po.verifiedBy || "N/A"]);
  dataRows.push(["Approved By:", po.approvedBy || "N/A"]);
  dataRows.push(["Status:", po.status]);

  const ws = XLSX.utils.aoa_to_sheet(dataRows);
  XLSX.utils.book_append_sheet(wb, ws, "Purchase Order");
  XLSX.writeFile(wb, `${po.poNumber}_SMEI_PO.xlsx`);
};

