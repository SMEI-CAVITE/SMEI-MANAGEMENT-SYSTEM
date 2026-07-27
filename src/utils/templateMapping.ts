import { PurchaseOrder, PaymentInstructionSlip, RequestForSupply, CanvassSheet } from "../types";

export const formatCurrency = (val: number | string | undefined | null, symbol: string = "₱"): string => {
  if (val === undefined || val === null || val === "") return "";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "";
  return `${symbol}\u00A0${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatDate = (dateString: string | undefined | null): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
};

const alignSignatory = (
  nameVal: string | undefined | null,
  positionVal: string | undefined | null,
  isExcluded?: boolean
): { name: string; position: string } => {
  if (isExcluded) {
    return { name: "\u00A0", position: "\u00A0" };
  }
  const name = (nameVal ?? "").trim();
  const position = (positionVal ?? "").trim();
  return {
    name: name || "\u00A0",
    position: position || "\u00A0"
  };
};

const getWrappedLineCount = (text: string, charsPerLine: number = 59): number => {
  if (!text) return 1;
  const lines = text.split("\n");
  let totalLines = 0;
  lines.forEach(line => {
    totalLines += Math.max(1, Math.ceil(line.length / charsPerLine));
  });
  return totalLines;
};

const truncateTextToMaxLines = (text: string, maxLines: number, charsPerLine: number = 59): string => {
  if (!text) return "";
  const lines = text.split("\n");
  const resultLines: string[] = [];
  let currentLinesCount = 0;

  for (const line of lines) {
    if (currentLinesCount >= maxLines) break;
    const chunksCount = Math.max(1, Math.ceil(line.length / charsPerLine));
    if (currentLinesCount + chunksCount <= maxLines) {
      resultLines.push(line);
      currentLinesCount += chunksCount;
    } else {
      const allowedChunks = maxLines - currentLinesCount;
      const allowedChars = allowedChunks * charsPerLine - 3;
      if (allowedChars > 0) {
        resultLines.push(line.slice(0, allowedChars) + "...");
      } else {
        if (resultLines.length === 0 || !resultLines[resultLines.length - 1].endsWith("...")) {
          resultLines.push("...");
        }
      }
      break;
    }
  }
  return resultLines.join("\n");
};

export function formatRFSNo(rfsNo: string | undefined | null, dateStr?: string): string {
  if (!rfsNo) {
    rfsNo = "001";
  }
  if (/^\d{4}-\d{2}-\d{3}$/.test(rfsNo)) {
    return rfsNo;
  }
  
  let year = "2026";
  let month = "07";
  if (dateStr) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      year = d.getFullYear().toString();
      month = (d.getMonth() + 1).toString().padStart(2, "0");
    }
  } else {
    const d = new Date();
    year = d.getFullYear().toString();
    month = (d.getMonth() + 1).toString().padStart(2, "0");
  }
  
  const match = rfsNo.match(/\d+/g);
  let seqStr = "001";
  if (match) {
    const lastDigits = match[match.length - 1];
    const parsed = parseInt(lastDigits, 10);
    seqStr = parsed.toString().slice(-3).padStart(3, "0");
  }
  
  return `${year}-${month}-${seqStr}`;
}

export function mapPOData(po: PurchaseOrder): Record<string, any> {
  const rawRfs = po.rfsNumber || (po.poNumber ? po.poNumber.split("-").pop() || "10672" : "10672");
  const rfsNo = formatRFSNo(rawRfs, po.poDate);
  const symbol = po.currencySymbol || "₱";
  const formattedPurpose = po.purpose ?? "";
  
  const itemsCount = po.items ? po.items.length : 0;
  const qtyLines: string[] = [];
  const unitLines: string[] = [];
  const descLines: string[] = [];
  const priceLines: string[] = [];
  const amountLines: string[] = [];
  const items: any[] = [];

  let totalDescLines = 0;
  const MAX_TOTAL_DESC_LINES = 18;

  for (let i = 0; i < itemsCount; i++) {
    const item = po.items[i];
    let desc = item.description || "";
    const currentLinesBudget = Math.max(2, MAX_TOTAL_DESC_LINES - totalDescLines - (itemsCount - 1 - i));
    const rawLineCount = getWrappedLineCount(desc, 59);

    if (rawLineCount > currentLinesBudget) {
      desc = truncateTextToMaxLines(desc, currentLinesBudget, 59);
    }

    const lCount = getWrappedLineCount(desc, 59);
    totalDescLines += lCount;

    qtyLines.push(String(item.quantity || ""));
    unitLines.push(item.unit || "");
    descLines.push(desc);
    priceLines.push(formatCurrency(item.unitPrice, symbol));
    amountLines.push(formatCurrency(item.amount, symbol));

    items.push({
      quantity: String(item.quantity || ""),
      unit: item.unit || "",
      description: desc,
      unitPrice: formatCurrency(item.unitPrice, symbol),
      amount: formatCurrency(item.amount, symbol)
    });

    for (let pad = 1; pad < lCount; pad++) {
      qtyLines.push("");
      unitLines.push("");
      priceLines.push("");
      amountLines.push("");
    }
  }

  const QUANTITY = qtyLines.join("\n");
  const UNIT = unitLines.join("\n");
  const UNIT_PRICE = priceLines.join("\n");
  const AMOUNT = amountLines.join("\n");

  const prepared = alignSignatory(po.preparedBy, po.preparedByTitle, po.excludePreparedBy);
  const checked = alignSignatory(po.checkedBy, po.checkedByTitle, po.excludeCheckedBy);
  const verified = alignSignatory(po.verifiedBy, po.verifiedByTitle, po.excludeVerifiedBy);
  const verified2 = alignSignatory(po.verifiedBy2 || "", po.verifiedBy2Title || "", po.excludeVerifiedBy2 || false);
  const approved = alignSignatory(po.approvedBy, po.approvedByTitle, po.excludeApprovedBy);

  const VERIFIED_BY1 = verified.name;
  const VERIFIED_BY_POSITION1 = verified.position;

  let VERIFIED_BY2 = verified2.name || "\u00A0";
  let VERIFIED_BY_POSITION2 = verified2.position || "\u00A0";
  
  if (!po.verifiedBy2 && po.additionalSignatories && po.additionalSignatories.length > 0) {
    const vSigs = po.additionalSignatories.filter(
      (sig) => sig.role?.toLowerCase().includes("verified") || sig.role?.toLowerCase().includes("verifier")
    );
    if (vSigs.length > 0) {
      VERIFIED_BY2 = vSigs[0].name || "\u00A0";
      VERIFIED_BY_POSITION2 = vSigs[0].role || "\u00A0";
    }
  }

  return {
    DOCUMENT_NO: "FM-PPD-03",
    RFS_NO: rfsNo,
    SUPPLIER_NAME: po.supplierName ?? "",
    PO_NUMBER: po.poNumber ?? "",
    ATTENTION: po.attention ?? "",
    PO_DATE: formatDate(po.poDate) ?? "",
    TEL_FAX: `${po.telNo ?? ""} ${po.faxNo ? `/ ${po.faxNo}` : ""}`.trim() || "",
    DELIVERY_DATE: formatDate(po.deliveryDate) ?? "",
    PURPOSE: formattedPurpose,
    CATEGORY: po.category ?? "Vatable",

    QUANTITY,
    UNIT,
    DESCRIPTION: descLines.join("\n"),
    UNIT_PRICE,
    AMOUNT,

    items,

    VATABLE_AMOUNT: po.category?.toLowerCase().includes("vatable") ? formatCurrency(po.vatableAmount, symbol) : "",
    VAT_AMOUNT: po.category?.toLowerCase().includes("vatable") ? formatCurrency(po.vat12, symbol) : "",
    VAT_EXEMPT_AMOUNT: po.category?.toLowerCase().includes("exempt") ? formatCurrency(po.vatExemptAmount, symbol) : "",
    ZERO_RATED_AMOUNT: po.category?.toLowerCase().includes("zero") ? formatCurrency(po.zeroRatedAmount, symbol) : "",
    TOTAL_AMOUNT: formatCurrency(po.totalAmount, symbol),
    GROSS_AMOUNT: formatCurrency(po.grossAmount || po.totalAmount, symbol),
    PARTS_EWT: po.partsEwt1 > 0 ? formatCurrency(po.partsEwt1, symbol) : "",
    LABOR_EWT: po.laborEwt2 > 0 ? formatCurrency(po.laborEwt2, symbol) : "",
    EWT_TYPE: po.ewtType ?? "",
    EWT_PERCENTAGE: po.ewtPercentage !== undefined ? `${po.ewtPercentage}%` : "",
    DISCOUNT_VAT_AMOUNT: po.discountVatAmount > 0 ? formatCurrency(po.discountVatAmount, symbol) : "",

    PAYMENT_TERMS: po.paymentTerms ?? "",
    WORK_DURATION: po.workDuration ?? "",
    WARRANTY: po.warranty ?? "",

    PREPARED_BY: prepared.name,
    PREPARED_BY_POSITION: prepared.position,
    APPROVED_BY: approved.name,
    APROVED_BY: approved.name,
    APPROVED_BY_POSITION: approved.position,
    APROVED_BY_POSITION: approved.position,
    CHECKED_BY: checked.name,
    CHECKED_BY_POSITION: checked.position,

    VERIFIED_BY1,
    VERIFIED_BY_1: VERIFIED_BY1,
    VERIFIED_BY_POSITION1,
    VERIFIED_BY_POSITION_1: VERIFIED_BY_POSITION1,
    VERIFIED_BY2,
    VERIFIED_BY_2: VERIFIED_BY2,
    VERIFIED_BY_POSITION2,
    VERIFIED_BY_POSITION_2: VERIFIED_BY_POSITION2,
  };
}

export function wrapRemarks(remarks: string, maxLength: number = 34): string[] {
  if (!remarks) return [];
  const paragraphs = remarks.split(/\r?\n/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/ +/);
    let currentLine = "";

    for (const word of words) {
      if (word === "") continue;
      
      if (currentLine === "") {
        if (word.length > maxLength) {
          let remaining = word;
          while (remaining.length > maxLength) {
            lines.push(remaining.slice(0, maxLength));
            remaining = remaining.slice(maxLength);
          }
          currentLine = remaining;
        } else {
          currentLine = word;
        }
      } else {
        if (currentLine.length + 1 + word.length <= maxLength) {
          currentLine += " " + word;
        } else {
          lines.push(currentLine);
          if (word.length > maxLength) {
            let remaining = word;
            while (remaining.length > maxLength) {
              lines.push(remaining.slice(0, maxLength));
              remaining = remaining.slice(maxLength);
            }
            currentLine = remaining;
          } else {
            currentLine = word;
          }
        }
      }
    }
    if (currentLine !== "") {
      lines.push(currentLine);
    }
  }
  return lines;
}

export function mapPISData(slip: PaymentInstructionSlip): Record<string, any> {
  const formattedAmount = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: slip.currency === "PHP" ? "PHP" : "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(slip.amount || 0);

  const remarksText = slip.remarks || "";
  const remarksLines = wrapRemarks(remarksText, 34);

  // Amount Type mappings
  const phpCheck = slip.currency === "PHP" ? "X" : "";
  const usdCheck = slip.currency === "USD" ? "X" : "";
  const yenCheck = slip.currency === "JP Yen" ? "X" : "";
  const othersAmountCheck = slip.currency === "Others" ? "X" : "";
  const specifyAmount = slip.currency === "Others" ? (slip.currencyOthers || "") : "";

  // Payment Method mappings
  const cashCheck = slip.paymentMode === "Cash" ? "X" : "";
  const crossedCheck = slip.paymentMode === "Check Crossed" ? "X" : "";
  const notCrossedCheck = slip.paymentMode === "Check Not Crossed" ? "X" : "";
  const ttCheck = slip.paymentMode === "T/T" ? "X" : "";
  const othersPaymentCheck = slip.paymentMode === "Others" ? "X" : "";
  const specifyPayment = slip.paymentMode === "Others" ? (slip.paymentModeOthers || "") : "";

  // Signatory positions defaults
  const position1 = slip.checkedAndVerifiedByPosition || "Department Head";
  const position2 = slip.verifiedByPosition || "Accounting Dept.";
  const position3 = slip.acceptedByPosition || "Purchasing Manager";

  const payments = slip.payments || [];
  const hasPayments = payments.some(p => (p.paymentPurpose || "").trim() !== "" || (p.gross || 0) > 0 || (p.ewt || 0) > 0);
  
  let sumGross = 0;
  let sumEwt = 0;
  let sumTotal = 0;

  if (hasPayments) {
    payments.forEach(p => {
      sumGross += p.gross || 0;
      sumEwt += p.ewt || 0;
      sumTotal += p.total || 0;
    });
  } else {
    sumGross = Number(slip.gross) || 0;
    sumEwt = Number(slip.ewt) || 0;
    sumTotal = Number(slip.total) || 0;
  }

  const hasGross = sumGross > 0;
  const hasEwt = sumEwt > 0;
  const hasTotal = sumTotal > 0;

  const currencyCode = slip.currency === "Others" ? "PHP" : (slip.currency === "JP Yen" ? "JPY" : (slip.currency || "PHP"));
  const formatVal = (val: number | undefined) => {
    if (val === undefined || val === 0) return "";
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const formattedGross = hasGross ? formatVal(sumGross) : "";
  const formattedEwt = hasEwt ? formatVal(sumEwt) : "";
  const formattedTotal = hasTotal ? formatVal(sumTotal) : "";

  const mappedPayments: Record<string, any> = {};
  const maxPayments = Math.max(3, payments.length);
  for (let i = 0; i < maxPayments; i++) {
    const p = payments[i];
    const idx = i + 1;
    if (p && ((p.paymentPurpose || "").trim() !== "" || (p.gross || 0) > 0 || (p.ewt || 0) > 0 || (p as any).poNumber)) {
      mappedPayments[`PO_NO_${idx}`] = (p as any).poNumber || (p as any).po_no || "";
      mappedPayments[`PAYMENT_PURPOSE_${idx}`] = p.paymentPurpose || "";
      mappedPayments[`GROSS_${idx}`] = p.gross > 0 ? formatVal(p.gross) : "";
      mappedPayments[`EWT_${idx}`] = p.ewt > 0 ? formatVal(p.ewt) : "";
      mappedPayments[`TOTAL_${idx}`] = p.total > 0 ? formatVal(p.total) : "";
    } else {
      mappedPayments[`PO_NO_${idx}`] = "";
      mappedPayments[`PAYMENT_PURPOSE_${idx}`] = "";
      mappedPayments[`GROSS_${idx}`] = "";
      mappedPayments[`EWT_${idx}`] = "";
      mappedPayments[`TOTAL_${idx}`] = "";
    }
  }

  return {
    payments: slip.payments || [],
    PIS_NO: slip.pisNumber ?? "",
    "PIS NO": slip.pisNumber ?? "",
    SCHEDULE_DATE: slip.scheduleDate ?? "",
    "SCHEDULE DATE": slip.scheduleDate ?? "",
    PAYMENT_DATE: slip.scheduleDate ?? "", // Map to template placeholder
    "PAYMENT DATE": slip.scheduleDate ?? "",
    SCHEDULE_TIME: `${slip.scheduleTime || ""} ${slip.ampm || ""}`.trim(),
    "SCHEDULE TIME": `${slip.scheduleTime || ""} ${slip.ampm || ""}`.trim(),
    PAYEE: slip.payee ?? "",
    AMOUNT: formattedAmount,
    GROSS: formattedGross,
    EWT: formattedEwt,
    TOTAL: formattedTotal,
    HAS_GROSS: hasGross,
    HAS_EWT: hasEwt,
    HAS_TOTAL: hasTotal,
    EWT_PERCENTAGE: hasEwt ? formattedEwt : "",
    ...mappedPayments,
    CURRENCY: slip.currency === "Others" ? slip.currencyOthers : (slip.currency || ""),
    PAYMENT_MODE: slip.paymentMode === "Others" ? slip.paymentModeOthers : (slip.paymentMode || ""),
    REMARKS: slip.remarks || "",
    REMARKS_LINE_1: remarksLines[0] || "",
    REMARKS_LINE_2: remarksLines[1] || "",
    REMARKS_LINE_3: remarksLines[2] || "",
    REMARKS_LINE_4: remarksLines[3] || "",
    REMARKS_LINE_5: remarksLines[4] || "",
    REQUESTED_BY: slip.requestedBy ?? "",
    "REQUESTED BY": slip.requestedBy ?? "",
    REQUESTED_DATE: slip.requestedDate ?? "",
    "REQUESTED DATE": slip.requestedDate ?? "",
    CHECKED_BY: slip.checkedAndVerifiedBy || "",
    "CHECKED BY": slip.checkedAndVerifiedBy || "",
    VERIFIED_BY: slip.verifiedBy || "",
    "VERIFIED BY": slip.verifiedBy || "",
    ACCEPTED_BY: slip.acceptedBy || "",
    "ACCEPTED BY": slip.acceptedBy || "",
    STATUS: slip.status ?? "",

    // AM/PM Checkmarks
    AM: slip.ampm === "AM" ? "X" : "",
    PM: slip.ampm === "PM" ? "X" : "",

    // Placeholder checkboxes & text
    PHP: phpCheck,
    US: usdCheck,
    YEN: yenCheck,
    OTHERS_AMOUNT: othersAmountCheck,
    SPECIFY_AMOUNT: specifyAmount,
    CASH: cashCheck,
    CROSSED: crossedCheck,
    NOT_CROSSED: notCrossedCheck,
    TT: ttCheck,
    OTHERS_PAYMENT: othersPaymentCheck,
    SPECIFY_PAYMENT: specifyPayment,
    POSITION_1: position1,
    "POSITION 1": position1,
    POSITION_2: position2,
    "POSITION 2": position2,
    POSITION_3: position3,
    "POSITION 3": position3,
  };
}

export function mapRFSData(req: RequestForSupply): { exportData: Record<string, any>; items: any[] } {
  const formattedRFS = formatRFSNo(req.rfsNumber, req.dateRequested);
  
  const items = (req.items || []).map((it, index) => ({
    index: index + 1,
    quantity: it.quantity || 0,
    unit: it.unit || "",
    description: it.description || "",
    item: it.description || "",
    lastPurchaseDate: it.lastPurchaseDate || "",
    lastPurchaseQuantity: it.lastPurchaseQuantity || 0,
    lastPurchaseUnitPrice: it.lastPurchaseUnitPrice || 0,
    currentPurchaseDate: it.currentPurchaseDate || "",
    currentPurchaseQuantity: it.currentPurchaseQuantity || 0,
    currentPurchaseUnitPrice: it.currentPurchaseUnitPrice || 0,
    remarks: it.remarks || "",
    isItalic: false,
  }));

  if (req.addNothingFollows) {
    items.push({
      index: items.length + 1,
      quantity: "",
      unit: "",
      description: "*****NOTHING FOLLOWS*****",
      item: "*****NOTHING FOLLOWS*****",
      lastPurchaseDate: "",
      lastPurchaseQuantity: "",
      lastPurchaseUnitPrice: "",
      currentPurchaseDate: "",
      currentPurchaseQuantity: "",
      currentPurchaseUnitPrice: "",
      remarks: "",
      isItalic: true,
    } as any);
  }

  const exportData = {
    RFS_NO: formattedRFS,
    REQUEST_DATE: req.dateRequested ?? "",
    DUE_DATE: req.dueDate || "",
    RECEIVED_DATE: req.dueDate || "", // Map to template placeholder
    DEPARTMENT: req.department === "Others" ? req.departmentOthers : (req.department || ""),
    CONTROL_NO: formattedRFS,
    PO_NO: req.purchaseOrderNumber || "",
    STATUS: req.status ?? "",
    MODE: req.modeOfRequest ?? "",
    PURPOSE: req.purpose ?? "",
    REQUESTED_BY: req.requestedBy ?? "",
    VERIFIED_BY: req.verifiedBy || "",
    APPROVED_BY: req.approvedBy || "",
    
    // Add joined line mappings for single-cell Word templates
    QTY: items.map(it => String(it.quantity || "")).join("\n"),
    UNIT: items.map(it => it.unit || "").join("\n"),
    ITEM_DESCRIPTION: items.map(it => it.description || "").join("\n"),
    REMARKS: items.map(it => it.remarks || "").join("\n")
  };

  return { exportData, items };
}

export function mapCanvassData(sheet: CanvassSheet): { exportData: Record<string, any>; excelShops: any[]; excelItems: any[] } {
  const sList = sheet.shops || sheet.suppliersList || [];
  const pList = sheet.parts || sheet.partsList || [];

  const formatCurrencyLocal = (val: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const exportData: Record<string, any> = {
    Control_NO: sheet.canvassNumber ?? "",
    Category: sheet.category || "General Procurement",
    Plate_No: sheet.plateNo || "",
    remarks: sheet.remarks || "",
    parts1: pList.map((p) => p.description).join("\n"),
    partsList: pList,
    PREPARED_BY: sheet.requestedBy || "",
    PREPARED_BY_POSITION: sheet.preparedByPosition || "Canvasser",
    CHECKED_BY: sheet.checkedBy || "",
    CHECKED_BY_POSITION: sheet.checkedByPosition || "Maintenance Supervisor",
    VERIFIED_BY: sheet.verifiedBy || "",
    VERIFIED_BY_POSITION: sheet.verifiedByPosition || "Operations Manager",
    APPROVED_BY: sheet.approvedBy || "",
    APPROVED_BY_POSITION: sheet.approvedByPosition || "Purchasing Manager",
  };

  // Populate dynamic suppliers 1 -> N
  sList.forEach((s, idx) => {
    const suffix = idx + 1;
    const total_shop_val = pList.reduce((sum, p) => sum + (Number(p.prices[s.id]) || 0), 0);
    const vat_val = 0;
    const total_amount_val = total_shop_val;

    exportData[`shop_name${suffix}`] = s.name || "";
    exportData[`contact_person${suffix}`] = s.contactPerson || "";
    exportData[`contact_no${suffix}`] = s.contactNo || "";
    exportData[`work_duration${suffix}`] = s.workDuration || "";
    exportData[`warranty${suffix}`] = s.warranty || "";
    exportData[`payment_terms${suffix}`] = s.paymentTerms || "";
    exportData[`parts_shop${suffix}_price${suffix}`] = pList.map((p) => (p.prices[s.id] ? formatCurrencyLocal(p.prices[s.id]) : "-")).join("\n");
    exportData[`total_shop${suffix}`] = formatCurrencyLocal(total_shop_val);
    exportData[`vat${suffix}`] = formatCurrencyLocal(vat_val);
    exportData[`total_amount${suffix}`] = formatCurrencyLocal(total_amount_val);
  });

  // Backward compatible fallbacks in case sList is empty
  if (sList.length === 0) {
    exportData[`shop_name1`] = "";
    exportData[`contact_person1`] = "";
    exportData[`contact_no1`] = "";
    exportData[`work_duration1`] = "";
    exportData[`warranty1`] = "";
    exportData[`payment_terms1`] = "";
    exportData[`parts_shop1_price1`] = pList.map(() => "-").join("\n");
    exportData[`total_shop1`] = formatCurrencyLocal(0);
    exportData[`vat1`] = formatCurrencyLocal(0);
    exportData[`total_amount1`] = formatCurrencyLocal(0);
  }

  // Populate individual item fields for Word/PDF row cloning
  pList.forEach((part, partIdx) => {
    exportData[`part_desc_${partIdx}`] = part.description || "";
    sList.forEach((s, sIdx) => {
      const i = sIdx + 1;
      const priceVal = part.prices && part.prices[s.id];
      exportData[`part_price_${i}_${partIdx}`] = (priceVal !== undefined && priceVal !== null && priceVal !== "")
        ? formatCurrencyLocal(Number(priceVal))
        : "-";
    });
    if (sList.length === 0) {
      exportData[`part_price_1_${partIdx}`] = "-";
    }
  });

  const excelShops = sList.map((s) => {
    const t = pList.reduce((sum, p) => sum + (Number(p.prices[s.id]) || 0), 0);
    const v = 0;
    return {
      name: s.name || "",
      contact_person: s.contactPerson || "",
      contact_no: s.contactNo || "",
      work_duration: s.workDuration || "",
      warranty: s.warranty || "",
      payment_terms: s.paymentTerms || "",
      prices: pList.map((p) => p.prices[s.id] || 0),
      total: t,
      vat: v,
      total_amount: t,
    };
  });

  const s0 = sList[0] || { id: "s0" };
  const s1 = sList[1] || { id: "s1" };
  const excelItems = pList.map((p, idx) => ({
    index: idx + 1,
    item: p.description,
    quantity: 1,
    unit: "pcs",
    supplierAPrice: p.prices[s0.id] || 0,
    supplierBPrice: p.prices[s1.id] || 0,
    supplierCPrice: (sList[2] && p.prices[sList[2].id]) || 0,
  }));

  return { exportData, excelShops, excelItems };
}
