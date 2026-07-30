import JSZip from "jszip";
import { saveAs } from "file-saver";
import { getActiveWorkflow, getAllWorkflows, syncAllWorkflowsWithStorage, saveWorkflows } from "./workflowManager";
import { getDocumentBinary } from "./documentStorage";
import { getHeavyPayload } from "./heavyStorage";
import { generateXlsxBlob } from "./templatePreview";
import { getTrackingCode, normalizeControlNo } from "./controlNumber";
import { mergeSourceAndExcelPdf, getWasteMovementSourceFileData } from "./pdfMerger";
import { getTsdExportFilename } from "./tsdFilename";

const FALLBACK_1X1_PNG = "data:image/png;base64,iVBOR000KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function formatQuantityDisplay(qty: any): string {
  if (qty === null || qty === undefined || isNaN(Number(qty))) {
    return "0.00";
  }
  return Number(qty).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function calculateTotals(itemList: any[]) {
  const list = itemList || [];
  const totalQty = list.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  const totalHaz = list.reduce((sum, item) => sum + (Number(item.haz_waste) || 0), 0);
  const totalTsd = list.reduce((sum, item) => sum + (Number(item.local_tsd) || 0), 0);
  const totalNonHaz = list.reduce((sum, item) => sum + (Number(item.non_haz) || 0), 0);
  return { totalQty, totalHaz, totalTsd, totalNonHaz };
}

function formatExportDate(isoDate: string): string {
  if (!isoDate) return "DATE";
  try {
    const d = new Date(isoDate);
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const y = d.getFullYear();
    const hr = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${m}${day}${y}_${hr}${min}`;
  } catch (e) {
    return "DATE";
  }
}

export async function exportCompleteCOAPackage(
  onProgress?: (msg: string) => void
): Promise<void> {
  try {
    // 1. First run sync to ensure all legacy and newly created storage records are properly linked to workflows
    syncAllWorkflowsWithStorage();

    const wf = getActiveWorkflow();
    if (!wf || wf.status === "draft") {
      throw new Error("No active completed workflow found to export.");
    }

    if (!wf.documentIds) {
      wf.documentIds = {} as any;
    }

    // Helper to find document ID for a stage across documentIds, workflowId, or controlNo matching
    const findStageRecord = (stageKey: string, collectionKey: string, codeFields: string[]) => {
      const aliasMap: Record<string, string> = {
        "control-no": "controlNumber",
        "unloading-loading": "unloadingLoading",
        "hazardous-waste": "hazardousWaste",
        "waste-movement": "wasteMovement",
        "timestamp": "timestamp"
      };
      let docId = wf.documentIds[stageKey as any] || wf.documentIds[aliasMap[stageKey] as any];
      
      const raw = localStorage.getItem(collectionKey);
      if (!raw) return { docId, record: null };
      
      try {
        const list = JSON.parse(raw);
        if (!Array.isArray(list) || list.length === 0) return { docId, record: null };

        // 1. Try finding by docId if we have one
        let found = docId ? list.find((item: any) => item.id === docId || item.docId === docId) : null;

        // 2. Try finding by workflowId matching active workflow ID
        if (!found) {
          found = list.find((item: any) => item.workflowId === wf.id);
        }

        // 3. Try finding by controlNo matching active workflow controlNo
        if (!found && wf.controlNo) {
          const normWfCode = normalizeControlNo(wf.controlNo);
          found = list.find((item: any) => {
            const code = getTrackingCode(item) || codeFields.map((f) => item[f]).find(Boolean);
            return code && normalizeControlNo(code) === normWfCode;
          });
        }

        if (found) {
          const realId = found.id || found.docId;
          if (realId) {
            wf.documentIds[stageKey as any] = realId;
            if (aliasMap[stageKey]) wf.documentIds[aliasMap[stageKey] as any] = realId;
            docId = realId;
          }
        }
        return { docId, record: found };
      } catch {
        return { docId, record: null };
      }
    };

    const ctrlRes = findStageRecord("control-no", "tsd_uploaded_compliance_docs", ["caNumber", "controlNo"]);
    const unloadRes = findStageRecord("unloading-loading", "tsd_compliance_records", ["caNumber", "controlNo"]);
    const hazRes = findStageRecord("hazardous-waste", "tsd_hazwaste_records", ["controlNo", "caNumber", "manifestNo"]);
    const wmRes = findStageRecord("waste-movement", "tsd_waste_movements", ["controlNo", "caNumber", "breakdownManifestNo"]);
    const tsRes = findStageRecord("timestamp", "tsd_timestamp_records", ["controlNo", "caNumber"]);

    const stageResults: Record<string, { docId: string | undefined; record: any }> = {
      "control-no": ctrlRes,
      "unloading-loading": unloadRes,
      "hazardous-waste": hazRes,
      "waste-movement": wmRes,
      "timestamp": tsRes
    };

    const missing = Object.keys(stageResults).filter((k) => !stageResults[k].record && !stageResults[k].docId);

    if (missing.length > 0) {
      throw new Error(`Incomplete workflow. Missing stages: ${missing.join(", ")}`);
    }

    // Save updated wf.documentIds if any were updated dynamically
    saveWorkflows(getAllWorkflows().map((w) => (w.id === wf.id ? wf : w)));

    if (onProgress) onProgress("Preparing COA Package...");
    
    const zip = new JSZip();

    // 1. Control Number (Uploaded Document)
    if (onProgress) onProgress("Retrieving Control Number document...");
    const controlNoDocId = ctrlRes.docId;
    let controlNoFilename = "CONTROL_NO_DOCUMENT.pdf";
    const controlNoDoc = ctrlRes.record;
    if (controlNoDoc && controlNoDoc.fileName) {
      controlNoFilename = controlNoDoc.fileName;
    }
    let controlNoBuffer: ArrayBuffer | Uint8Array | null = controlNoDocId ? await getDocumentBinary(controlNoDocId) : null;
    if (!controlNoBuffer && controlNoDoc?.fileData) {
      const base64Data = controlNoDoc.fileData.replace(/^data:.*?;base64,/, "");
      const binaryStr = atob(base64Data);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      controlNoBuffer = bytes.buffer;
    }
    if (!controlNoBuffer) {
      throw new Error("Control Number document binary not found in storage.");
    }
    zip.file(`1_Control_Number_${controlNoFilename}`, controlNoBuffer);

    // 2. Unloading / Loading
    if (onProgress) onProgress("Generating Unloading / Loading report...");
    const unloadingRec = unloadRes.record;
    if (!unloadingRec) throw new Error("Unloading record not found");
    
    const unloadingPayload = getHeavyPayload(`tsd_unloading_data_${unloadingRec.id}`) || (unloadingRec.unloadingFileData !== "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" ? unloadingRec.unloadingFileData : "") || FALLBACK_1X1_PNG;
    const loadingPayload = getHeavyPayload(`tsd_loading_data_${unloadingRec.id}`) || (unloadingRec.loadingFileData !== "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" ? unloadingRec.loadingFileData : "") || FALLBACK_1X1_PNG;
    
    const unloadingExportData = {
      CONTROL_NO: unloadingRec.caNumber,
      CA_NO: unloadingRec.caNumber,
      UNLOADING_IMAGE: unloadingPayload,
      LOADING_IMAGE: loadingPayload
    };
    
    const { blob: unloadingBlob } = await generateXlsxBlob("UNLOADING_LOADING_TEMPLATE.xlsm", unloadingExportData, "items", []);
    zip.file(`2_${getTsdExportFilename("unloading-loading", unloadingRec.date || unloadingRec.createdAt, "xlsm")}`, unloadingBlob);

    // 3. Hazardous Waste
    if (onProgress) onProgress("Generating Hazardous Waste report...");
    const hazRec = hazRes.record;
    if (!hazRec) throw new Error("Hazardous waste record not found");
    
    const { totalQty, totalHaz, totalTsd, totalNonHaz } = calculateTotals(hazRec.items);
    const isRecycleApplicable = (totalTsd > 0) || (totalNonHaz > 0);
    const hazExportData = {
      CLIENT: hazRec.client,
      MANIFEST: hazRec.manifestNo,
      DATE: hazRec.date,
      QUANTITY: hazRec.quantityKg,
      MRR_NO: hazRec.mrrNo,
      RECYCLE: isRecycleApplicable ? (hazRec.recycle && hazRec.recycle.toUpperCase() !== "N/A" ? hazRec.recycle : "N/A") : "N/A",
      TOTAL_QTY: totalQty,
      TOTAL_HAZ_WASTE: totalHaz,
      TOTAL_LOCAL_TSD: totalTsd,
      TOTAL_NON_HAZ: totalNonHaz,
      PREPARED_BY: hazRec.preparedBy,
      PREPARED_POSITION: hazRec.preparedPosition,
      CHECKED_APPROVED_BY: hazRec.checkedApprovedBy,
      CHECKED_APPROVED_POSITION: hazRec.checkedApprovedPosition
    };
    
    const { blob: hazBlob } = await generateXlsxBlob("HAZWASTE_TEMPLATE.xlsm", hazExportData, "items", hazRec.items || []);
    zip.file(`3_${getTsdExportFilename("hazardous-waste", hazRec.date || hazRec.createdAt, "xlsx")}`, hazBlob);

    // 4. Waste Movement (Combined PDF)
    if (onProgress) onProgress("Generating Waste Movement report...");
    const wmRec = wmRes.record;
    if (!wmRec) throw new Error("Waste movement record not found");

    const wmFileData = await getWasteMovementSourceFileData(wmRec);
    const { blob: wmPdfBlob } = await mergeSourceAndExcelPdf(
      wmRec.sourceFileName || "DOCUMENT.pdf",
      wmFileData,
      wmRec
    );
    zip.file(`4_${getTsdExportFilename("waste-movement", wmRec.transportDate || wmRec.breakdownDate, "pdf")}`, wmPdfBlob);

    // 5. Timestamp
    if (onProgress) onProgress("Generating Timestamp report...");
    const tsRec = tsRes.record;
    if (!tsRec) throw new Error("Timestamp record not found");
    
    const activePhotoData = getHeavyPayload(`tsd_photo_${tsRec.id}`) || tsRec.photoData || FALLBACK_1X1_PNG;
    const tsExportData = {
      timestamp_photo: activePhotoData,
      ID: tsRec.id,
      DATE: tsRec.createdAt,
      NOTES: tsRec.notes || "Compliance validation photo",
      FILENAME: tsRec.fileName
    };
    
    const { blob: tsBlob } = await generateXlsxBlob("TIME_STAMP_TEMPLATE.xlsm", tsExportData, "items", []);
    zip.file(`5_${getTsdExportFilename("timestamp", tsRec.createdAt, "xlsm")}`, tsBlob);

    // Generate ZIP
    if (onProgress) onProgress("Packaging COA Package...");
    const zipBlob = await zip.generateAsync({ type: "blob" });
    saveAs(zipBlob, `${wf.controlNo || wf.id}_COA_PACKAGE.zip`);

    if (onProgress) onProgress("Download Ready");
  } catch (error: any) {
    console.error("Bulk Export Error:", error);
    throw new Error(error.message || "Unable to complete Bulk Export. An unknown error occurred.");
  }
}
