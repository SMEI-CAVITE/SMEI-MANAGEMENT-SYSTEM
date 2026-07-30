/**
 * Manifest Storage & Weekly Period Management Engine
 * Operational Week: Monday through Saturday
 */

import { normalizeControlNo } from "./controlNumber";

export interface ManifestRecord {
  id: string;
  controlNo: string; // CA No (authoritative)
  companyName: string;
  tpNumber: string;
  manifestNo: string;
  deliveryDate: string; // YYYY-MM-DD
  quantity: number;
  extractionMethod?: "native-pdf-text" | "tesseract-ocr" | "manual-review";
  confidence?: "high" | "medium" | "low";
  warnings?: string[];
  docId?: string; // Reference to IndexedDB PDF binary
  createdAt: string;
  updatedAt?: string;
  workflowId?: string;
}

export interface WeeklyManifestGroup {
  weekId: string; // e.g., WEEK_2026_07_20
  weekStart: string; // YYYY-MM-DD (Monday)
  weekEnd: string; // YYYY-MM-DD (Saturday)
  formattedWeekRange: string; // e.g., "JULY 20, 2026 - JULY 25, 2026"
  records: ManifestRecord[];
}

import { safeSetLocalStorage } from "./heavyStorage";

const STORAGE_KEY = "tsd_manifests";

/**
 * Calculates Monday (Start) and Saturday (End) for any given ISO date string (YYYY-MM-DD)
 */
export function getWeeklyPeriod(dateStr: string): {
  weekId: string;
  weekStart: string;
  weekEnd: string;
  formattedWeekRange: string;
} {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    const now = new Date();
    return getWeeklyPeriod(now.toISOString().split("T")[0]);
  }

  // Day 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const dayOfWeek = date.getDay();
  
  // Calculate Monday offset
  // If Sunday (0), Monday was 6 days ago
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const monday = new Date(date);
  monday.setDate(date.getDate() + mondayOffset);

  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);

  const formatIso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const monthNames = [
    "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
    "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
  ];

  const mondayIso = formatIso(monday);
  const saturdayIso = formatIso(saturday);

  const formattedWeekRange = `${monthNames[monday.getMonth()]} ${monday.getDate()}, ${monday.getFullYear()} - ${monthNames[saturday.getMonth()]} ${saturday.getDate()}, ${saturday.getFullYear()}`;

  const weekId = `WEEK_${mondayIso.replace(/-/g, "_")}`;

  return {
    weekId,
    weekStart: mondayIso,
    weekEnd: saturdayIso,
    formattedWeekRange,
  };
}

/**
 * Loads all manifest records from localStorage, strictly validating against
 * Control No. module uploaded compliance documents (Source of Truth).
 * Automatically purges orphan/dummy records that do not correspond to an actual uploaded document.
 */
export function getAllManifestRecords(): ManifestRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const records = raw ? (JSON.parse(raw) as ManifestRecord[]) : [];

    // Retrieve active uploaded documents from Control No. Module (Source of Truth)
    const rawDocs = localStorage.getItem("tsd_uploaded_compliance_docs");
    const activeDocs = rawDocs ? (JSON.parse(rawDocs) as { id: string; caNumber: string }[]) : [];

    console.log(`[FORENSIC STAGE 8] getAllManifestRecords: raw storage count=${records.length}, active compliance docs count=${activeDocs.length}`);

    // If Control No. Module has no uploaded files, no manifest records should exist
    if (!activeDocs || activeDocs.length === 0) {
      if (records.length > 0) {
        console.log(`[FORENSIC STAGE 8] Active docs empty. Removing all ${records.length} stored manifest records.`);
        localStorage.removeItem(STORAGE_KEY);
      }
      return [];
    }

    const validDocIds = new Set(activeDocs.map((d) => d.id));
    const validCaNumbers = new Set(activeDocs.map((d) => d.caNumber).filter(Boolean));

    // Filter manifest records to only those linked to a valid uploaded file in Control No. Module
    const validRecords = records.filter((rec) => {
      // Must be linked to a valid document ID or valid CA Number
      const hasValidDocId = rec.docId ? validDocIds.has(rec.docId) : false;
      const hasValidCaNo = rec.controlNo ? validCaNumbers.has(rec.controlNo) : false;
      
      const isValid = hasValidDocId || hasValidCaNo;
      if (!isValid) {
        console.log(`[FORENSIC STAGE 8] PURGE EVENT: record id=${rec.id}, docId=${rec.docId}, controlNo=${rec.controlNo} has no matching active docId or CA No.`);
      }
      return isValid;
    });

    // If orphan or dummy records were filtered out, persist the cleaned list
    if (validRecords.length !== records.length) {
      console.log(`[FORENSIC STAGE 8] Purged ${records.length - validRecords.length} orphan manifest records.`);
      safeSetLocalStorage(STORAGE_KEY, JSON.stringify(validRecords));
    }

    console.log(`[FORENSIC STAGE 7 & 8] getAllManifestRecords: returned ${validRecords.length} valid records (from ${activeDocs.length} active docs).`);
    return validRecords;
  } catch (err) {
    console.error("[ManifestStorage] Failed to retrieve manifest records:", err);
    return [];
  }
}

/**
 * Saves all manifest records to localStorage
 */
export function saveAllManifestRecords(records: ManifestRecord[]): void {
  try {
    safeSetLocalStorage(STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.error("[ManifestStorage] Failed to save tsd_manifests to storage:", err);
  }
}

/**
 * Adds or updates a manifest record with duplicate checking
 */
export function saveManifestRecord(record: ManifestRecord): {
  success: boolean;
  isDuplicate: boolean;
  message: string;
  updatedRecords: ManifestRecord[];
} {
  const records = getAllManifestRecords();

  const cleanedQuantity =
    record.quantity !== undefined &&
    record.quantity !== null &&
    record.quantity !== ("" as any) &&
    !isNaN(Number(record.quantity))
      ? Number(record.quantity)
      : 0;

  const sanitizedRecord: ManifestRecord = {
    ...record,
    quantity: cleanedQuantity,
  };

  // Priority duplicate check: document identity (docId or id)
  // Two different uploaded PDF documents must NEVER overwrite each other merely because manifestNo is similar or empty.
  const existingIndex = records.findIndex((r) => {
    if (sanitizedRecord.docId && r.docId === sanitizedRecord.docId) {
      return true;
    }
    if (r.id === sanitizedRecord.id) {
      return true;
    }
    return false;
  });

  if (existingIndex >= 0) {
    // Check if updating existing record for same document
    // Check if new controlNo conflicts with a different existing manifest record
    const normNewCtrl = normalizeControlNo(sanitizedRecord.controlNo);
    if (normNewCtrl) {
      const conflictingRecord = records.find(
        (r, idx) => idx !== existingIndex && normalizeControlNo(r.controlNo) === normNewCtrl
      );
      if (conflictingRecord) {
        console.warn(`[ManifestStorage] Rejecting duplicate manifest record update for Control No: ${sanitizedRecord.controlNo}`);
        return {
          success: false,
          isDuplicate: true,
          message: `A Control Number with identifier "${sanitizedRecord.controlNo}" already exists in the system.`,
          updatedRecords: records,
        };
      }
    }

    records[existingIndex] = {
      ...records[existingIndex],
      ...sanitizedRecord,
      updatedAt: new Date().toISOString(),
    };
    saveAllManifestRecords(records);
    console.log(`[FORENSIC STAGE 6] saveManifestRecord (UPDATE OVERWRITE): docId=${sanitizedRecord.docId}, id=${sanitizedRecord.id}, controlNo=${sanitizedRecord.controlNo}, totalRecordsNow=${records.length}`);
    return {
      success: true,
      isDuplicate: true,
      message: `Manifest ${sanitizedRecord.manifestNo || sanitizedRecord.controlNo} updated successfully.`,
      updatedRecords: records,
    };
  }

  // Defensive check for new inserts: ensure controlNo doesn't exist in any other manifest record
  const normCtrl = normalizeControlNo(sanitizedRecord.controlNo);
  if (normCtrl) {
    const duplicateRecord = records.find(r => normalizeControlNo(r.controlNo) === normCtrl);
    if (duplicateRecord) {
      console.warn(`[ManifestStorage] Rejecting duplicate manifest record insertion for Control No: ${sanitizedRecord.controlNo}`);
      return {
        success: false,
        isDuplicate: true,
        message: `A Control Number with identifier "${sanitizedRecord.controlNo}" already exists in the system.`,
        updatedRecords: records,
      };
    }
  }

  records.unshift(sanitizedRecord);
  saveAllManifestRecords(records);
  console.log(`[FORENSIC STAGE 6] saveManifestRecord (NEW INSERT): docId=${sanitizedRecord.docId}, id=${sanitizedRecord.id}, controlNo=${sanitizedRecord.controlNo}, totalRecordsNow=${records.length}`);
  return {
    success: true,
    isDuplicate: false,
    message: `Manifest ${sanitizedRecord.manifestNo || sanitizedRecord.controlNo} added successfully.`,
    updatedRecords: records,
  };
}

/**
 * Groups manifest records by Monday-Saturday Weekly Periods
 */
export function getWeeklyManifestGroups(): WeeklyManifestGroup[] {
  const records = getAllManifestRecords();
  const groupsMap = new Map<string, WeeklyManifestGroup>();

  for (const record of records) {
    const period = getWeeklyPeriod(record.deliveryDate || new Date().toISOString().split("T")[0]);

    if (!groupsMap.has(period.weekId)) {
      groupsMap.set(period.weekId, {
        weekId: period.weekId,
        weekStart: period.weekStart,
        weekEnd: period.weekEnd,
        formattedWeekRange: period.formattedWeekRange,
        records: [],
      });
    }

    groupsMap.get(period.weekId)!.records.push(record);
  }

  // Sort groups descending by weekStart
  const sorted = Array.from(groupsMap.values()).sort((a, b) =>
    b.weekStart.localeCompare(a.weekStart)
  );

  console.log(`[FORENSIC STAGE 9] getWeeklyManifestGroups: Total stored records=${records.length} distributed into ${sorted.length} weekly group(s):`);
  sorted.forEach((g) => {
    console.log(`  - Week ID: ${g.weekId} (${g.formattedWeekRange}): ${g.records.length} records`);
  });

  return sorted;
}

/**
 * Deletes a manifest record by ID
 */
export function deleteManifestRecord(id: string): ManifestRecord[] {
  const records = getAllManifestRecords();
  const filtered = records.filter((r) => r.id !== id);
  saveAllManifestRecords(filtered);
  return filtered;
}

/**
 * Deletes manifest record(s) associated with a document ID
 */
export function deleteManifestRecordByDocId(docId: string): ManifestRecord[] {
  const records = getAllManifestRecords();
  const filtered = records.filter((r) => r.docId !== docId && r.id !== `manifest-${docId}`);
  saveAllManifestRecords(filtered);
  return filtered;
}

/**
 * Calculates the exact sheet name in MONTH ORDINAL format (e.g. JAN 1ST, JAN 2ND, FEB 1ST, JUL 2ND)
 * for a weekly group among a sorted array of weekly groups.
 */
export function getWeeklySheetName(
  group: WeeklyManifestGroup,
  allGroupsSortedAsc: WeeklyManifestGroup[]
): string {
  const d = new Date(group.weekStart);
  if (isNaN(d.getTime())) {
    return "SHEET";
  }
  const year = d.getFullYear();
  const monthIdx = d.getMonth();

  const monthNames = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
  ];
  const monthAbbr = monthNames[monthIdx];

  const monthGroups = allGroupsSortedAsc.filter((g) => {
    const gd = new Date(g.weekStart);
    return !isNaN(gd.getTime()) && gd.getFullYear() === year && gd.getMonth() === monthIdx;
  });

  const indexInMonth = monthGroups.findIndex((g) => g.weekId === group.weekId) + 1;
  const ordinalIdx = indexInMonth > 0 ? indexInMonth : 1;

  const getOrdinalSuffix = (n: number): string => {
    const s = ["TH", "ST", "ND", "RD"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  return `${monthAbbr} ${getOrdinalSuffix(ordinalIdx)}`;
}

