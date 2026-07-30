import { composeWasteMovementDocument } from "./wasteMovementPdf";

/**
 * Helper to fetch source file base64 data from IndexedDB, localStorage, or record.
 */
export async function getWasteMovementSourceFileData(record: any): Promise<string> {
  if (!record || !record.id) return record?.sourceFileData || "";
  try {
    if (typeof indexedDB !== "undefined") {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("smei_waste_movement_db", 1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const tx = db.transaction("files", "readonly");
      const store = tx.objectStore("files");
      const req = store.get(`tsd_wm_file_${record.id}`);
      const res = await new Promise<string>((resolve) => {
        req.onsuccess = () => resolve(req.result || "");
        req.onerror = () => resolve("");
      });
      if (res) return res;
    }
  } catch (e) {
    console.warn("Failed to read from waste movement IndexedDB:", e);
  }
  return localStorage.getItem(`tsd_wm_file_${record.id}`) || record?.sourceFileData || "";
}

/**
 * Combines the original source document and the generated PDF-template-derived PDF.
 * This function is maintained with the exact same signature to guarantee 100% backward
 * compatibility with all existing calling components in the codebase.
 */
export async function mergeSourceAndExcelPdf(
  sourceFileName: string,
  sourceDataBase64: string,
  record: any
): Promise<{ blob: Blob; hasMultiplePages: boolean }> {
  console.log(`[PDF Legacy Router] Forwarding merge request for: ${sourceFileName}`);
  return composeWasteMovementDocument(sourceFileName, sourceDataBase64, record);
}
