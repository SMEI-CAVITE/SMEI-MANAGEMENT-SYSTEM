import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  where,
  writeBatch, 
  Unsubscribe as FirestoreUnsubscribe
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { Notification, PortalType } from "../types";
import { safeSetLocalStorage } from "../utils/heavyStorage";
import { api } from "../lib/api";
import { sanitizeFirestorePayload } from "../utils/sanitize";

export const NOTIFICATIONS_COLLECTION = "notifications";

export class NotificationRepositoryService {
  /**
   * Robust Portal Classification & Inference
   */
  public static inferPortal(notif: Partial<Notification> | any): PortalType {
    if (!notif) return "PURCHASE";

    if (notif.portal) {
      const p = String(notif.portal).toUpperCase().trim();
      if (p === "TSD" || p === "ENVIRONMENTAL") return "TSD";
      if (p === "PURCHASE" || p === "PROCUREMENT" || p === "PO") return "PURCHASE";
    }

    const title = String(notif.title || "").toLowerCase();
    const msg = String(notif.message || "").toLowerCase();
    const mod = String(notif.module || "").toLowerCase();
    const docType = String(notif.documentType || "").toUpperCase();

    // Check TSD indicators
    if (
      notif.workflowId ||
      ["control-no", "unloading-loading", "hazardous-waste", "waste-movement", "timestamp", "manifest-summary", "coa workflow", "tsd", "control number", "unloading / loading", "hazardous waste", "waste movement"].includes(mod) ||
      title.includes("control number") ||
      title.includes("unloading") ||
      title.includes("hazardous waste") ||
      title.includes("waste movement") ||
      title.includes("timestamp") ||
      title.includes("manifest summary") ||
      title.includes("coa workflow") ||
      msg.includes("control no") ||
      msg.includes("ca-") ||
      msg.includes("hazardous waste") ||
      msg.includes("waste movement")
    ) {
      return "TSD";
    }

    // Explicit Purchase Portal document check
    if (
      docType === "PO" ||
      docType === "PIS" ||
      docType === "RFS" ||
      docType === "CANVASS" ||
      notif.poId ||
      title.includes("pis approved") ||
      title.includes("po approved") ||
      title.includes("rfs approved") ||
      title.includes("canvass approved") ||
      title.includes("purchase order") ||
      title.includes("payment instruction") ||
      title.includes("request for supply") ||
      msg.includes("pis (") ||
      msg.includes("po (") ||
      msg.includes("rfs (") ||
      msg.includes("canvass")
    ) {
      return "PURCHASE";
    }

    return "PURCHASE";
  }

  /**
   * Helper to normalize portal identifier to standard 'PURCHASE' or 'TSD'
   */
  public static normalizePortal(portal?: string | null, notifData?: any): PortalType {
    if (notifData) {
      return NotificationRepositoryService.inferPortal({ ...notifData, portal });
    }
    if (!portal) return "PURCHASE";
    const p = portal.toUpperCase().trim();
    if (p === "TSD" || p === "ENVIRONMENTAL") return "TSD";
    return "PURCHASE";
  }

  /**
   * Real-time subscription to notifications filtered by portal
   */
  public subscribeToNotifications(
    portal: PortalType | "ALL",
    onUpdate: (notifications: Notification[]) => void,
    onError?: (error: Error) => void
  ): FirestoreUnsubscribe {
    try {
      let q;
      if (portal === "ALL") {
        q = query(collection(db, NOTIFICATIONS_COLLECTION));
      } else {
        const normPortal = NotificationRepositoryService.normalizePortal(portal);
        q = query(
          collection(db, NOTIFICATIONS_COLLECTION),
          where("portal", "==", normPortal)
        );
      }

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: Notification[] = [];
          snapshot.forEach((docSnap) => {
            if (docSnap.exists()) {
              list.push({ id: docSnap.id, ...docSnap.data() } as Notification);
            }
          });

          // Sort descending by createdAt or date/time
          list.sort((a, b) => {
            const timeA = a.createdAt || `${a.date}T${a.time}`;
            const timeB = b.createdAt || `${b.date}T${b.time}`;
            return timeB.localeCompare(timeA);
          });

          // Cache in LocalStorage
          if (list.length > 0) {
            safeSetLocalStorage(`smei_notifications_cache_${portal}`, JSON.stringify(list));
          }

          onUpdate(list);
        },
        (error) => {
          console.warn(`[NotificationRepository] Firestore onSnapshot warning for portal ${portal}:`, error.message);
          if (onError) onError(error);
          
          // Fallback to local cache / REST API
          this.getNotificationsFallback(portal).then(onUpdate).catch(() => {});
        }
      );

      return unsubscribe;
    } catch (err: any) {
      console.warn(`[NotificationRepository] Error setting up Firestore listener for portal ${portal}:`, err);
      // Fallback polling/fetching
      this.getNotificationsFallback(portal).then(onUpdate).catch(() => {});
      return () => {};
    }
  }

  /**
   * Fallback retrieval from REST API or LocalStorage cache
   */
  public async getNotificationsFallback(portal?: PortalType | "ALL"): Promise<Notification[]> {
    try {
      const serverNotifs = await api.getNotifications().catch(() => []);
      if (serverNotifs && serverNotifs.length > 0) {
        if (!portal || portal === "ALL") return serverNotifs;
        const norm = NotificationRepositoryService.normalizePortal(portal);
        return serverNotifs.filter((n) => NotificationRepositoryService.normalizePortal(n.portal) === norm);
      }
    } catch (e) {
      console.warn("[NotificationRepository] REST API fallback error:", e);
    }

    // Try LocalStorage
    try {
      const cacheKey = `smei_notifications_cache_${portal || "ALL"}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn("[NotificationRepository] LocalStorage cache error:", e);
    }

    return [];
  }

  /**
   * Mark a single notification as read in Firestore / REST API
   */
  public async markAsRead(id: string): Promise<void> {
    const readAt = new Date().toISOString();
    try {
      // 1. Update Firestore if accessible
      const docRef = doc(db, NOTIFICATIONS_COLLECTION, id);
      await setDoc(docRef, { isRead: true, status: "READ", readAt }, { merge: true }).catch(() => {});
    } catch (e) {
      console.warn("[NotificationRepository] Firestore markAsRead error:", e);
    }

    // 2. Update Backend REST API
    await api.readNotification(id).catch(() => {});
  }

  /**
   * Mark all notifications as read for a portal and/or user
   */
  public async markAllAsRead(portal?: PortalType | "ALL", userId?: string): Promise<void> {
    const readAt = new Date().toISOString();
    try {
      const normPortal = portal && portal !== "ALL" ? NotificationRepositoryService.normalizePortal(portal) : undefined;
      const q = normPortal 
        ? query(collection(db, NOTIFICATIONS_COLLECTION), where("portal", "==", normPortal))
        : query(collection(db, NOTIFICATIONS_COLLECTION));

      const snapshot = await getDocs(q).catch(() => null);
      if (snapshot && !snapshot.empty) {
        const batch = writeBatch(db);
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (!userId || data.userId === userId || !data.userId) {
            batch.update(docSnap.ref, { isRead: true, status: "READ", readAt });
          }
        });
        await batch.commit().catch(() => {});
      }
    } catch (e) {
      console.warn("[NotificationRepository] Firestore markAllAsRead error:", e);
    }

    // Update REST API
    await api.readAllNotifications().catch(() => {});
  }

  /**
   * Clear all read notifications for a portal
   */
  public async clearReadNotifications(portal?: PortalType | "ALL", userId?: string): Promise<void> {
    try {
      const normPortal = portal && portal !== "ALL" ? NotificationRepositoryService.normalizePortal(portal) : undefined;
      const q = normPortal 
        ? query(collection(db, NOTIFICATIONS_COLLECTION), where("portal", "==", normPortal), where("isRead", "==", true))
        : query(collection(db, NOTIFICATIONS_COLLECTION), where("isRead", "==", true));

      const snapshot = await getDocs(q).catch(() => null);
      if (snapshot && !snapshot.empty) {
        const batch = writeBatch(db);
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (!userId || data.userId === userId || !data.userId) {
            batch.delete(docSnap.ref);
          }
        });
        await batch.commit().catch(() => {});
      }
    } catch (e) {
      console.warn("[NotificationRepository] Firestore clearRead error:", e);
    }

    await api.clearReadNotifications().catch(() => {});
  }

  /**
   * Create a new notification
   */
  public async createNotification(notifData: Partial<Notification>): Promise<Notification> {
    const now = new Date();
    const portal = NotificationRepositoryService.inferPortal(notifData);
    const notif: Notification = {
      id: notifData.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      portal,
      module: notifData.module || (portal === "TSD" ? "COA Workflow" : "Procurement"),
      priority: notifData.priority || "MEDIUM",
      workflowId: notifData.workflowId,
      userId: notifData.userId || "",
      role: notifData.role || "Administrator",
      title: notifData.title || "System Alert",
      message: notifData.message || "",
      date: notifData.date || now.toISOString().split("T")[0],
      time: notifData.time || now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isRead: false,
      poId: notifData.poId,
      documentType: notifData.documentType,
      documentId: notifData.documentId,
      documentNumber: notifData.documentNumber,
      status: "ACTIVE",
      eventType: notifData.eventType || "INFO",
      createdAt: notifData.createdAt || now.toISOString(),
      createdBy: notifData.createdBy || notifData.role || "System"
    };

    try {
      const docRef = doc(db, NOTIFICATIONS_COLLECTION, notif.id);
      const cleanNotif = sanitizeFirestorePayload(notif);
      await setDoc(docRef, cleanNotif, { merge: true }).catch(() => {});
    } catch (e) {
      console.warn("[NotificationRepository] Firestore createNotification error:", e);
    }

    // Persist to REST API
    await api.createNotification(notif).catch(() => {});

    return notif;
  }
}

export const notificationRepository = new NotificationRepositoryService();
