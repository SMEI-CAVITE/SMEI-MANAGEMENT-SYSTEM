import { ManifestRecord, WasteItem, getRecordCompany } from "../components/HazardousWasteModule";

/**
 * Generate dynamic worksheet name adhering to: COMPANY MM-DD
 * Excel worksheet name limit: 31 characters max.
 * Strips characters invalid in Excel sheet names.
 */
export function getHazwasteSheetName(
  companyName: string,
  exportDateInput?: string | Date | null,
  existingNames: Set<string> = new Set()
): string {
  let dateObj = new Date();
  if (exportDateInput) {
    if (exportDateInput instanceof Date && !isNaN(exportDateInput.getTime())) {
      dateObj = exportDateInput;
    } else if (typeof exportDateInput === "string") {
      const matchYmd = exportDateInput.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (matchYmd) {
        dateObj = new Date(parseInt(matchYmd[1]), parseInt(matchYmd[2]) - 1, parseInt(matchYmd[3]));
      } else {
        const d = new Date(exportDateInput.trim());
        if (!isNaN(d.getTime())) dateObj = d;
      }
    }
  }

  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getDate()).padStart(2, "0");
  const dateSuffix = `${mm}-${dd}`; // 5 chars, e.g., "07-22"

  let cleanCompany = (companyName || "COMPANY")
    .trim()
    .replace(/[:\\/?*\[\]]/g, "");
  if (!cleanCompany) cleanCompany = "COMPANY";

  const maxCompLength = 31 - (dateSuffix.length + 1); // 31 - 6 = 25
  let baseComp = cleanCompany.substring(0, maxCompLength).trim();
  let candidate = `${baseComp} ${dateSuffix}`;

  let counter = 2;
  while (existingNames.has(candidate.toUpperCase())) {
    const counterStr = ` (${counter})`;
    const allowedCompLen = maxCompLength - counterStr.length;
    const truncated = cleanCompany.substring(0, allowedCompLen).trim();
    candidate = `${truncated} ${dateSuffix}${counterStr}`;
    counter++;
  }

  existingNames.add(candidate.toUpperCase());
  return candidate;
}

export interface HazwasteExportGroup {
  sheetName: string;
  client: string;
  manifestNo: string;
  date: string;
  quantityKg: number;
  mrrNo: string;
  recycle: string;
  preparedBy: string;
  preparedPosition: string;
  checkedApprovedBy: string;
  checkedApprovedPosition: string;
  items: WasteItem[];
  totalQty: number;
  totalHaz: number;
  totalTsd: number;
  totalNonHaz: number;
  records: ManifestRecord[];
}

/**
 * Build Hazardous Waste Export Data where each document becomes a worksheet,
 * ordered chronologically by Hauling Date, then Company Name.
 */
export function buildHazwasteExportData(
  recordsToExport: ManifestRecord[],
  exportDateInput?: string | Date | null
) {
  const activeExportDate =
    exportDateInput ||
    (recordsToExport.length > 0
      ? recordsToExport[0].date || recordsToExport[0].createdAt
      : new Date().toISOString());

  // Sort records chronologically by hauling date ascending, then company name ascending
  const sortedRecords = [...recordsToExport].sort((a, b) => {
    const dateAStr = a.date || a.createdAt;
    const dateBStr = b.date || b.createdAt;
    const dateA = dateAStr ? new Date(dateAStr).getTime() : 0;
    const dateB = dateBStr ? new Date(dateBStr).getTime() : 0;
    if (dateA !== dateB) {
      return dateA - dateB;
    }
    const compA = (getRecordCompany(a) || a.client || "").trim().toUpperCase();
    const compB = (getRecordCompany(b) || b.client || "").trim().toUpperCase();
    return compA.localeCompare(compB);
  });

  const existingSheetNames = new Set<string>();

  const hazwasteGroups: HazwasteExportGroup[] = sortedRecords.map((rec) => {
    const displayCompany = getRecordCompany(rec) || rec.client || "COMPANY";
    const recDate = rec.date || rec.createdAt || activeExportDate;
    const sheetName = getHazwasteSheetName(displayCompany, recDate, existingSheetNames);

    const items: WasteItem[] = rec.items && Array.isArray(rec.items) ? rec.items : [];

    let totalQty = 0;
    let totalHaz = 0;
    let totalTsd = 0;
    let totalNonHaz = 0;

    items.forEach((item) => {
      if (item.qty !== undefined && item.qty !== null && !isNaN(Number(item.qty))) {
        totalQty += Number(item.qty);
      }
      if (item.haz_waste !== undefined && item.haz_waste !== null && !isNaN(Number(item.haz_waste))) {
        totalHaz += Number(item.haz_waste);
      }
      if (item.local_tsd !== undefined && item.local_tsd !== null && !isNaN(Number(item.local_tsd))) {
        totalTsd += Number(item.local_tsd);
      }
      if (item.non_haz !== undefined && item.non_haz !== null && !isNaN(Number(item.non_haz))) {
        totalNonHaz += Number(item.non_haz);
      }
    });

    const isApplicable = totalTsd > 0 || totalNonHaz > 0;
    const exportRecycle = isApplicable
      ? rec.recycle && rec.recycle.toUpperCase() !== "N/A"
        ? rec.recycle
        : "N/A"
      : "N/A";

    return {
      sheetName,
      client: displayCompany,
      manifestNo: rec.manifestNo || "",
      date: rec.date || "",
      quantityKg: rec.quantityKg || totalQty || 0,
      mrrNo: rec.mrrNo || "",
      recycle: exportRecycle,
      preparedBy: rec.preparedBy || "",
      preparedPosition: rec.preparedPosition || "",
      checkedApprovedBy: rec.checkedApprovedBy || "",
      checkedApprovedPosition: rec.checkedApprovedPosition || "",
      items,
      totalQty,
      totalHaz,
      totalTsd,
      totalNonHaz,
      records: [rec],
    };
  });

  const firstGroup: Partial<HazwasteExportGroup> = hazwasteGroups[0] || {};

  return {
    CLIENT: firstGroup.client || "",
    MANIFEST: firstGroup.manifestNo || "",
    DATE: firstGroup.date || "",
    QUANTITY: firstGroup.quantityKg || 0,
    MRR_NO: firstGroup.mrrNo || "",
    RECYCLE: firstGroup.recycle || "N/A",
    TOTAL_QTY: firstGroup.totalQty || 0,
    TOTAL_HAZ_WASTE: firstGroup.totalHaz || 0,
    TOTAL_LOCAL_TSD: firstGroup.totalTsd || 0,
    TOTAL_NON_HAZ: firstGroup.totalNonHaz || 0,
    PREPARED_BY: firstGroup.preparedBy || "",
    PREPARED_POSITION: firstGroup.preparedPosition || "",
    CHECKED_APPROVED_BY: firstGroup.checkedApprovedBy || "",
    CHECKED_APPROVED_POSITION: firstGroup.checkedApprovedPosition || "",
    _hazwasteGroups: hazwasteGroups,
  };
}
