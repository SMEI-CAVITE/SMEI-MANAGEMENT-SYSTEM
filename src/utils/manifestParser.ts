/**
 * Zero-Cost Client-Side Document Extraction & Parsing Engine
 * Method 1: pdfjs-dist Native Text Extraction
 * Method 2: Tesseract.js OCR Fallback for Scanned PDFs
 * Method 3: Label & Regex Structured Field Parser
 * Method 4: Deterministic Confidence Model
 */

import * as pdfjsLib from "pdfjs-dist";

// Configure pdfjs worker URL
if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

export interface ManifestExtractionResult {
  companyName: string | null;
  deliveryDate: string | null; // YYYY-MM-DD
  formattedDeliveryDate: string | null; // e.g., JULY 20, 2026
  tpNumber: string | null; // Transport Permit No.
  manifestNo: string | null; // Manifest No.
  quantity: number | null; // Metric Tonnes
  caNoFromPdf: string | null; // CA No found in PDF text if present

  extractionMethod: "native-pdf-text" | "tesseract-ocr" | "manual-review";
  confidence: "high" | "medium" | "low";

  validation: {
    companyName: boolean;
    deliveryDate: boolean;
    tpNumber: boolean;
    manifestNo: boolean;
    quantity: boolean;
    caNo: boolean;
  };

  warnings: string[];
  rawText?: string;
}

// Regex Patterns
const TP_PATTERN = /OL-P-[A-Z0-9]+-\d{2}-\d{5,7}/i;
const MANIFEST_PATTERN = /M-[A-Z0-9]+-\d{4}-\d{2}-\d{5,7}/i;
const CA_PATTERN = /\b\d{2}-\d{4}-\d{2}\b/;
const DATE_PATTERN_1 = /(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+\d{1,2},?\s+\d{4}/i;
const DATE_PATTERN_2 = /\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/;
const DATE_PATTERN_3 = /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{4}\b/;

/**
 * Normalizes date string to YYYY-MM-DD format and generates display date (e.g. 20-Jul-26)
 */
function normalizeDate(rawDateStr: string): { iso: string; display: string } | null {
  try {
    const cleaned = rawDateStr.replace(/,/g, " ").replace(/\s+/g, " ").trim();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // YYYY-MM-DD
    const isoMatch = cleaned.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (isoMatch) {
      const year = isoMatch[1];
      const mIdx = parseInt(isoMatch[2], 10) - 1;
      const month = String(mIdx + 1).padStart(2, "0");
      const day = String(parseInt(isoMatch[3], 10)).padStart(2, "0");
      if (mIdx >= 0 && mIdx < 12) {
        const display = `${day}-${months[mIdx]}-${year.slice(-2)}`;
        return { iso: `${year}-${month}-${day}`, display };
      }
    }

    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");

      const display = `${day}-${months[d.getMonth()]}-${String(year).slice(-2)}`;
      return { iso: `${year}-${month}-${day}`, display };
    }
  } catch (e) {
    console.warn("Date parsing failed for:", rawDateStr, e);
  }
  return null;
}

/**
 * Formats any date string into dd-MMM-yy format (e.g. 20-Jul-26)
 */
export function formatDateDdMmmYy(dateStr: string | null | undefined): string {
  if (!dateStr || !dateStr.trim()) return "";
  const parsed = normalizeDate(dateStr);
  return parsed ? parsed.display : dateStr.trim();
}

/**
 * Cleans extracted company name string to stop at DENR manifest section boundaries
 * (Address, Registration No, Transporter, Facility, Tel, Phone, etc.)
 */
function cleanCompanyName(rawStr: string): string {
  if (!rawStr) return "";
  let cleaned = rawStr.trim();

  // Stop keywords for DENR HazWaste Manifests
  const stopKeywords = [
    /\b\d+\.\s*(?:Generator|Address|Registration|Transporter|Facility|Destination|Permit|Date)/i,
    /\bHazardous\s*Waste\s*Generator(?:'s)?\s*Address\b/i,
    /\bGenerator\s*Address\b/i,
    /\bRegistration\s*(?:No|Number|#)?\b/i,
    /\bReg\.\s*No\b/i,
    /\bDENR\s*ID\b/i,
    /\bHW\s*ID\b/i,
    /\bAddress\b/i,
    /\bTransporter\b/i,
    /\bDestination\b/i,
    /\bFacility\b/i,
    /\bTel\b/i,
    /\bPhone\b/i,
    /\bContact\b/i,
    /\bEmail\b/i,
    /\bRegion\b/i,
    /\bPermit\b/i,
    /\bDate\b/i,
    /\bQuantity\b/i,
  ];

  for (const kw of stopKeywords) {
    const match = cleaned.match(kw);
    if (match && match.index !== undefined && match.index > 0) {
      cleaned = cleaned.substring(0, match.index).trim();
    }
  }

  // Strip leading non-alphanumeric/numbering prefixes like "1. ", "1: ", "- "
  cleaned = cleaned.replace(/^[\d\s.:;-]+/, "");
  // Strip trailing punctuation, colons, dashes
  cleaned = cleaned.replace(/[\s.:;-]+$/, "");
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned.toUpperCase();
}

/**
 * Extracts text natively using pdfjs-dist with Y/X coordinate sorting and visual line grouping
 */
async function extractNativePdfText(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) });
    const pdfDoc = await loadingTask.promise;
    let fullText = "";

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const items = (textContent.items as any[])
        .filter((item: any) => item && typeof item.str === "string" && item.str.trim().length > 0)
        .map((item: any) => ({
          str: item.str,
          x: item.transform ? item.transform[4] : 0,
          y: item.transform ? item.transform[5] : 0,
          width: item.width || 0,
          height: item.height || 0,
        }));

      // Group items into lines based on vertical Y coordinate proximity (tolerance = 4 points)
      const lines: { y: number; items: typeof items }[] = [];
      for (const item of items) {
        const existingLine = lines.find((l) => Math.abs(l.y - item.y) < 4);
        if (existingLine) {
          existingLine.items.push(item);
        } else {
          lines.push({ y: item.y, items: [item] });
        }
      }

      // Sort lines top to bottom (Y descending in PDF coordinate system)
      lines.sort((a, b) => b.y - a.y);

      // Sort items in each line left to right (X ascending)
      for (const line of lines) {
        line.items.sort((a, b) => a.x - b.x);
        const lineText = line.items.map((it) => it.str).join(" ");
        fullText += lineText + "\n";
      }
    }

    return fullText;
  } catch (err) {
    console.error("[ManifestParser] Native PDF text extraction error:", err);
    return "";
  }
}

/**
 * Renders PDF first page to an offscreen canvas and runs Tesseract.js OCR
 */
async function extractOcrPdfText(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    console.log("[ManifestParser] Initiating Tesseract.js OCR Fallback...");
    const { createWorker } = await import("tesseract.js");
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) });
    const pdfDoc = await loadingTask.promise;
    const page = await pdfDoc.getPage(1);

    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return "";

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvas, canvasContext: context, viewport } as any).promise;

    const worker = await createWorker("eng");
    const ret = await worker.recognize(canvas);
    await worker.terminate();

    return ret.data.text || "";
  } catch (err) {
    console.error("[ManifestParser] OCR fallback failed:", err);
    return "";
  }
}

/**
 * Label & Regex Structured Field Parser
 */
export function parseManifestText(text: string): {
  companyName: string | null;
  deliveryDate: string | null;
  formattedDeliveryDate: string | null;
  tpNumber: string | null;
  manifestNo: string | null;
  quantity: number | null;
  caNoFromPdf: string | null;
} {
  let companyName: string | null = null;
  let deliveryDate: string | null = null;
  let formattedDeliveryDate: string | null = null;
  let tpNumber: string | null = null;
  let manifestNo: string | null = null;
  let quantity: number | null = null;
  let caNoFromPdf: string | null = null;

  // 1. Transport Permit Number
  const tpMatch = text.match(TP_PATTERN);
  if (tpMatch) {
    tpNumber = tpMatch[0].toUpperCase().trim();
  }

  // 2. Manifest Number
  const manifestMatch = text.match(MANIFEST_PATTERN);
  if (manifestMatch) {
    manifestNo = manifestMatch[0].toUpperCase().trim();
  }

  // 3. CA No from PDF
  const caMatch = text.match(CA_PATTERN);
  if (caMatch) {
    caNoFromPdf = caMatch[0].trim();
  }

  // 4. Company Name / Generator's Name
  const generatorLabels = [
    /Hazardous\s*Waste\s*Generator(?:'s)?\s*Name\s*[:;-]?\s*([^\n\r]+)/i,
    /Generator(?:'s)?\s*Name\s*[:;-]?\s*([^\n\r]+)/i,
    /Company\s*Name\s*[:;-]?\s*([^\n\r]+)/i,
    /Facility\s*Name\s*[:;-]?\s*([^\n\r]+)/i,
  ];

  for (const labelRegex of generatorLabels) {
    const match = text.match(labelRegex);
    if (match && match[1]) {
      const cleaned = cleanCompanyName(match[1]);
      if (cleaned.length >= 2) {
        companyName = cleaned;
        break;
      }
    }
  }

  // Fallback for company name if label not matched directly
  if (!companyName) {
    const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    for (let i = 0; i < lines.length; i++) {
      if (/Generator/i.test(lines[i]) && i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (!/Date|Permit|Manifest|Quantity/i.test(nextLine) && nextLine.length > 3) {
          const cleaned = cleanCompanyName(nextLine);
          if (cleaned.length >= 2) {
            companyName = cleaned;
            break;
          }
        }
      }
    }
  }

  // 5. Transport Date
  const dateLabels = [
    /Transport\s*Date\s*[:;-]?\s*([^\n\r]+)/i,
    /Date\s*of\s*Transport\s*[:;-]?\s*([^\n\r]+)/i,
    /Delivery\s*Date\s*[:;-]?\s*([^\n\r]+)/i,
    /Date\s*[:;-]?\s*([^\n\r]+)/i,
  ];

  for (const labelRegex of dateLabels) {
    const match = text.match(labelRegex);
    if (match && match[1]) {
      const candidateStr = match[1].trim();
      const dateMatch = candidateStr.match(DATE_PATTERN_1) || candidateStr.match(DATE_PATTERN_2) || candidateStr.match(DATE_PATTERN_3);
      if (dateMatch) {
        const parsed = normalizeDate(dateMatch[0]);
        if (parsed) {
          deliveryDate = parsed.iso;
          formattedDeliveryDate = parsed.display;
          break;
        }
      }
    }
  }

  // Fallback date match anywhere in document
  if (!deliveryDate) {
    const dateMatch = text.match(DATE_PATTERN_1) || text.match(DATE_PATTERN_2) || text.match(DATE_PATTERN_3);
    if (dateMatch) {
      const parsed = normalizeDate(dateMatch[0]);
      if (parsed) {
        deliveryDate = parsed.iso;
        formattedDeliveryDate = parsed.display;
      }
    }
  }

  // 6. Quantity (Metric Tonnes)
  const extractQuantityValue = (): number | null => {
    // Tier 1: Explicit Label-Value regex matching (supports Qty, Quantity, Net Weight, Gross Weight, Mass, Volume, Amount, Total Qty)
    const tier1Regexes = [
      /(?:Quantity|Qty|Net\s*Weight|Gross\s*Weight|Weight|Mass|Volume|Amount|Total\s*Qty|Total\s*Quantity)\s*(?:\([^)]*\)|in\s+[a-z]+)?\s*[:;-]?\s*([\d,]+\.?\d*)\s*(metric\s*tonnes?|MT|Tons?|kgs?|kg|kilograms?)?/i,
      /Quantity\s*of\s*Waste\s*[:;-]?\s*([\d,]+\.?\d*)\s*(metric\s*tonnes?|MT|Tons?|kgs?|kg|kilograms?)?/i,
      /Waste\s*Quantity\s*[:;-]?\s*([\d,]+\.?\d*)\s*(metric\s*tonnes?|MT|Tons?|kgs?|kg|kilograms?)?/i,
    ];

    for (const regex of tier1Regexes) {
      const match = text.match(regex);
      if (match && match[1]) {
        const numStr = match[1].replace(/,/g, "");
        let val = parseFloat(numStr);
        if (!isNaN(val) && val > 0) {
          const unit = (match[2] || "").toLowerCase();
          const fullMatch = match[0].toLowerCase();
          
          if (/kg|kgs|kilograms?/.test(unit) || (/\b(kg|kgs|kilograms?)\b/i.test(fullMatch) && !/mt|metric\s*tonne/i.test(fullMatch))) {
            val = val / 1000;
          } else if (!unit && !/mt|metric\s*tonne|tons?/i.test(fullMatch) && val > 100) {
            val = val / 1000;
          }

          if (val < 10000) {
            console.log("[QuantityExtraction] Tier 1 match:", val, "MT from raw:", match[0]);
            return val;
          }
        }
      }
    }

    // Tier 2: Number explicitly accompanied by unit keyword anywhere in document
    const tier2Regex = /([\d,]+\.?\d*)\s*(metric\s*tonnes?|MT|Tons?|kgs?|kilograms?)\b/i;
    const tier2Match = text.match(tier2Regex);
    if (tier2Match && tier2Match[1]) {
      const numStr = tier2Match[1].replace(/,/g, "");
      let val = parseFloat(numStr);
      if (!isNaN(val) && val > 0) {
        const unit = tier2Match[2].toLowerCase();
        if (/kg|kgs|kilograms?/.test(unit)) {
          val = val / 1000;
        }
        if (val < 10000) {
          console.log("[QuantityExtraction] Tier 2 match:", val, "MT from raw:", tier2Match[0]);
          return val;
        }
      }
    }

    // Tier 3: Line-by-line proximity search (for table formats where label and value are on adjacent lines)
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    for (let i = 0; i < lines.length; i++) {
      if (/(?:Quantity|Qty|Weight|Net\s*Weight|Gross\s*Weight|Volume|Amount)/i.test(lines[i])) {
        // Check current line and next 5 lines for a number
        for (let j = i; j <= Math.min(i + 5, lines.length - 1); j++) {
          const numMatch = lines[j].match(/\b([\d,]+\.?\d*)\s*(metric\s*tonnes?|MT|Tons?|kgs?|kg|kilograms?)?\b/i);
          if (numMatch && numMatch[1]) {
            const numStr = numMatch[1].replace(/,/g, "");
            let val = parseFloat(numStr);
            // Ensure not matching a date, year, or ID number
            if (!isNaN(val) && val > 0 && val !== 2024 && val !== 2025 && val !== 2026 && val !== 2027) {
              const unit = (numMatch[2] || "").toLowerCase();
              const surroundingText = lines[j].toLowerCase();
              if (/kg|kgs|kilograms?/.test(unit) || /\b(kg|kgs|kilograms?)\b/.test(surroundingText)) {
                val = val / 1000;
              } else if (!unit && val > 100) {
                val = val / 1000;
              }
              if (val < 10000) {
                console.log("[QuantityExtraction] Tier 3 match:", val, "MT from line:", lines[j]);
                return val;
              }
            }
          }
        }
      }
    }

    // Tier 4: Standalone decimal candidate search (e.g. 0.645, 1.25, 0.1)
    const decimalMatches = text.matchAll(/\b(\d+\.\d{1,4})\b/g);
    for (const match of decimalMatches) {
      const candidateStr = match[1];
      const val = parseFloat(candidateStr);
      if (!isNaN(val) && val >= 0.001 && val <= 500) {
        const index = match.index || 0;
        const snippet = text.substring(Math.max(0, index - 25), Math.min(text.length, index + 35));
        if (!/OL-P|OL-GR|M-R4A|\b\d{2}-\d{4}-\d{2}\b/i.test(snippet)) {
          console.log("[QuantityExtraction] Tier 4 decimal match:", val, "MT from snippet:", snippet);
          return val;
        }
      }
    }

    console.warn("[QuantityExtraction] No valid quantity found in document text.");
    return null;
  };

  quantity = extractQuantityValue();

  return {
    companyName,
    deliveryDate,
    formattedDeliveryDate,
    tpNumber,
    manifestNo,
    quantity,
    caNoFromPdf,
  };
}

/**
 * Main Zero-Cost Extraction Pipeline Entrypoint
 */
export async function processManifestDocument(
  arrayBuffer: ArrayBuffer,
  authoritativeCaNo: string
): Promise<ManifestExtractionResult> {
  const warnings: string[] = [];

  // Step 1: Attempt Native PDF Extraction
  let rawText = await extractNativePdfText(arrayBuffer);
  let extractionMethod: "native-pdf-text" | "tesseract-ocr" | "manual-review" = "native-pdf-text";

  // Step 2: Fallback to OCR if native text is too short / empty
  if (rawText.trim().length < 20) {
    console.log("[ManifestParser] Low text density detected. Falling back to OCR.");
    rawText = await extractOcrPdfText(arrayBuffer);
    extractionMethod = "tesseract-ocr";
  }

  // Step 3: Parse Structured Fields
  const parsed = parseManifestText(rawText);

  // Step 4: Field Validation
  const validation = {
    companyName: Boolean(parsed.companyName && parsed.companyName.length >= 2),
    deliveryDate: Boolean(parsed.deliveryDate),
    tpNumber: Boolean(parsed.tpNumber && TP_PATTERN.test(parsed.tpNumber)),
    manifestNo: Boolean(parsed.manifestNo && MANIFEST_PATTERN.test(parsed.manifestNo)),
    quantity: Boolean(parsed.quantity !== null && parsed.quantity > 0),
    caNo: Boolean(authoritativeCaNo && CA_PATTERN.test(authoritativeCaNo)),
  };

  // Warnings generation
  if (!validation.companyName) warnings.push("Company Name could not be confidently identified.");
  if (!validation.deliveryDate) warnings.push("Transport Date missing or invalid.");
  if (!validation.tpNumber) warnings.push("Transport Permit Number format invalid or missing.");
  if (!validation.manifestNo) warnings.push("Manifest Number format invalid or missing.");
  if (!validation.quantity) warnings.push("Quantity in metric tonnes missing or non-numeric.");

  if (parsed.caNoFromPdf && parsed.caNoFromPdf !== authoritativeCaNo) {
    warnings.push(`CA No in PDF (${parsed.caNoFromPdf}) differs from input CA No (${authoritativeCaNo}).`);
  }

  // Step 5: Deterministic Confidence Model
  const validCount = Object.values(validation).filter(Boolean).length;
  let confidence: "high" | "medium" | "low" = "high";

  if (validCount >= 5) {
    confidence = "high";
  } else if (validCount >= 3) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  return {
    companyName: parsed.companyName,
    deliveryDate: parsed.deliveryDate,
    formattedDeliveryDate: parsed.formattedDeliveryDate,
    tpNumber: parsed.tpNumber,
    manifestNo: parsed.manifestNo,
    quantity: parsed.quantity,
    caNoFromPdf: parsed.caNoFromPdf,
    extractionMethod,
    confidence,
    validation,
    warnings,
    rawText,
  };
}
