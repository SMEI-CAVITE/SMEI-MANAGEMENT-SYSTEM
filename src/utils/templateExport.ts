/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { saveAs } from "file-saver";
import { generateDocxBlob, generateXlsxBlob } from "./templatePreview";

/**
 * Reusable Word (.docx) Template Export Service
 */
export async function exportWordWithTemplate(
  templateName: string,
  data: Record<string, any>,
  outputFilename: string
) {
  try {
    console.log("===== TEMPLATE EXPORT STARTED =====");
    console.log("Template:", templateName);
    
    const { blob } = await generateDocxBlob(templateName, data);
    saveAs(blob, outputFilename);
    console.log("===== TEMPLATE EXPORT COMPLETE =====");
  } catch (error: any) {
    console.error("Word Export Error:", error);
    alert(error.message || `An error occurred while exporting to ${outputFilename}`);
  }
}

/**
 * Reusable Excel (.xlsx) Template Export Service
 */
export async function exportExcelWithTemplate(
  templateName: string,
  data: Record<string, any>,
  itemsKey: string,
  items: any[],
  outputFilename: string
) {
  try {
    console.log("===== EXCEL EXPORT STARTED =====");
    console.log("Template:", templateName);
    
    const { blob } = await generateXlsxBlob(templateName, data, itemsKey, items);
    saveAs(blob, outputFilename);
    console.log("===== EXCEL EXPORT COMPLETE =====");
  } catch (error: any) {
    console.error("Excel Export Error:", error);
    alert(error.message || `An error occurred while exporting to ${outputFilename}`);
  }
}
