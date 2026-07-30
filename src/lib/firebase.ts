import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { 
  getFirestore, 
  enableMultiTabIndexedDbPersistence, 
  enableIndexedDbPersistence,
  Firestore 
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

let app: FirebaseApp;
let db: Firestore;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  // Initialize Firestore with specific database ID if provided
  if (firebaseConfig.firestoreDatabaseId) {
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  } else {
    db = getFirestore(app);
  }

  // Enable offline persistence
  if (typeof window !== "undefined") {
    if (enableMultiTabIndexedDbPersistence) {
      enableMultiTabIndexedDbPersistence(db).catch((err) => {
        if (err.code === "failed-precondition") {
          console.warn("[Firebase] Persistence failed: Multiple tabs open", err);
        } else if (err.code === "unimplemented") {
          console.warn("[Firebase] Browser does not support persistence", err);
        }
      });
    } else if (enableIndexedDbPersistence) {
      enableIndexedDbPersistence(db).catch((err) => {
        console.warn("[Firebase] Offline persistence enable error:", err);
      });
    }
  }
} catch (err) {
  console.error("[Firebase Initialization Error]:", err);
  // Fallback app/db creation
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  db = getFirestore(app);
}

export { app, db };
