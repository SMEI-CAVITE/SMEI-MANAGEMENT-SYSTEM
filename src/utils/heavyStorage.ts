/**
 * SMEI Heavy Storage Utility (IndexedDB + Synchronous In-Memory Cache)
 * Replaces direct localStorage calls for high-volume Base64 images, PDFs, and photos.
 * Prevents QuotaExceededError by keeping heavy payloads in IndexedDB while maintaining
 * light JSON records in localStorage.
 */

const DB_NAME = "SMEI_HeavyStorageDB";
const DB_VERSION = 1;
const STORE_NAME = "heavy_payloads";

// In-memory cache for synchronous component access
const memoryCache = new Map<string, string>();
let isInitialized = false;

function openPayloadDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported in this environment"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Initialize Heavy Storage:
 * 1. Preloads IndexedDB payloads into memory cache.
 * 2. Purges legacy heavy keys from localStorage to reclaim storage space.
 */
export async function initHeavyStorage(): Promise<void> {
  if (isInitialized) return;
  try {
    const db = await openPayloadDB();
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);

    await new Promise<void>((resolve) => {
      const cursorRequest = store.openCursor();
      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          if (typeof cursor.value === "string") {
            memoryCache.set(String(cursor.key), cursor.value);
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      cursorRequest.onerror = () => resolve();
    });

    isInitialized = true;
  } catch (err) {
    console.warn("[HeavyStorage] Failed to preload from IndexedDB:", err);
  }

  // Purge legacy heavy payload keys from localStorage
  purgeLegacyLocalStorageHeavyPayloads();
}

/**
 * Scans localStorage and migrates any heavy payload keys into IndexedDB,
 * removing them from localStorage to reclaim quota.
 */
export function purgeLegacyLocalStorageHeavyPayloads(): void {
  try {
    const heavyPrefixes = [
      "tsd_unloading_data_",
      "tsd_loading_data_",
      "tsd_photo_",
      "tsd_wm_file_",
      "tsd_doc_binary_"
    ];

    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      const isHeavyKey = heavyPrefixes.some((prefix) => key.startsWith(prefix));
      if (isHeavyKey) {
        const val = localStorage.getItem(key);
        if (val) {
          memoryCache.set(key, val);
          saveHeavyPayloadToIDB(key, val);
        }
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch (e) {
        // ignore
      }
    });

    if (keysToRemove.length > 0) {
      console.log(`[HeavyStorage] Purged ${keysToRemove.length} heavy payload keys from localStorage.`);
    }
  } catch (err) {
    console.warn("[HeavyStorage] Purge error:", err);
  }
}

async function saveHeavyPayloadToIDB(key: string, value: string): Promise<void> {
  try {
    const db = await openPayloadDB();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    await new Promise<void>((resolve, reject) => {
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error(`[HeavyStorage] Failed to save key "${key}" to IndexedDB:`, err);
  }
}

/**
 * Synchronous read getter for heavy payloads
 */
export function getHeavyPayload(key: string): string {
  if (memoryCache.has(key)) {
    return memoryCache.get(key) || "";
  }
  const lsVal = localStorage.getItem(key);
  if (lsVal) {
    memoryCache.set(key, lsVal);
    saveHeavyPayloadToIDB(key, lsVal).then(() => {
      try {
        localStorage.removeItem(key);
      } catch (e) {}
    });
    return lsVal;
  }
  return "";
}

/**
 * Save heavy payload to memory cache + IndexedDB, keeping localStorage clean.
 */
export function saveHeavyPayload(key: string, value: string): void {
  if (!value) {
    deleteHeavyPayload(key);
    return;
  }

  memoryCache.set(key, value);

  try {
    localStorage.removeItem(key);
  } catch (e) {}

  saveHeavyPayloadToIDB(key, value);
}

/**
 * Remove heavy payload from cache, localStorage, and IndexedDB
 */
export function deleteHeavyPayload(key: string): void {
  memoryCache.delete(key);
  try {
    localStorage.removeItem(key);
  } catch (e) {}

  openPayloadDB().then((db) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.delete(key);
  }).catch((err) => console.warn("[HeavyStorage] Failed to delete key from IDB:", key, err));
}

/**
 * Safe wrapper around localStorage.setItem that catches QuotaExceededError,
 * automatically purges heavy keys, and retries.
 */
export function safeSetLocalStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (err: any) {
    console.warn(`[LocalStorage] Quota error on "${key}", attempting heavy payload purge...`, err);
    purgeLegacyLocalStorageHeavyPayloads();
    try {
      localStorage.setItem(key, value);
    } catch (retryErr) {
      console.error(`[LocalStorage] Failed to save "${key}" even after purge:`, retryErr);
      saveHeavyPayload(key, value);
    }
  }
}

// Automatically kick off initialization on import
if (typeof window !== "undefined") {
  initHeavyStorage().catch((err) => console.warn("[HeavyStorage] Auto-init warning:", err));
}
