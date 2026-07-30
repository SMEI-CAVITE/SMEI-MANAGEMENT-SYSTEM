/**
 * System Resource & Storage Monitoring Service
 * Scans local storage, IndexedDB, and application registries to compute active persistent files and sync with local backend.
 */

import { api } from "../lib/api";
import { MonitoringFileRecord, PortalType } from "../types";

export const monitoringService = {
  /**
   * Scans client-side local storage (IndexedDB & localStorage) for active persistent files
   * and syncs them to the backend file registry.
   */
  async discoverAndSyncLocalFiles(): Promise<number> {
    try {
      const discoveredFiles: MonitoringFileRecord[] = [];

      // 1. TSD Control No. Compliance Uploaded Documents (Source of Truth)
      try {
        const rawDocs = localStorage.getItem("tsd_uploaded_compliance_docs");
        if (rawDocs) {
          const parsed = JSON.parse(rawDocs);
          if (Array.isArray(parsed)) {
            parsed.forEach((doc: any) => {
              if (doc && doc.id) {
                discoveredFiles.push({
                  id: doc.id,
                  portal: "TSD_PORTAL",
                  documentType: "TSD_CONTROL_NUMBER",
                  fileName: doc.fileName || doc.name || `ControlNo_${doc.id}.pdf`,
                  mimeType: doc.fileType || doc.mimeType || "application/pdf",
                  sizeBytes: Number(doc.size) || Number(doc.sizeBytes) || 250000,
                  storagePath: `IndexedDB:SMEI_DocumentDB/pdf_documents/${doc.id}`,
                  relatedRecordId: doc.controlNo || doc.relatedRecordId || doc.id,
                  uploadedBy: doc.uploadedBy || doc.created_by || "System User",
                  createdAt: doc.uploadedAt || doc.createdAt || new Date().toISOString(),
                  status: "ACTIVE",
                  metadata: {
                    controlNo: doc.controlNo || "",
                    trackingCode: doc.trackingCode || ""
                  }
                });
              }
            });
          }
        }
      } catch (err) {
        console.warn("[MonitoringService] Failed scanning Control No. uploaded docs:", err);
      }

      // 2. TSD Timestamp Images
      try {
        const rawTimestamps = localStorage.getItem("tsd_timestamp_records");
        if (rawTimestamps) {
          const parsed = JSON.parse(rawTimestamps);
          if (Array.isArray(parsed)) {
            parsed.forEach((ts: any) => {
              if (ts && ts.imageUrl) {
                const isDataUrl = typeof ts.imageUrl === "string" && ts.imageUrl.startsWith("data:");
                const sizeEstimate = isDataUrl ? Math.round((ts.imageUrl.length * 3) / 4) : 150000;
                discoveredFiles.push({
                  id: `TS_IMG_${ts.id || Date.now()}`,
                  portal: "TSD_PORTAL",
                  documentType: "TSD_TIMESTAMP_IMAGE",
                  fileName: ts.fileName || `Timestamp_${ts.controlNo || ts.id || "Img"}.jpg`,
                  mimeType: "image/jpeg",
                  sizeBytes: sizeEstimate,
                  storagePath: `localStorage:tsd_timestamp_records/${ts.id}`,
                  relatedRecordId: ts.controlNo || ts.id,
                  uploadedBy: ts.uploadedBy || "Compliance Inspector",
                  createdAt: ts.timestamp || ts.createdAt || new Date().toISOString(),
                  status: "ACTIVE",
                  metadata: {
                    controlNo: ts.controlNo || "",
                    location: ts.location || ""
                  }
                });
              }
            });
          }
        }
      } catch (err) {
        console.warn("[MonitoringService] Failed scanning Timestamp records:", err);
      }

      // 3. TSD Waste Movement Files (Source PDF, Generated File, Merged File)
      try {
        const rawWM = localStorage.getItem("tsd_waste_movement_records");
        if (rawWM) {
          const parsed = JSON.parse(rawWM);
          if (Array.isArray(parsed)) {
            parsed.forEach((wm: any) => {
              if (wm) {
                // Source PDF
                if (wm.sourcePdfId || wm.sourcePdfName) {
                  discoveredFiles.push({
                    id: wm.sourcePdfId || `WM_SRC_${wm.id}`,
                    portal: "TSD_PORTAL",
                    documentType: "TSD_WASTE_MOVEMENT_SOURCE_PDF",
                    fileName: wm.sourcePdfName || `WM_Source_${wm.trackingNo || wm.id}.pdf`,
                    mimeType: "application/pdf",
                    sizeBytes: Number(wm.sourcePdfSize) || 350000,
                    storagePath: `IndexedDB:SMEI_DocumentDB/pdf_documents/${wm.sourcePdfId || wm.id}`,
                    relatedRecordId: wm.trackingNo || wm.id,
                    uploadedBy: wm.createdBy || "Operations Staff",
                    createdAt: wm.createdAt || new Date().toISOString(),
                    status: "ACTIVE",
                    metadata: {
                      generatedFileId: wm.generatedFileId,
                      mergedFileId: wm.mergedFileId
                    }
                  });
                }
                // Generated System File
                if (wm.generatedFileId || wm.generatedFileName) {
                  discoveredFiles.push({
                    id: wm.generatedFileId || `WM_GEN_${wm.id}`,
                    portal: "TSD_PORTAL",
                    documentType: "TSD_WASTE_MOVEMENT_GENERATED_FILE",
                    fileName: wm.generatedFileName || `WM_Generated_${wm.trackingNo || wm.id}.docx`,
                    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    sizeBytes: Number(wm.generatedFileSize) || 120000,
                    storagePath: `localStorage:tsd_waste_movement_records/${wm.id}`,
                    relatedRecordId: wm.trackingNo || wm.id,
                    uploadedBy: wm.createdBy || "System Engine",
                    createdAt: wm.createdAt || new Date().toISOString(),
                    status: "ACTIVE",
                    metadata: {
                      sourceFileId: wm.sourcePdfId,
                      mergedFileId: wm.mergedFileId
                    }
                  });
                }
                // Merged Final File
                if (wm.mergedFileId || wm.mergedFileName) {
                  discoveredFiles.push({
                    id: wm.mergedFileId || `WM_MERGE_${wm.id}`,
                    portal: "TSD_PORTAL",
                    documentType: "TSD_WASTE_MOVEMENT_MERGED_FILE",
                    fileName: wm.mergedFileName || `WM_Final_Merged_${wm.trackingNo || wm.id}.pdf`,
                    mimeType: "application/pdf",
                    sizeBytes: Number(wm.mergedFileSize) || 450000,
                    storagePath: `IndexedDB:SMEI_DocumentDB/pdf_documents/${wm.mergedFileId || wm.id}`,
                    relatedRecordId: wm.trackingNo || wm.id,
                    uploadedBy: wm.createdBy || "Operations Staff",
                    createdAt: wm.createdAt || new Date().toISOString(),
                    status: "ACTIVE",
                    metadata: {
                      sourceFileId: wm.sourcePdfId,
                      generatedFileId: wm.generatedFileId
                    }
                  });
                }
              }
            });
          }
        }
      } catch (err) {
        console.warn("[MonitoringService] Failed scanning Waste Movement records:", err);
      }

      // 4. TSD Manifest Summary Workbooks
      // Rule: 1 annual workbook = 1 physical persistent file. Weekly sheets are metadata!
      try {
        const rawManifests = localStorage.getItem("tsd_manifest_summary_ledger");
        if (rawManifests) {
          const parsed = JSON.parse(rawManifests);
          if (typeof parsed === "object" && parsed !== null) {
            const years = Object.keys(parsed);
            years.forEach((yearStr) => {
              const yearData = parsed[yearStr];
              const sheetCount = yearData && yearData.weeks ? Object.keys(yearData.weeks).length : 52;
              discoveredFiles.push({
                id: `MANIFEST_WORKBOOK_${yearStr}`,
                portal: "TSD_PORTAL",
                documentType: "TSD_MANIFEST_SUMMARY",
                fileName: `MANIFEST_SUMMARY_${yearStr}.xlsx`,
                mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                sizeBytes: 1540000 + (sheetCount * 12000), // Estimated annual workbook size
                storagePath: `localStorage:tsd_manifest_summary_ledger/${yearStr}`,
                relatedRecordId: `MANIFEST_${yearStr}`,
                uploadedBy: "System Manifest Engine",
                createdAt: `${yearStr}-01-01T00:00:00.000Z`,
                status: "ACTIVE",
                metadata: {
                  manifestYear: Number(yearStr) || 2026,
                  sheetCount
                }
              });
            });
          }
        } else {
          // Default 2026 manifest workbook if active in system
          discoveredFiles.push({
            id: `MANIFEST_WORKBOOK_2026`,
            portal: "TSD_PORTAL",
            documentType: "TSD_MANIFEST_SUMMARY",
            fileName: "MANIFEST_SUMMARY_2026.xlsx",
            mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            sizeBytes: 2150000,
            storagePath: "localStorage:tsd_manifest_summary_ledger/2026",
            relatedRecordId: "MANIFEST_2026",
            uploadedBy: "System Manifest Engine",
            createdAt: "2026-01-01T00:00:00.000Z",
            status: "ACTIVE",
            metadata: {
              manifestYear: 2026,
              sheetCount: 52
            }
          });
        }
      } catch (err) {
        console.warn("[MonitoringService] Failed scanning Manifest Summary workbooks:", err);
      }

      // 5. SMEI Management System Document Records (PO, PIS, RFS, Canvass)
      try {
        const [pos, pises, rfses, canvasses] = await Promise.all([
          api.getPOs().catch(() => []),
          api.getPIS().catch(() => []),
          api.getRFS().catch(() => []),
          api.getCanvass().catch(() => [])
        ]);

        pos.forEach((po) => {
          discoveredFiles.push({
            id: `PO_DOC_${po.id}`,
            portal: "SMEI_MANAGEMENT_SYSTEM",
            documentType: "PURCHASE_ORDER",
            fileName: `${po.poNumber || po.id}.pdf`,
            mimeType: "application/pdf",
            sizeBytes: 185000 + ((po.items || []).length * 1500),
            storagePath: `data/db.json:purchase_orders/${po.id}`,
            relatedRecordId: po.poNumber || po.id,
            uploadedBy: po.preparedBy || po.created_by || "Purchasing Staff",
            createdAt: po.createdAt || po.poDate || new Date().toISOString(),
            status: po.status === "Cancelled" ? "ARCHIVED" : "ACTIVE"
          });
        });

        pises.forEach((pis) => {
          discoveredFiles.push({
            id: `PIS_DOC_${pis.id}`,
            portal: "SMEI_MANAGEMENT_SYSTEM",
            documentType: "PIS",
            fileName: `${pis.pisNumber || pis.id}.pdf`,
            mimeType: "application/pdf",
            sizeBytes: 145000,
            storagePath: `data/db.json:payment_instruction_slips/${pis.id}`,
            relatedRecordId: pis.pisNumber || pis.id,
            uploadedBy: pis.preparedBy || pis.created_by || "Accounting Staff",
            createdAt: pis.createdAt || new Date().toISOString(),
            status: pis.status === "Cancelled" ? "ARCHIVED" : "ACTIVE"
          });
        });

        rfses.forEach((rfs) => {
          discoveredFiles.push({
            id: `RFS_DOC_${rfs.id}`,
            portal: "SMEI_MANAGEMENT_SYSTEM",
            documentType: "RFS",
            fileName: `${rfs.rfsNumber || rfs.id}.pdf`,
            mimeType: "application/pdf",
            sizeBytes: 160000 + ((rfs.items || []).length * 1200),
            storagePath: `data/db.json:requests_for_supply/${rfs.id}`,
            relatedRecordId: rfs.rfsNumber || rfs.id,
            uploadedBy: rfs.requestedBy || rfs.created_by || "Department Head",
            createdAt: rfs.createdAt || new Date().toISOString(),
            status: rfs.status === "Cancelled" ? "ARCHIVED" : "ACTIVE"
          });
        });

        canvasses.forEach((canv) => {
          discoveredFiles.push({
            id: `CANV_DOC_${canv.id}`,
            portal: "SMEI_MANAGEMENT_SYSTEM",
            documentType: "CANVASS_SHEET",
            fileName: `${canv.canvassNumber || canv.id}.pdf`,
            mimeType: "application/pdf",
            sizeBytes: 210000,
            storagePath: `data/db.json:canvass_sheets/${canv.id}`,
            relatedRecordId: canv.canvassNumber || canv.id,
            uploadedBy: canv.requestedBy || canv.created_by || "Purchasing Staff",
            createdAt: canv.createdAt || new Date().toISOString(),
            status: canv.status === "Cancelled" ? "ARCHIVED" : "ACTIVE"
          });
        });
      } catch (err) {
        console.warn("[MonitoringService] Failed scanning SMEI documents:", err);
      }

      // Sync discovered files to central backend monitoring registry
      if (discoveredFiles.length > 0) {
        const result = await api.syncMonitoringFiles(discoveredFiles);
        return result.count || discoveredFiles.length;
      }

      return 0;
    } catch (err) {
      console.error("[MonitoringService] Error discovering and syncing local files:", err);
      return 0;
    }
  }
};
