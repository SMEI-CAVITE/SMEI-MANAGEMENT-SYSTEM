/**
 * IndexedDB Document Storage Utility
 * Stores heavy PDF binaries in IndexedDB to keep localStorage light and performant.
 */

const DB_NAME = "SMEI_DocumentDB";
const DB_VERSION = 1;
const STORE_NAME = "pdf_documents";

export interface StoredDocumentBinary {
  id: string; // Document ID or Hash
  fileName: string;
  fileType: string;
  size: number;
  uploadedAt: string;
  arrayBuffer: ArrayBuffer;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDocumentBinary(
  id: string,
  fileName: string,
  fileType: string,
  arrayBuffer: ArrayBuffer
): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const record: StoredDocumentBinary = {
      id,
      fileName,
      fileType,
      size: arrayBuffer.byteLength,
      uploadedAt: new Date().toISOString(),
      arrayBuffer,
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("[IndexedDB] Failed to save document binary:", err);
  }
}

export async function getDocumentBinary(id: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => {
        const result = request.result as StoredDocumentBinary | undefined;
        resolve(result ? result.arrayBuffer : null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("[IndexedDB] Failed to retrieve document binary:", err);
    return null;
  }
}

export async function deleteDocumentBinary(id: string): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("[IndexedDB] Failed to delete document binary:", err);
  }
}
