import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";
import { PurchaseOrder } from "../types";
import { exportWordWithTemplate, exportExcelWithTemplate } from "./templateExport";
import { formatRFSNo } from "./templateMapping";

// Reusable currency helper supporting dynamic currency symbols and preventing cell wrapping
export const formatCurrency = (val: number | string | undefined | null, symbol: string = "₱"): string => {
  if (val === undefined || val === null || val === "") return "";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "";
  // Use non-breaking space (\u00A0) to guarantee currency symbol and amount do not split/wrap
  return `${symbol}\u00A0${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Helper to clean and format signatory names and titles, enforcing non-breaking spaces when blank
const getSignatoryValue = (val: string | undefined | null, isExcluded?: boolean): string => {
  if (isExcluded) return "\u00A0";
  if (!val || !val.trim()) return "\u00A0";
  return val.trim();
};

// Helper to left-align signatory name and position title in the generated Word document.
// The name and position title are left-aligned to start directly below the left edge of the underline.
// Empty names or positions use a non-breaking space (\u00A0) to preserve the layout.
const formatDate = (dateString: string): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
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

// Align left padding helper for left-side metadata fields
const padValueLeft = (val: string | undefined | null, targetLen: number = 52): string => {
  const str = (val ?? "").trim();
  if (str.length >= targetLen) return str;
  return str.padEnd(targetLen, " ");
};

// Align left padding helper for right-side metadata fields
const padValueRight = (val: string | undefined | null, targetLen: number = 25): string => {
  const str = (val ?? "").trim();
  if (str.length >= targetLen) return str;
  return str.padEnd(targetLen, " ");
};

// Helper to inject single underline formatting style into specific placeholder text runs in Word XML
const addUnderlineToPlaceholder = (xml: string, placeholder: string): string => {
  const regex = new RegExp(`(<w:r\\b[^>]*>)(?:(<w:rPr\\b[^>]*>[\\s\\S]*?<\\/w:rPr>))?(.*?<w:t\\b[^>]*>\\{\\{${placeholder}\\}\\}<\\/w:t>)`, "g");
  return xml.replace(regex, (match, rTag, rPrBlock, rest) => {
    if (rPrBlock) {
      if (!rPrBlock.includes("w:u")) {
        const updatedRPr = rPrBlock.replace("</w:rPr>", '<w:u w:val="single"/></w:rPr>');
        return `${rTag}${updatedRPr}${rest}`;
      }
      return match;
    } else {
      return `${rTag}<w:rPr><w:u w:val="single"/></w:rPr>${rest}`;
    }
  });
};

/**
 * Merges split double-curly-braces {{...}} placeholders in the XML content safely and robustly.
 * Spelling grammar checks and formatting changes can cause Word to split placeholders 
 * across multiple elements, which breaks Docxtemplater parsing.
 */
const cleanSplitPlaceholders = (xml: string): string => {
  let cleaned = xml.replace(/<w:proofErr\b[^>]*\/>/g, "");
  
  // Step 1: Merge split start and end brace characters separated by run/text boundaries
  cleaned = cleaned.replace(/\{<\/w:t>(?:<[^>]+>|\s)*?<w:t\b[^>]*>\{/g, "{{");
  cleaned = cleaned.replace(/\}<\/w:t>(?:<[^>]+>|\s)*?<w:t\b[^>]*>\}/g, "}}");
  
  // Step 2: Strip any intervening run/text boundaries inside curly braces
  cleaned = cleaned.replace(/\{\{((?:(?!\{\{)[\s\S])*?)\}\}/g, (match, p1) => {
    const stripped = p1.replace(/<\/w:t>[\s\S]*?<w:t\b[^>]*>/g, "");
    return `{{${stripped}}}`;
  });

  // Step 3: Backward-compatibility check using splitRegex
  const splitRegex = /(\{\{[^}]+?)<\/w:t><\/w:r>(?:<w:proofErr\b[^>]*\/>)?<w:r\b[^>]*>(?:<w:rPr>[^]*?<\/w:rPr>)?<w:t\b[^>]*>([^}]*?\}\})/g;
  
  let prevCleaned;
  do {
    prevCleaned = cleaned;
    cleaned = cleaned.replace(splitRegex, "$1$2");
  } while (cleaned !== prevCleaned);
  
  return cleaned;
};

/**
 * Truncates description text so it doesn't exceed a maximum line count.
 * Elegant, purely string-based, 100% compliant OpenXML representation.
 */
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
      const allowedChars = allowedChunks * charsPerLine - 3; // Space for "..."
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

/**
 * Safely removes empty spacer paragraphs from a table cell to compensate for newly added text lines.
 */
const removeSpacerParagraphs = (cellXml: string, totalExcessLines: number, placeholderText: string): string => {
  if (totalExcessLines <= 0) return cellXml;

  // Extract all paragraphs in the cell precisely
  const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  const matches: { full: string; inner: string }[] = [];
  let match;
  
  pRegex.lastIndex = 0;
  while ((match = pRegex.exec(cellXml)) !== null) {
    matches.push({
      full: match[0],
      inner: match[1]
    });
  }

  // A paragraph is a spacer if it doesn't contain the placeholder and has no text content
  const spacerParagraphs: typeof matches = [];
  for (const m of matches) {
    const isMainPlaceholder = m.inner.includes(placeholderText);
    const hasText = m.inner.includes("<w:t");
    if (!isMainPlaceholder && !hasText) {
      spacerParagraphs.push(m);
    }
  }

  // Safely remove up to totalExcessLines of spacer paragraphs
  const toRemoveCount = Math.min(totalExcessLines, spacerParagraphs.length);
  if (toRemoveCount <= 0) return cellXml;

  const parasToRemove = spacerParagraphs.slice(0, toRemoveCount);
  let updatedCellXml = cellXml;
  for (const p of parasToRemove) {
    updatedCellXml = updatedCellXml.replace(p.full, "");
  }

  return updatedCellXml;
};

export const exportPOToWord = async (po: PurchaseOrder) => {
  // 1. EXPORT VALIDATION
  const errors: string[] = [];
  if (!po) {
    alert("No Purchase Order data provided.");
    return;
  }
  if (!po.poNumber) errors.push("P.O. Number is required.");
  if (!po.poDate) errors.push("P.O. Date is required.");
  if (!po.deliveryDate) errors.push("Delivery Date is required.");
  if (!po.supplierName) errors.push("Supplier Name is required.");
  if (!po.preparedBy) errors.push("Prepared By signatory is required.");
  
  if (errors.length > 0) {
    alert(`Cannot export Purchase Order due to validation errors:\n\n${errors.map(e => `• ${e}`).join("\n")}`);
    return;
  }

  // Derive RFS No. dynamically
  const rfsNo = formatRFSNo(po.rfsNumber || po.poNumber.split("-").pop() || "10672", po.poDate);

  // Selected or default currency symbol
  const symbol = po.currencySymbol || "₱";

  // Helper to calculate physical lines of text in Cell 3 (NAME / DESCRIPTION OF ITEM)
  const getWrappedLineCount = (text: string, charsPerLine: number = 59): number => {
    if (!text) return 1;
    const lines = text.split("\n");
    let totalLines = 0;
    lines.forEach(line => {
      totalLines += Math.max(1, Math.ceil(line.length / charsPerLine));
    });
    return totalLines;
  };

  const formattedPurpose = (po.purpose ?? "").toUpperCase();

  // 2. CURRENCY ALIGNMENT & MULTI-LINE ITEMS FORMATTING
  const itemsCount = po.items.length;

  const qtyLines: string[] = [];
  const unitLines: string[] = [];
  const descLines: string[] = [];
  const priceLines: string[] = [];
  const amountLines: string[] = [];
  const items: any[] = [];

  let totalDescLines = 0;
  const MAX_TOTAL_DESC_LINES = 18; // Max description lines allowed across all items on 1 page

  for (let i = 0; i < itemsCount; i++) {
    const item = po.items[i];
    let desc = item.description || "";

    // Safely truncate descriptions if we exceed total vertical space budget
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

    // Add clean item for the looping mechanism
    items.push({
      quantity: String(item.quantity || ""),
      unit: item.unit || "",
      description: desc,
      unitPrice: formatCurrency(item.unitPrice, symbol),
      amount: formatCurrency(item.amount, symbol)
    });

    // Align other columns by padding them with extra empty lines to match description's wrapped lines
    for (let pad = 1; pad < lCount; pad++) {
      qtyLines.push("");
      unitLines.push("");
      priceLines.push("");
      amountLines.push("");
    }
  }

  const QUANTITY = qtyLines.join("\n");
  const UNIT = unitLines.join("\n");
  const DESCRIPTION = descLines.join("\n");
  const UNIT_PRICE = priceLines.join("\n");
  const AMOUNT = amountLines.join("\n");

  const SUPPLIER_NAME_LINE = padValueLeft(po.supplierName);
  const ATTENTION_LINE = padValueLeft(po.attention);
  const TEL_FAX_LINE = padValueLeft(`${po.telNo ?? ""} ${po.faxNo ? `/ ${po.faxNo}` : ""}`.trim());
  const PURPOSE_LINE = padValueLeft(formattedPurpose);

  const PO_NUMBER_LINE = padValueRight(po.poNumber);
  const PO_DATE_LINE = padValueRight(po.poDate);
  const DELIVERY_DATE_LINE = padValueRight(po.deliveryDate);
  const CATEGORY_LINE = padValueRight(po.category || "Vatable");

  // Signatories and Titles
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

  const { mapPOData } = await import("./templateMapping");
  const exportData = mapPOData(po);

  // Log export action asynchronously to match audit trail behavior
  try {
    await fetch("/api/audit/log-export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("smei_jwt_token")}`
      },
      body: JSON.stringify({
        action: "Export PO",
        module: "Purchase Orders",
        details: `Exported Purchase Order Word document (PO Number: ${po.poNumber})`
      })
    });
  } catch (err) {
    console.error("Failed to log Word export activity:", err);
  }

  // Reuse the existing template export service as required by the guidelines
  await exportWordWithTemplate(
    "PO_TEMPLATE.docx",
    exportData,
    `${po.poNumber}_SMEI_PO.docx`
  );
};

export const exportPOToXLSM = async (po: PurchaseOrder) => {
  if (!po) {
    alert("No Purchase Order data provided.");
    return;
  }
  const errors: string[] = [];
  if (!po.poNumber) errors.push("P.O. Number is required.");
  if (!po.poDate) errors.push("P.O. Date is required.");
  if (!po.deliveryDate) errors.push("Delivery Date is required.");
  if (!po.supplierName) errors.push("Supplier Name is required.");

  if (errors.length > 0) {
    alert(`Cannot export Purchase Order due to validation errors:\n\n${errors.map(e => `• ${e}`).join("\n")}`);
    return;
  }

  try {
    const { mapPOData } = await import("./templateMapping");
    const mapped = mapPOData(po);
    const poNo = (po.poNumber || "PO").toUpperCase();
    await exportExcelWithTemplate("PO_TEMPLATE.xlsm", mapped, "items", mapped.items || [], `${poNo}_SMEI_PO.xlsm`);
  } catch (err: any) {
    console.error("Export PO XLSM Error:", err);
    alert(err.message || "Failed to export Purchase Order to XLSM template.");
  }
};
