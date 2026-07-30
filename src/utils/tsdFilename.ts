/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TsdDocType =
  | "unloading-loading"
  | "hazardous-waste"
  | "waste-movement"
  | "timestamp";

/**
 * Formats a date string, Date object, or timestamp into two-digit month and 4-digit year: MM-YYYY.
 * Uses the provided record/export date, or falls back to the current date if invalid/missing.
 */
export function formatTsdExportDate(dateInput?: string | Date | null): string {
  if (!dateInput) {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    return `${mm}-${yyyy}`;
  }

  try {
    if (dateInput instanceof Date) {
      if (isNaN(dateInput.getTime())) {
        const now = new Date();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const yyyy = now.getFullYear();
        return `${mm}-${yyyy}`;
      }
      const mm = String(dateInput.getMonth() + 1).padStart(2, "0");
      const yyyy = dateInput.getFullYear();
      return `${mm}-${yyyy}`;
    }

    if (typeof dateInput === "string") {
      const trimmed = dateInput.trim();
      // Match YYYY-MM-DD or YYYY-MM
      const ymdMatch = trimmed.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?/);
      if (ymdMatch) {
        const yyyy = ymdMatch[1];
        const mm = String(parseInt(ymdMatch[2], 10)).padStart(2, "0");
        return `${mm}-${yyyy}`;
      }

      // Match MM/DD/YYYY or MM-DD-YYYY
      const mdyMatch = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
      if (mdyMatch) {
        const mm = String(parseInt(mdyMatch[1], 10)).padStart(2, "0");
        const yyyy = mdyMatch[3];
        return `${mm}-${yyyy}`;
      }

      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        return `${mm}-${yyyy}`;
      }
    }

    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    return `${mm}-${yyyy}`;
  } catch {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    return `${mm}-${yyyy}`;
  }
}

/**
 * Returns standardized filename for TSD document exports according to organization rules.
 *
 * 1. Unloading / Loading:  LOADING UNLOADING PHOTOS MM-YYYY.ext
 * 2. Hazardous Waste:     Hazwaste Breakdown MM-YYYY.ext
 * 3. Waste Movement:      COT & Waste Movement MM-YYYY.ext
 * 4. Timestamp:           TIMESTAMP (SERIES) MM-YYYY.ext
 */
export function getTsdExportFilename(
  type: TsdDocType,
  dateInput?: string | Date | null,
  extension: string = "xlsm"
): string {
  const formattedDate = formatTsdExportDate(dateInput);
  const ext = extension ? (extension.startsWith(".") ? extension : `.${extension}`) : ".xlsm";

  switch (type) {
    case "unloading-loading":
      return `LOADING UNLOADING PHOTOS ${formattedDate}${ext}`;
    case "hazardous-waste":
      return `Hazwaste Breakdown ${formattedDate}${ext}`;
    case "waste-movement":
      return `COT & Waste Movement ${formattedDate}${ext}`;
    case "timestamp":
      return `TIMESTAMP (SERIES) ${formattedDate}${ext}`;
    default:
      return `TSD_DOCUMENT_${formattedDate}${ext}`;
  }
}
