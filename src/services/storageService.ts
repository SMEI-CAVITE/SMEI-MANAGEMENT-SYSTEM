import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../lib/firebase";

export interface StoredDocumentMetadata {
  fileName: string;
  fileType: string;
  fileSize: string;
  bytes: number;
  storagePath: string;
  downloadUrl: string;
  uploadedBy: string;
  uploadedAt: string;
}

/**
 * Uploads a document file or binary buffer to Firebase Storage.
 * Saves in path: documents/{folder}/{uniqueId}_{fileName}
 */
export async function uploadDocumentFile(
  fileOrBuffer: File | Blob | ArrayBuffer | Uint8Array,
  folder: string,
  customFileName?: string,
  uploadedBy: string = "system"
): Promise<StoredDocumentMetadata> {
  const fileName = customFileName || (fileOrBuffer instanceof File ? fileOrBuffer.name : `doc_${Date.now()}`);
  const fileType = fileOrBuffer instanceof File ? fileOrBuffer.type : "application/pdf";
  
  let bytes = 0;
  let blob: Blob;
  if (fileOrBuffer instanceof Blob) {
    blob = fileOrBuffer;
    bytes = fileOrBuffer.size;
  } else if (fileOrBuffer instanceof ArrayBuffer) {
    blob = new Blob([fileOrBuffer], { type: fileType || "application/pdf" });
    bytes = fileOrBuffer.byteLength;
  } else if (fileOrBuffer instanceof Uint8Array) {
    blob = new Blob([fileOrBuffer], { type: fileType || "application/pdf" });
    bytes = fileOrBuffer.byteLength;
  } else {
    blob = new Blob([fileOrBuffer as any], { type: fileType || "application/pdf" });
    bytes = blob.size;
  }

  const fileSizeStr = bytes > 1024 * 1024 
    ? (bytes / (1024 * 1024)).toFixed(2) + " MB" 
    : (bytes / 1024).toFixed(1) + " KB";

  const sanitizedFolder = (folder || "general").replace(/^\/+|\/+$/g, "");
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const uniqueId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const storagePath = `documents/${sanitizedFolder}/${uniqueId}_${sanitizedFileName}`;

  if (!storage) {
    console.warn("[StorageService] Firebase Storage is not initialized. Using data URL fallback.");
    const downloadUrl = await blobToDataUrl(blob);
    return {
      fileName,
      fileType: fileType || "application/pdf",
      fileSize: fileSizeStr,
      bytes,
      storagePath,
      downloadUrl,
      uploadedBy,
      uploadedAt: new Date().toISOString()
    };
  }

  try {
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, blob, {
      contentType: fileType || "application/pdf",
      customMetadata: { uploadedBy, fileName }
    });

    const downloadUrl = await getDownloadURL(storageRef);

    return {
      fileName,
      fileType: fileType || "application/pdf",
      fileSize: fileSizeStr,
      bytes,
      storagePath,
      downloadUrl,
      uploadedBy,
      uploadedAt: new Date().toISOString()
    };
  } catch (err) {
    console.warn("[StorageService] Upload to Firebase Storage encountered issue, using fallback URL:", err);
    const downloadUrl = await blobToDataUrl(blob);
    return {
      fileName,
      fileType: fileType || "application/pdf",
      fileSize: fileSizeStr,
      bytes,
      storagePath,
      downloadUrl,
      uploadedBy,
      uploadedAt: new Date().toISOString()
    };
  }
}

/**
 * Deletes a document file from Firebase Storage.
 */
export async function deleteDocumentFile(storagePath: string): Promise<boolean> {
  if (!storage || !storagePath || storagePath.startsWith("data:") || storagePath.startsWith("localStorage:")) {
    return true;
  }
  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
    return true;
  } catch (err) {
    console.warn(`[StorageService] Failed to delete file at ${storagePath}:`, err);
    return false;
  }
}

/**
 * Retrieves the download URL for a file in Firebase Storage.
 */
export async function getDocumentUrl(storagePath: string, fallbackUrl?: string): Promise<string> {
  if (fallbackUrl && (fallbackUrl.startsWith("http://") || fallbackUrl.startsWith("https://") || fallbackUrl.startsWith("data:"))) {
    return fallbackUrl;
  }
  if (!storage || !storagePath) {
    return fallbackUrl || "";
  }
  try {
    const storageRef = ref(storage, storagePath);
    return await getDownloadURL(storageRef);
  } catch (err) {
    console.warn(`[StorageService] Failed to get URL for ${storagePath}:`, err);
    return fallbackUrl || "";
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string) || "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(blob);
  });
}
