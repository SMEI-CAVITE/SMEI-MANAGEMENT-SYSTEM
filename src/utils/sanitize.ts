/**
 * Utility to recursively strip undefined properties from objects before sending to Firestore.
 * Prevents "Function setDoc() called with invalid data. Unsupported field value: undefined" errors.
 */
export function sanitizeFirestorePayload<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj !== "object") return obj;

  if (obj instanceof Date) return obj as unknown as T;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeFirestorePayload(item)) as unknown as T;
  }

  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined) {
      continue;
    }
    if (val !== null && typeof val === "object" && !(val instanceof Date)) {
      clean[key] = sanitizeFirestorePayload(val);
    } else {
      clean[key] = val;
    }
  }

  return clean as T;
}
