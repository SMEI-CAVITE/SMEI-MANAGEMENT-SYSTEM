import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { 
  getFirestore, 
  enableMultiTabIndexedDbPersistence, 
  enableIndexedDbPersistence,
  Firestore 
} from "firebase/firestore";
import firebaseConfigJson from "../../firebase-applet-config.json";
import { getFirebaseConfig } from "../config/env";

let app: FirebaseApp | undefined;
let db: Firestore | undefined;

const getActiveConfig = () => {
  const envConfig = getFirebaseConfig();
  if (envConfig.apiKey && envConfig.apiKey.trim() !== "") {
    return envConfig;
  }
  if (firebaseConfigJson && firebaseConfigJson.apiKey && firebaseConfigJson.apiKey.trim() !== "") {
    return firebaseConfigJson;
  }
  return null;
};

const activeConfig = getActiveConfig();

if (activeConfig) {
  try {
    app = getApps().length === 0 ? initializeApp(activeConfig as any) : getApp();
    
    if ((activeConfig as any).firestoreDatabaseId) {
      db = getFirestore(app, (activeConfig as any).firestoreDatabaseId);
    } else {
      db = getFirestore(app);
    }

    if (typeof window !== "undefined" && db) {
      if (enableMultiTabIndexedDbPersistence) {
        enableMultiTabIndexedDbPersistence(db).catch((err) => {
          if (err.code === "failed-precondition") {
            console.warn("[Firebase] Persistence warning: Multiple tabs open");
          } else if (err.code === "unimplemented") {
            console.warn("[Firebase] Browser does not support persistence");
          }
        });
      } else if (enableIndexedDbPersistence) {
        enableIndexedDbPersistence(db).catch((err) => {
          console.warn("[Firebase] Offline persistence enable error:", err);
        });
      }
    }
  } catch (err) {
    console.warn("[Firebase Initialization Warning]:", err);
  }
} else {
  console.info("[Firebase] Firebase is not currently configured. To enable, populate VITE_FIREBASE_* environment variables.");
}

export { app, db };
