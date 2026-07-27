/**
 * Manifest Storage & Weekly Period Management Engine
 * Operational Week: Monday through Saturday
 */

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
}

export interface WeeklyManifestGroup {
  weekId: string; // e.g., WEEK_2026_07_20
  weekStart: string; // YYYY-MM-DD (Monday)
  weekEnd: string; // YYYY-MM-DD (Saturday)
  formattedWeekRange: string; // e.g., "JULY 20, 2026 - JULY 25, 2026"
  records: ManifestRecord[];
}

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

    // If Control No. Module has no uploaded files, no manifest records should exist
    if (!activeDocs || activeDocs.length === 0) {
      if (records.length > 0) {
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
      
      // Exclude orphan records or unlinked dummy/placeholder files
      return hasValidDocId || hasValidCaNo;
    });

    // If orphan or dummy records were filtered out, persist the cleaned list
    if (validRecords.length !== records.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validRecords));
    }

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
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

  // Check duplicate by docId, id, or manifestNo
  const existingIndex = records.findIndex(
    (r) =>
      (sanitizedRecord.docId && r.docId === sanitizedRecord.docId) ||
      (r.id === sanitizedRecord.id) ||
      (r.manifestNo && sanitizedRecord.manifestNo && r.manifestNo.trim().toUpperCase() === sanitizedRecord.manifestNo.trim().toUpperCase() && sanitizedRecord.manifestNo.trim().length > 0)
  );

  if (existingIndex >= 0) {
    // Check if updating
    records[existingIndex] = {
      ...records[existingIndex],
      ...sanitizedRecord,
      updatedAt: new Date().toISOString(),
    };
    saveAllManifestRecords(records);
    return {
      success: true,
      isDuplicate: true,
      message: `Manifest ${sanitizedRecord.manifestNo || sanitizedRecord.controlNo} updated successfully.`,
      updatedRecords: records,
    };
  }

  records.unshift(sanitizedRecord);
  saveAllManifestRecords(records);
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
