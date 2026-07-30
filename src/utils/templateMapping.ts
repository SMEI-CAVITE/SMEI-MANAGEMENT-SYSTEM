import { PurchaseOrder, PaymentInstructionSlip, RequestForSupply, CanvassSheet } from "../types";
import { calculatePOFinancials } from "../store";

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
  const formattedPurpose = (po.purpose ?? "").toUpperCase();
  
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

  const itemIndexedData: Record<string, string> = {};
  const maxItemsIndex = Math.max(8, itemsCount);
  for (let idx = 1; idx <= maxItemsIndex; idx++) {
    const item = po.items && po.items[idx - 1];
    if (item) {
      itemIndexedData[`QUANTITY${idx}`] = item.quantity !== undefined && item.quantity !== null && String(item.quantity) !== "" ? String(item.quantity) : "";
      itemIndexedData[`UNIT${idx}`] = item.unit || "";
      itemIndexedData[`DESCRIPTION${idx}`] = item.description || "";
      itemIndexedData[`UNIT_PRICE${idx}`] = item.unitPrice !== undefined && item.unitPrice !== null && String(item.unitPrice) !== "" ? formatCurrency(item.unitPrice, symbol) : "";
      itemIndexedData[`AMOUNT${idx}`] = item.amount !== undefined && item.amount !== null && String(item.amount) !== "" ? formatCurrency(item.amount, symbol) : "";
    } else {
      itemIndexedData[`QUANTITY${idx}`] = "";
      itemIndexedData[`UNIT${idx}`] = "";
      itemIndexedData[`DESCRIPTION${idx}`] = "";
      itemIndexedData[`UNIT_PRICE${idx}`] = "";
      itemIndexedData[`AMOUNT${idx}`] = "";
    }
  }

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

  const category = po.category || "Vatable";
  const catLower = category.toLowerCase();
  const isVatable = catLower.includes("vatable");
  const isExempt = catLower.includes("exempt") || catLower.includes("gas");
  const isZero = catLower.includes("zero");

  const partsEwtRate = po.partsEwtPercentage !== undefined ? po.partsEwtPercentage / 100 : 0.01;
  const laborEwtRate = po.laborEwtPercentage !== undefined ? po.laborEwtPercentage / 100 : 0.02;

  const computed = calculatePOFinancials(
    po.items || [],
    category,
    po.discountVatAmount || 0,
    partsEwtRate,
    laborEwtRate
  );

  const itemsSum = po.items ? po.items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0) : 0;

  const isOverride = !!(po as any).overrideVat;

  const vatableAmount = isVatable
    ? (isOverride && po.vatableAmount !== undefined && po.vatableAmount !== null ? po.vatableAmount : computed.vatableAmount)
    : 0;

  const vat12 = isVatable
    ? (isOverride && po.vat12 !== undefined && po.vat12 !== null ? po.vat12 : computed.vat12)
    : 0;

  const vatExemptAmount = isExempt
    ? (isOverride && po.vatExemptAmount !== undefined && po.vatExemptAmount !== null ? po.vatExemptAmount : computed.vatExemptAmount)
    : 0;

  const zeroRatedAmount = isZero
    ? (isOverride && po.zeroRatedAmount !== undefined && po.zeroRatedAmount !== null ? po.zeroRatedAmount : computed.zeroRatedAmount)
    : 0;

  const partsEwt1 = isOverride && po.partsEwt1 !== undefined && po.partsEwt1 !== null ? po.partsEwt1 : computed.partsEwt1;
  const laborEwt2 = isOverride && po.laborEwt2 !== undefined && po.laborEwt2 !== null ? po.laborEwt2 : computed.laborEwt2;
  const discountVatAmount = po.discountVatAmount || 0;

  const grossAmount = isOverride && po.grossAmount !== undefined && po.grossAmount !== null ? po.grossAmount : computed.grossAmount;
  const totalAmount = isOverride && po.totalAmount !== undefined && po.totalAmount !== null ? po.totalAmount : computed.totalAmount;

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

    ...itemIndexedData,

    items,

    VATABLE_AMOUNT: isVatable ? formatCurrency(vatableAmount, symbol) : "",
    VAT_AMOUNT: isVatable ? formatCurrency(vat12, symbol) : "",
    VAT_EXEMPT_AMOUNT: isExempt ? formatCurrency(vatExemptAmount, symbol) : "",
    ZERO_RATED_AMOUNT: isZero ? formatCurrency(zeroRatedAmount, symbol) : "",
    TOTAL_AMOUNT: formatCurrency(totalAmount, symbol),
    GROSS_AMOUNT: formatCurrency(grossAmount, symbol),
    PARTS_EWT: partsEwt1 > 0 ? formatCurrency(partsEwt1, symbol) : "",
    LABOR_EWT: laborEwt2 > 0 ? formatCurrency(laborEwt2, symbol) : "",
    EWT_TYPE: po.ewtType ?? "",
    EWT_PERCENTAGE: po.ewtPercentage !== undefined ? `${po.ewtPercentage}%` : "",
    DISCOUNT_VAT_AMOUNT: discountVatAmount > 0 ? formatCurrency(discountVatAmount, symbol) : "",

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
  const rawPayments = (payments && payments.length > 0)
    ? payments
    : [
        {
          id: "1",
          completedPOId: slip.completedPOId || "",
          completedPONumber: slip.completedPONumber || slip.poNumber || "",
          poNumber: slip.completedPONumber || slip.poNumber || "",
          paymentPurpose: slip.remarks || "",
          gross: slip.gross !== undefined ? slip.gross : slip.amount,
          ewt: slip.ewt !== undefined ? slip.ewt : 0,
          total: slip.total !== undefined ? slip.total : slip.amount
        }
      ];

  const activePayments = rawPayments.filter(
    p => (p.paymentPurpose || "").trim() !== "" || (p.completedPONumber || p.poNumber || "").trim() !== "" || (p.gross || 0) > 0 || (p.ewt || 0) > 0
  );

  const hasPayments = activePayments.length > 0;
  
  let sumGross = 0;
  let sumEwt = 0;
  let sumTotal = 0;
  let ewtPercentageStr = "1%";

  if (hasPayments) {
    activePayments.forEach(p => {
      sumGross += p.gross || 0;
      const absEwt = (p.gross || 0) * (p.ewt || 0) / 100;
      sumEwt += absEwt;
      sumTotal += p.total || 0;
      if (p.ewt > 0) {
        ewtPercentageStr = `${p.ewt}%`;
      }
    });
  } else {
    sumGross = Number(slip.gross) || 0;
    const absEwt = (slip.gross || 0) * (slip.ewt || 0) / 100;
    sumEwt = absEwt || 0;
    sumTotal = Number(slip.total) || 0;
    if (slip.ewt && slip.ewt > 0) {
      ewtPercentageStr = `${slip.ewt}%`;
    }
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
  const pisPaymentEntries: Array<{ poNumber: string; purposeText: string; gross: number; ewt: number; total: number }> = [];

  const maxEntries = Math.max(3, activePayments.length);
  for (let i = 0; i < maxEntries; i++) {
    const p = activePayments[i];
    const idx = i + 1;
    if (p && ((p.paymentPurpose || "").trim() !== "" || (p.completedPONumber || p.poNumber || "").trim() !== "" || (p.gross || 0) > 0 || (p.ewt || 0) > 0)) {
      const poRef = (p.completedPONumber || p.poNumber || "").toUpperCase().slice(0, 40);
      const purposeText = (p.paymentPurpose || "").toUpperCase();

      mappedPayments[`COMPLETED_PO_${idx}`] = poRef;
      mappedPayments[`COMPLETED_PO_NUMBER_${idx}`] = poRef;
      mappedPayments[`COMPLETED_PO_NO_${idx}`] = poRef;
      mappedPayments[`PO_NO_${idx}`] = poRef;
      mappedPayments[`PO_NO${idx}`] = poRef;
      mappedPayments[`PO_NUMBER_${idx}`] = poRef;
      mappedPayments[`PO_REF_${idx}`] = poRef;
      mappedPayments[`PO_REFERENCE_${idx}`] = poRef;
      mappedPayments[`PO_${idx}`] = poRef;
      mappedPayments[`PO${idx}`] = poRef;

      mappedPayments[`PAYMENT_PURPOSE_${idx}`] = purposeText;
      mappedPayments[`PURPOSE_${idx}`] = purposeText;
      mappedPayments[`PURPOSE${idx}`] = purposeText;

      const absEwt = (p.gross || 0) * (p.ewt || 0) / 100;
      mappedPayments[`GROSS_${idx}`] = p.gross > 0 ? formatVal(p.gross) : "";
      mappedPayments[`EWT_${idx}`] = absEwt > 0 ? formatVal(absEwt) : "";
      mappedPayments[`TOTAL_${idx}`] = p.total > 0 ? formatVal(p.total) : "";

      pisPaymentEntries.push({
        poNumber: poRef,
        purposeText: purposeText,
        gross: p.gross || 0,
        ewt: p.ewt || 0,
        total: p.total || 0
      });
    } else {
      mappedPayments[`COMPLETED_PO_${idx}`] = "";
      mappedPayments[`COMPLETED_PO_NUMBER_${idx}`] = "";
      mappedPayments[`COMPLETED_PO_NO_${idx}`] = "";
      mappedPayments[`PO_NO_${idx}`] = "";
      mappedPayments[`PO_NO${idx}`] = "";
      mappedPayments[`PO_NUMBER_${idx}`] = "";
      mappedPayments[`PO_REF_${idx}`] = "";
      mappedPayments[`PO_REFERENCE_${idx}`] = "";
      mappedPayments[`PO_${idx}`] = "";
      mappedPayments[`PO${idx}`] = "";

      mappedPayments[`PAYMENT_PURPOSE_${idx}`] = "";
      mappedPayments[`PURPOSE_${idx}`] = "";
      mappedPayments[`PURPOSE${idx}`] = "";

      mappedPayments[`GROSS_${idx}`] = "";
      mappedPayments[`EWT_${idx}`] = "";
      mappedPayments[`TOTAL_${idx}`] = "";
    }
  }

  const primaryPO = (
    payments.find(p => (p.completedPONumber || p.poNumber || "").trim() !== "")?.completedPONumber ||
    payments.find(p => (p.completedPONumber || p.poNumber || "").trim() !== "")?.poNumber ||
    slip.completedPONumber ||
    slip.poNumber ||
    ""
  ).toUpperCase().slice(0, 40);

  const primaryPurpose = (
    payments.find(p => (p.paymentPurpose || "").trim() !== "")?.paymentPurpose ||
    slip.remarks ||
    ""
  ).toUpperCase().slice(0, 40);

  return {
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
    EWT_PERCENTAGE: ewtPercentageStr,
    ...mappedPayments,
    PIS_PAYMENT_ENTRIES: pisPaymentEntries,
    COMPLETED_PO: primaryPO,
    "COMPLETED PO": primaryPO,
    COMPLETED_PO_NUMBER: primaryPO,
    "COMPLETED PO NUMBER": primaryPO,
    COMPLETED_PO_NO: primaryPO,
    "COMPLETED PO NO": primaryPO,
    PO_NO: primaryPO,
    "PO NO": primaryPO,
    PO_NUMBER: primaryPO,
    "PO NUMBER": primaryPO,
    PO_REF: primaryPO,
    "PO REF": primaryPO,
    PO_REFERENCE: primaryPO,
    "PO REFERENCE": primaryPO,
    PAYMENT_PURPOSE: primaryPurpose,
    "PAYMENT PURPOSE": primaryPurpose,
    CURRENCY: slip.currency === "Others" ? slip.currencyOthers : (slip.currency || ""),
    PAYMENT_MODE: slip.paymentMode === "Others" ? slip.paymentModeOthers : (slip.paymentMode || ""),
    REMARKS: slip.remarks || "",
    REMARKS_LINE_1: remarksLines[0] || "",
    REMARKS_LINE_2: remarksLines[1] || "",
    REMARKS_LINE_3: "",
    REMARKS_LINE_4: "",
    REMARKS_LINE_5: "",
    REMARKS3: "",
    REMARKS4: "",
    REMARKS_3: "",
    REMARKS_4: "",
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
    lastPurchaseDate: it.lastPurchaseDate || "",
    lastPurchaseQuantity: it.lastPurchaseQuantity || 0,
    lastPurchaseUnitPrice: it.lastPurchaseUnitPrice || 0,
    currentPurchaseDate: it.currentPurchaseDate || "",
    currentPurchaseQuantity: it.currentPurchaseQuantity || 0,
    currentPurchaseUnitPrice: it.currentPurchaseUnitPrice || 0,
    remarks: it.remarks || "",
  }));

  if (req.addNothingFollows) {
    items.push({
      index: items.length + 1,
      quantity: "" as any,
      unit: "",
      description: "*****NOTHING FOLLOWS*****",
      lastPurchaseDate: "",
      lastPurchaseQuantity: 0,
      lastPurchaseUnitPrice: 0,
      currentPurchaseDate: "",
      currentPurchaseQuantity: 0,
      currentPurchaseUnitPrice: 0,
      remarks: "",
    });
  }

  const statusRaw = (req.status || "").toString().trim().toLowerCase();
  const modeRaw = (req.modeOfRequest || "").toString().trim().toLowerCase();

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

    // RFS Status checkbox marks
    complete: statusRaw === "complete" ? "x" : "",
    on_time: statusRaw === "on time" || statusRaw === "on_time" || statusRaw === "ontime" ? "x" : "",
    late: statusRaw === "late" ? "x" : "",
    incomplete: statusRaw === "incomplete" ? "x" : "",

    // Mode of Request checkbox marks
    emergency: modeRaw === "emergency" ? "x" : "",
    urgent: modeRaw === "urgent" ? "x" : "",
    regular: modeRaw === "regular" ? "x" : "",
    irregular: modeRaw === "irregular" ? "x" : "",
    
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
