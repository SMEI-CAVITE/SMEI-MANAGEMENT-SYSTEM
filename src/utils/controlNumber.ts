/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ControlNumberConfig {
  key: string;
  label: string;
  placeholder: string;
  example: string;
  template: string;
  pattern: RegExp;
}

export const CONTROL_NUMBER_FORMATS: Record<string, ControlNumberConfig> = {
  caNo: {
    key: "caNo",
    label: "CA No.",
    placeholder: "06-1234-26",
    example: "07-1331-26",
    template: "MM-####-YY",
    pattern: /^(0[1-9]|1[0-2])-\d{4}-\d{2}$/
  },
  manifestNo: {
    key: "manifestNo",
    label: "Manifest No.",
    placeholder: "M-R3-2026-07-632758",
    example: "M-R3-2026-07-632758",
    template: "M-[REGION]-[YEAR]-[MONTH]-[NUMBER]",
    pattern: /^[mM]-[a-zA-Z0-9]+-\d{4}-\d{2}-\d+$/
  },
  poNumber: {
    key: "poNumber",
    label: "PO No.",
    placeholder: "SMEI-2026-0001",
    example: "SMEI-2026-0001",
    template: "SMEI-YYYY-####",
    pattern: /^[A-Z0-9]+-\d{4}-\d{3,6}$/
  },
  rfsNumber: {
    key: "rfsNumber",
    label: "RFS No.",
    placeholder: "2026-07-001",
    example: "2026-07-001",
    template: "YYYY-MM-###",
    pattern: /^\d{4}-(0[1-9]|1[0-2])-\d{3,6}$/
  },
  pisNumber: {
    key: "pisNumber",
    label: "PIS No.",
    placeholder: "PURC-PIS-26-001",
    example: "PURC-PIS-26-001",
    template: "PURC-PIS-YY-###",
    pattern: /^PURC-PIS-\d{2}-\d{3}$/
  },
  rcNumber: {
    key: "rcNumber",
    label: "Recycle Cert No.",
    placeholder: "e.g. R-123",
    example: "R-123",
    template: "R-###",
    pattern: /^R-\d{1,6}$/
  },
  crdNumber: {
    key: "crdNumber",
    label: "CRD No.",
    placeholder: "CRD-06-1309-26",
    example: "CRD-06-1309-26",
    template: "CRD-XX-XXXX-XX",
    pattern: /^CRD-[a-zA-Z0-9]+-\d{4}-\d{2}$/
  },
  mrrNumber: {
    key: "mrrNumber",
    label: "MRR No.",
    placeholder: "MRR-2026-001",
    example: "MRR-2026-001",
    template: "MRR-YYYY-###",
    pattern: /^MRR-(\d{4}-)?\d{1,6}$/
  }
};

/**
 * Format raw control number according to format key or mask template.
 * Supports auto-insertion of dashes during typing or raw string pasting.
 */
export function formatControlNumber(value: string | undefined | null, formatTypeOrTemplate: string): string {
  if (!value) return "";
  const raw = String(value).trim().toUpperCase();
  if (!raw) return "";

  const configKey = formatTypeOrTemplate.toLowerCase().replace(/[^a-z0-9]/g, "");

  // 1. CA No. formatting: MM-####-YY
  if (configKey === "cano" || configKey === "ca_no" || configKey === "canumber" || configKey === "mm####yy") {
    if (raw.startsWith("CA-")) {
      return raw;
    }

    const digits = raw.replace(/\D/g, "");
    if (!digits) return raw;

    let mm = digits.slice(0, 2);
    if (mm.length === 2) {
      let monthNum = parseInt(mm, 10);
      if (monthNum > 12) mm = "12";
      if (monthNum === 0) mm = "01";
    }

    const seq = digits.length > 2 ? digits.slice(2, 6) : "";
    const yy = digits.length > 6 ? digits.slice(6, 8) : "";

    let formatted = mm;
    if (digits.length > 2 || (digits.length === 2 && raw.endsWith("-"))) {
      formatted += "-";
    }
    if (seq) {
      formatted += seq;
      if (digits.length > 6 || (seq.length === 4 && raw.endsWith("-"))) {
        formatted += "-";
      }
    }
    if (yy) {
      formatted += yy;
    }

    return formatted.replace(/--+/g, "-");
  }

  // 2. Manifest No. formatting: M-REGION-YYYY-MM-NUMBER (e.g., M-R3-2026-07-632758 or M-NCR-2026-07-123456)
  if (configKey === "manifestno" || configKey === "manifestnumber") {
    if (/^M-[A-Z0-9]+-\d{4}-\d{2}-\d+$/i.test(raw)) {
      return raw.toUpperCase();
    }

    let body = raw;
    if (/^M-?/i.test(body)) {
      body = body.replace(/^M-?/i, "");
    }

    if (!body) return "M-";

    const parts = body.split("-");
    const region = parts[0];
    const rest = parts.slice(1).join("");

    if (rest) {
      const digits = rest.replace(/\D/g, "");
      const yyyy = digits.slice(0, 4);
      const mm = digits.length > 4 ? digits.slice(4, 6) : "";
      const num = digits.length > 6 ? digits.slice(6) : "";

      let res = `M-${region}`;
      if (yyyy) {
        res += `-${yyyy}`;
        if (mm || (yyyy.length === 4 && (body.endsWith("-") || raw.endsWith("-")))) {
          res += `-${mm}`;
          if (num || (mm.length === 2 && (body.endsWith("-") || raw.endsWith("-")))) {
            res += `-${num}`;
          }
        }
      }
      return res;
    }

    // Single unformatted block e.g. R3202607632758 or NCR202607123456
    const match = body.match(/^([A-Z]{1,3}\d{0,2}|\d{1,2})?(\d{4})(\d{2})(\d+)$/i);
    if (match) {
      const reg = match[1] || "R3";
      const yyyy = match[2];
      const mm = match[3];
      const num = match[4];
      return `M-${reg}-${yyyy}-${mm}-${num}`;
    }

    return `M-${body}`;
  }

  // 3. CRD No. formatting: CRD-XX-XXXX-XX
  if (configKey === "crdnumber" || configKey === "crdno") {
    if (raw === "N/A") return "N/A";

    if (/^CRD-[A-Z0-9]{2}-[A-Z0-9]{4}-[A-Z0-9]{2}$/i.test(raw)) {
      return raw.toUpperCase();
    }

    let clean = raw.replace(/^CRD-?/i, "");
    const digits = clean.replace(/[^A-Z0-9]/g, "");
    if (!digits) return raw.startsWith("CRD") ? raw : "";

    const xx1 = digits.slice(0, 2);
    const xxxx = digits.length > 2 ? digits.slice(2, 6) : "";
    const xx2 = digits.length > 6 ? digits.slice(6, 8) : "";

    let formatted = "CRD-" + xx1;
    if (digits.length > 2 || (digits.length === 2 && (clean.endsWith("-") || raw.endsWith("-")))) {
      formatted += "-";
    }
    if (xxxx) {
      formatted += xxxx;
      if (digits.length > 6 || (xxxx.length === 4 && (clean.endsWith("-") || raw.endsWith("-")))) {
        formatted += "-";
      }
    }
    if (xx2) {
      formatted += xx2;
    }

    return formatted;
  }

  // 4. PO No. formatting: SMEI-YYYY-#### or PO-YYYY-####
  if (configKey === "ponumber" || configKey === "pono" || configKey === "poyyyy") {
    if (/^[A-Z0-9]+-\d{4}-\d{3,6}$/.test(raw)) {
      return raw;
    }

    let prefix = "SMEI";
    let rest = raw;
    const matchPrefix = raw.match(/^([A-Z]+)-?(.*)$/);
    if (matchPrefix && matchPrefix[1] && isNaN(Number(matchPrefix[1]))) {
      prefix = matchPrefix[1];
      rest = matchPrefix[2];
    }

    const digits = rest.replace(/\D/g, "");
    if (!digits) return raw;

    const yyyy = digits.slice(0, 4);
    const num = digits.length > 4 ? digits.slice(4, 8) : "";

    let res = `${prefix}-${yyyy}`;
    if (digits.length > 4 || (digits.length === 4 && raw.endsWith("-"))) {
      res += "-";
    }
    if (num) {
      res += num;
    }
    return res;
  }

  // 5. PIS No. formatting: PURC-PIS-YY-###
  if (configKey === "pisnumber" || configKey === "pisno" || configKey === "purcpisyy") {
    if (/^PURC-PIS-\d{2}-\d{3}$/.test(raw)) {
      return raw;
    }

    const clean = raw.replace(/^PURC-PIS-?/i, "");
    const digits = clean.replace(/\D/g, "");
    if (!digits) return raw.startsWith("PURC") ? raw : "";

    const yy = digits.slice(0, 2);
    const num = digits.length > 2 ? digits.slice(2, 5) : "";

    let res = "PURC-PIS-" + yy;
    if (digits.length > 2 || (digits.length === 2 && (clean.endsWith("-") || raw.endsWith("-")))) {
      res += "-";
    }
    if (num) {
      res += num;
    }
    return res;
  }

  // 6. RFS No. formatting: YYYY-MM-###
  if (configKey === "rfsnumber" || configKey === "rfsno" || configKey === "yyyymm") {
    if (/^\d{4}-(0[1-9]|1[0-2])-\d{3,6}$/.test(raw)) {
      return raw;
    }
    const digits = raw.replace(/\D/g, "");
    if (!digits) return raw;

    if (digits.length >= 7) {
      const yyyy = digits.slice(0, 4);
      const mm = digits.slice(4, 6);
      const num = digits.slice(6, 9);

      let formatted = yyyy;
      if (digits.length > 4 || raw.endsWith("-")) formatted += "-" + mm;
      if (digits.length > 6 || (digits.length >= 6 && raw.endsWith("-"))) formatted += "-" + num;
      return formatted;
    }

    return raw;
  }

  // 7. RC No. formatting: R-series (e.g., R-932, R-15402)
  if (configKey === "rcnumber" || configKey === "rcno" || configKey === "rc" || configKey === "r") {
    if (raw === "N/A") return "N/A";
    if (/^R-\d{1,6}$/.test(raw)) return raw;

    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      return raw.toUpperCase().startsWith("R") ? "R-" : "";
    }

    return `R-${digits}`;
  }

  // 8. MRR No. formatting: MRR-YYYY-###
  if (configKey === "mrrnumber" || configKey === "mrrno" || configKey === "mrr") {
    if (/^MRR-(\d{4}-)?\d{1,6}$/.test(raw)) return raw;

    const clean = raw.replace(/^MRR-?/i, "");
    const digits = clean.replace(/\D/g, "");
    if (!digits) return raw.startsWith("MRR") ? raw : "";

    if (digits.length >= 7) {
      const yyyy = digits.slice(0, 4);
      const num = digits.slice(4, 8);
      return `MRR-${yyyy}-${num}`;
    }

    return `MRR-${digits}`;
  }

  // Fallback default
  return raw;
}

/**
 * Validates a control number against a format key or template pattern.
 */
export function validateControlNumber(
  value: string | undefined | null,
  formatTypeOrTemplate: string
): { isValid: boolean; error?: string } {
  if (!value || !value.trim()) {
    return { isValid: false, error: "Control number is required." };
  }

  const cleanVal = value.trim().toUpperCase();
  const configKey = formatTypeOrTemplate.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (configKey === "cano" || configKey === "ca_no" || configKey === "canumber" || configKey === "mm####yy") {
    if (cleanVal.startsWith("CA-")) {
      return { isValid: true };
    }

    const caRegex = /^(0[1-9]|1[0-2])-\d{4}-\d{2}$/;
    if (!caRegex.test(cleanVal)) {
      const digitsOnly = cleanVal.replace(/\D/g, "");
      if (digitsOnly.length >= 2) {
        const monthNum = parseInt(digitsOnly.slice(0, 2), 10);
        if (monthNum < 1 || monthNum > 12) {
          return {
            isValid: false,
            error: "Invalid month in CA No. Month must be between 01 and 12 (format: MM-####-YY)."
          };
        }
      }
      return {
        isValid: false,
        error: "CA No. must match the required format: MM-####-YY (e.g., 07-1331-26)."
      };
    }
    return { isValid: true };
  }

  if (configKey === "manifestno" || configKey === "manifestnumber") {
    const manifestRegex = /^[mM]-[a-zA-Z0-9]+-\d{4}-\d{2}-\d+$/;
    if (!manifestRegex.test(cleanVal)) {
      return {
        isValid: false,
        error: "Manifest No. must match format M-[REGION]-YYYY-MM-[NUMBER] (e.g., M-R3-2026-07-632758)."
      };
    }
    return { isValid: true };
  }

  if (configKey === "crdnumber" || configKey === "crdno") {
    const crdRegex = /^CRD-[a-zA-Z0-9]+-\d{4}-\d{2}$/;
    if (!crdRegex.test(cleanVal)) {
      return {
        isValid: false,
        error: "CRD Number must match format CRD-XX-XXXX-XX (e.g., CRD-06-1309-26)."
      };
    }
    return { isValid: true };
  }

  if (configKey === "rcnumber" || configKey === "rcno" || configKey === "rc" || configKey === "r") {
    if (cleanVal === "N/A") return { isValid: true };
    const rcRegex = /^R-\d{1,6}$/;
    if (!rcRegex.test(cleanVal)) {
      return {
        isValid: false,
        error: "Invalid Recycle Cert No. Expected format: R-123 (e.g., R-932, R-15402)."
      };
    }
    return { isValid: true };
  }

  if (configKey === "rfsnumber" || configKey === "rfsno") {
    const rfsRegex = /^(\d{4}-(0[1-9]|1[0-2])-\d{3,6}|\d{1,6})$/;
    if (!rfsRegex.test(cleanVal)) {
      return {
        isValid: false,
        error: "RFS No. must match format YYYY-MM-### (e.g., 2026-07-001)."
      };
    }
    return { isValid: true };
  }

  if (configKey === "pisnumber" || configKey === "pisno") {
    const pisRegex = /^PURC-PIS-\d{2}-\d{3}$/;
    if (!pisRegex.test(cleanVal)) {
      return {
        isValid: false,
        error: "PIS No. must match format PURC-PIS-YY-### (e.g., PURC-PIS-26-001)."
      };
    }
    return { isValid: true };
  }

  if (configKey === "ponumber" || configKey === "pono") {
    const poRegex = /^[A-Z0-9]+-\d{4}-\d{3,6}$/;
    if (!poRegex.test(cleanVal)) {
      return {
        isValid: false,
        error: "PO No. must match format PREFIX-YYYY-#### (e.g., SMEI-2026-0001)."
      };
    }
    return { isValid: true };
  }

  return { isValid: true };
}

/**
 * Normalizes control numbers for clean relational matching
 */
export function normalizeControlNo(val: string | null | undefined): string {
  if (!val) return "";
  return String(val).trim().toUpperCase();
}

/**
 * Resolves canonical tracking code across various module record structures.
 * Priority: controlNo -> caNumber -> manifestNo -> trackingCode -> documentNumber -> ""
 */
export function getTrackingCode(record: any): string {
  if (!record) return "";
  if (typeof record === "string") return normalizeControlNo(record);
  if (typeof record !== "object") return "";
  const candidate =
    record.controlNo ||
    record.caNumber ||
    record.manifestNo ||
    record.trackingCode ||
    record.documentNumber ||
    "";
  return normalizeControlNo(candidate);
}

/**
 * Generates the next sequential Control Number (CA No.) based on an offset.
 * Example: getNextCaNo("03-1233-26", 1) => "03-1234-26"
 */
export function getNextCaNo(baseCaNo: string, offset: number): string {
  if (!baseCaNo || offset === 0) return baseCaNo;
  const caMatch = baseCaNo.match(/^(0[1-9]|1[0-2])-(\d{4})-(\d{2})$/);
  if (caMatch) {
    const mm = caMatch[1];
    const seq = parseInt(caMatch[2], 10) + offset;
    const yy = caMatch[3];
    const seqPadded = String(seq).padStart(4, "0");
    return `${mm}-${seqPadded}-${yy}`;
  }
  const genericMatch = baseCaNo.match(/^(.*?)(\d+)$/);
  if (genericMatch) {
    const prefix = genericMatch[1];
    const digits = genericMatch[2];
    const newNum = parseInt(digits, 10) + offset;
    const padded = String(newNum).padStart(digits.length, "0");
    return `${prefix}${padded}`;
  }
  return baseCaNo;
}

/**
 * Checks whether a Control Number (CA No. or unique identifier) already exists in the system.
 * Checks compliance documents (tsd_uploaded_compliance_docs), manifest records (tsd_manifests),
 * and workflows (tsd_workflows).
 *
 * @param candidateCaNo The Control Number string to check.
 * @param excludeDocId Optional docId/id to exclude when editing an existing record.
 * @returns Object indicating if duplicate exists and details.
 */
export function isControlNumberDuplicate(
  candidateCaNo: string | null | undefined,
  excludeDocId?: string
): {
  isDuplicate: boolean;
  existingType?: "compliance_doc" | "manifest" | "workflow";
  matchedNumber?: string;
} {
  const normCandidate = normalizeControlNo(candidateCaNo);
  if (!normCandidate) return { isDuplicate: false };

  // 1. Check Compliance Documents in LocalStorage
  try {
    const rawDocs = localStorage.getItem("tsd_uploaded_compliance_docs");
    if (rawDocs) {
      const docs = JSON.parse(rawDocs);
      if (Array.isArray(docs)) {
        for (const d of docs) {
          if (excludeDocId && (d.id === excludeDocId || d.docId === excludeDocId)) {
            continue;
          }
          if (normalizeControlNo(d.caNumber) === normCandidate || normalizeControlNo(d.controlNo) === normCandidate) {
            return {
              isDuplicate: true,
              existingType: "compliance_doc",
              matchedNumber: d.caNumber || d.controlNo || candidateCaNo || normCandidate,
            };
          }
        }
      }
    }
  } catch (err) {
    console.error("[controlNumber] Error checking compliance docs storage:", err);
  }

  // 2. Check Manifest Records in LocalStorage
  try {
    const rawManifests = localStorage.getItem("tsd_manifests");
    if (rawManifests) {
      const manifests = JSON.parse(rawManifests);
      if (Array.isArray(manifests)) {
        for (const m of manifests) {
          if (
            excludeDocId &&
            (m.docId === excludeDocId || m.id === excludeDocId || m.id === `manifest-${excludeDocId}`)
          ) {
            continue;
          }
          if (normalizeControlNo(m.controlNo) === normCandidate) {
            return {
              isDuplicate: true,
              existingType: "manifest",
              matchedNumber: m.controlNo || candidateCaNo || normCandidate,
            };
          }
        }
      }
    }
  } catch (err) {
    console.error("[controlNumber] Error checking manifest records storage:", err);
  }

  // 3. Check Workflows in LocalStorage
  try {
    const rawWorkflows = localStorage.getItem("tsd_workflows");
    if (rawWorkflows) {
      const workflows = JSON.parse(rawWorkflows);
      if (Array.isArray(workflows)) {
        for (const w of workflows) {
          if (
            excludeDocId &&
            (w.documentIds?.["control-no"] === excludeDocId ||
              w.documentIds?.controlNumber === excludeDocId ||
              w.id === excludeDocId)
          ) {
            continue;
          }
          if (normalizeControlNo(w.controlNo) === normCandidate) {
            return {
              isDuplicate: true,
              existingType: "workflow",
              matchedNumber: w.controlNo || candidateCaNo || normCandidate,
            };
          }
        }
      }
    }
  } catch (err) {
    console.error("[controlNumber] Error checking workflows storage:", err);
  }

  return { isDuplicate: false };
}

