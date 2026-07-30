import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  writeBatch, 
  Unsubscribe,
  Unsubscribe as FirestoreUnsubscribe
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { WorkflowRecord, COAWorkflowStepKey } from "../types/workflow";
import { normalizeControlNo, getTrackingCode } from "../utils/controlNumber";
import { safeSetLocalStorage } from "../utils/heavyStorage";
import { sanitizeFirestorePayload } from "../utils/sanitize";

export const WORKFLOWS_COLLECTION = "coa_workflows";
export const COMPLIANCE_DOCS_COLLECTION = "tsd_compliance_docs";
export const MANIFESTS_COLLECTION = "tsd_manifests";
export const UNLOADING_COLLECTION = "tsd_compliance_records";
export const HAZWASTE_COLLECTION = "tsd_hazwaste_records";
export const WASTE_MOVEMENT_COLLECTION = "tsd_waste_movements";
export const TIMESTAMP_COLLECTION = "tsd_timestamp_records";

export const MODULE_COLLECTION_MAP: Record<COAWorkflowStepKey, string> = {
  "control-no": COMPLIANCE_DOCS_COLLECTION,
  "unloading-loading": UNLOADING_COLLECTION,
  "hazardous-waste": HAZWASTE_COLLECTION,
  "waste-movement": WASTE_MOVEMENT_COLLECTION,
  timestamp: TIMESTAMP_COLLECTION
};

export class WorkflowRepositoryService {
  /**
   * Subscribe to all COA Workflows in real-time via Firestore onSnapshot
   */
  public subscribeToWorkflows(
    onUpdate: (workflows: WorkflowRecord[]) => void,
    onError?: (error: Error) => void
  ): FirestoreUnsubscribe {
    try {
      const q = query(collection(db, WORKFLOWS_COLLECTION));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: WorkflowRecord[] = [];
          snapshot.forEach((docSnap) => {
            if (docSnap.exists()) {
              list.push({ id: docSnap.id, ...docSnap.data() } as WorkflowRecord);
            }
          });
          
          // Sort by createdAt / ID
          list.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

          // Backup to LocalStorage cache
          if (list.length > 0) {
            try {
              safeSetLocalStorage("tsd_workflows", JSON.stringify(list));
            } catch (e) {
              console.warn("[WorkflowRepository] LocalStorage cache backup warning:", e);
            }
          }

          onUpdate(list);
        },
        (err) => {
          console.warn("[WorkflowRepository] Workflows onSnapshot error:", err);
          if (onError) onError(err);
        }
      );
      return unsubscribe;
    } catch (err: any) {
      console.warn("[WorkflowRepository] Failed to initiate subscribeToWorkflows:", err);
      return () => {};
    }
  }

  /**
   * Subscribe to a single active workflow by ID in real-time via Firestore onSnapshot
   */
  public subscribeToWorkflow(
    workflowId: string,
    onUpdate: (workflow: WorkflowRecord | null) => void,
    onError?: (error: Error) => void
  ): FirestoreUnsubscribe {
    if (!workflowId) {
      onUpdate(null);
      return () => {};
    }

    try {
      const docRef = doc(db, WORKFLOWS_COLLECTION, workflowId);
      const unsubscribe = onSnapshot(
        docRef,
        (snapshot) => {
          if (snapshot.exists()) {
            onUpdate({ id: snapshot.id, ...snapshot.data() } as WorkflowRecord);
          } else {
            onUpdate(null);
          }
        },
        (err) => {
          console.warn(`[WorkflowRepository] Workflow ${workflowId} onSnapshot error:`, err);
          if (onError) onError(err);
        }
      );
      return unsubscribe;
    } catch (err: any) {
      console.warn(`[WorkflowRepository] Failed to subscribeToWorkflow ${workflowId}:`, err);
      return () => {};
    }
  }

  /**
   * Subscribe to a specific collection (e.g. tsd_compliance_docs, tsd_manifests) in real-time
   */
  public subscribeToCollection(
    collectionName: string,
    onUpdate: (records: any[]) => void,
    onError?: (error: Error) => void
  ): FirestoreUnsubscribe {
    try {
      const q = query(collection(db, collectionName));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items: any[] = [];
          snapshot.forEach((docSnap) => {
            if (docSnap.exists()) {
              items.push({ id: docSnap.id, ...docSnap.data() });
            }
          });

          // Backup to local storage cache for offline resilience
          if (items.length > 0) {
            try {
              safeSetLocalStorage(collectionName, JSON.stringify(items));
            } catch (e) {
              console.warn(`[WorkflowRepository] LocalStorage backup for ${collectionName} warning:`, e);
            }
          }

          onUpdate(items);
        },
        (err) => {
          console.debug(`[WorkflowRepository] Collection ${collectionName} onSnapshot notice:`, err.message);
          if (onError) onError(err);
        }
      );
      return unsubscribe;
    } catch (err: any) {
      console.warn(`[WorkflowRepository] Failed to subscribeToCollection ${collectionName}:`, err);
      return () => {};
    }
  }

  /**
   * Combined real-time snapshot subscription for COA Tracking Engine.
   * Listens to workflows + 6 child document collections in parallel.
   */
  public subscribeToCOATrackingData(
    onDataUpdate: (payload: {
      workflows: WorkflowRecord[];
      complianceDocs: any[];
      manifestRecords: any[];
      unloadingRecords: any[];
      hazWasteRecords: any[];
      wasteMovements: any[];
      timestampRecords: any[];
    }) => void,
    onError?: (error: Error) => void
  ): FirestoreUnsubscribe {
    let currentWorkflows: WorkflowRecord[] = [];
    let currentDocs: any[] = [];
    let currentManifests: any[] = [];
    let currentUnloading: any[] = [];
    let currentHazWaste: any[] = [];
    let currentMovements: any[] = [];
    let currentTimestamps: any[] = [];

    const emit = () => {
      onDataUpdate({
        workflows: currentWorkflows,
        complianceDocs: currentDocs,
        manifestRecords: currentManifests,
        unloadingRecords: currentUnloading,
        hazWasteRecords: currentHazWaste,
        wasteMovements: currentMovements,
        timestampRecords: currentTimestamps
      });
    };

    const unsubWorkflows = this.subscribeToWorkflows((wf) => {
      currentWorkflows = wf;
      emit();
    }, onError);

    const unsubDocs = this.subscribeToCollection(COMPLIANCE_DOCS_COLLECTION, (docs) => {
      currentDocs = docs;
      emit();
    });

    const unsubManifests = this.subscribeToCollection(MANIFESTS_COLLECTION, (m) => {
      currentManifests = m;
      emit();
    });

    const unsubUnloading = this.subscribeToCollection(UNLOADING_COLLECTION, (u) => {
      currentUnloading = u;
      emit();
    });

    const unsubHaz = this.subscribeToCollection(HAZWASTE_COLLECTION, (h) => {
      currentHazWaste = h;
      emit();
    });

    const unsubMove = this.subscribeToCollection(WASTE_MOVEMENT_COLLECTION, (w) => {
      currentMovements = w;
      emit();
    });

    const unsubTime = this.subscribeToCollection(TIMESTAMP_COLLECTION, (t) => {
      currentTimestamps = t;
      emit();
    });

    // Cleanup function that unsubscribes all 7 real-time Firestore listeners safely
    return () => {
      unsubWorkflows();
      unsubDocs();
      unsubManifests();
      unsubUnloading();
      unsubHaz();
      unsubMove();
      unsubTime();
    };
  }

  /**
   * Save or update a Workflow record in Firestore
   */
  public async saveWorkflow(workflow: WorkflowRecord): Promise<void> {
    if (!workflow || !workflow.id) return;
    try {
      const docRef = doc(db, WORKFLOWS_COLLECTION, workflow.id);
      const cleanWf = sanitizeFirestorePayload({ ...workflow, updatedAt: new Date().toISOString() });
      await setDoc(docRef, cleanWf, { merge: true });
    } catch (err) {
      console.warn(`[WorkflowRepository] Failed to save workflow ${workflow.id} to Firestore:`, err);
    }
  }

  /**
   * Save multiple workflow records atomically using Firestore WriteBatch
   */
  public async saveWorkflowsBatch(workflows: WorkflowRecord[]): Promise<void> {
    if (!workflows || workflows.length === 0) return;
    try {
      const batch = writeBatch(db);
      for (const w of workflows) {
        if (w && w.id) {
          const docRef = doc(db, WORKFLOWS_COLLECTION, w.id);
          const cleanWf = sanitizeFirestorePayload({ ...w, updatedAt: new Date().toISOString() });
          batch.set(docRef, cleanWf, { merge: true });
        }
      }
      await batch.commit();
    } catch (err) {
      console.warn("[WorkflowRepository] Batch save workflows failed:", err);
    }
  }

  /**
   * Save a record to a module collection in Firestore
   */
  public async saveModuleRecord(collectionName: string, record: any): Promise<string> {
    if (!record) return "";
    const docId = record.id || record.docId || `REC-${Date.now()}`;
    record.id = docId;
    try {
      const docRef = doc(db, collectionName, docId);
      const cleanRec = sanitizeFirestorePayload({ ...record, updatedAt: new Date().toISOString() });
      await setDoc(docRef, cleanRec, { merge: true });
    } catch (err) {
      console.warn(`[WorkflowRepository] Failed to save record to ${collectionName}:`, err);
    }
    return docId;
  }

  /**
   * Atomically attach a document record to a workflow in Firestore using WriteBatch
   */
  public async attachRecordToWorkflowInFirestore(
    moduleKey: COAWorkflowStepKey,
    record: any,
    targetWorkflow: WorkflowRecord
  ): Promise<void> {
    try {
      const batch = writeBatch(db);

      // 1. Target Workflow doc
      const wfRef = doc(db, WORKFLOWS_COLLECTION, targetWorkflow.id);
      const cleanWf = sanitizeFirestorePayload({ ...targetWorkflow, updatedAt: new Date().toISOString() });
      batch.set(wfRef, cleanWf, { merge: true });

      // 2. Child Module record doc
      const collectionName = MODULE_COLLECTION_MAP[moduleKey];
      if (collectionName && record) {
        const docId = record.id || record.docId || `REC-${Date.now()}`;
        record.id = docId;
        const recRef = doc(db, collectionName, docId);
        const cleanRec = sanitizeFirestorePayload({ ...record, updatedAt: new Date().toISOString() });
        batch.set(recRef, cleanRec, { merge: true });
      }

      await batch.commit();
    } catch (err) {
      console.warn("[WorkflowRepository] Failed atomic batch attach to Firestore:", err);
    }
  }
}

export const WorkflowRepository = new WorkflowRepositoryService();
