import { composeWasteMovementDocument } from "./wasteMovementPdf";

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
