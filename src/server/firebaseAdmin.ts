import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

let firebaseConfig: any = {};
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (err) {
  // Ignore config load error if missing
}

// Initialize Firebase Admin SDK
if (!getApps().length) {
  try {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
      const serviceAccount = JSON.parse(serviceAccountKey);
      initializeApp({
        credential: cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id || firebaseConfig.projectId
      });
    } else {
      initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId
      });
    }
  } catch (error) {
    console.error('Firebase Admin initialization error', error);
  }
}

const targetDbId = process.env.FIREBASE_DATABASE_ID !== undefined 
  ? process.env.FIREBASE_DATABASE_ID 
  : firebaseConfig.firestoreDatabaseId;

export const firestore = (targetDbId && targetDbId !== '(default)' && targetDbId !== 'default')
  ? getFirestore(targetDbId)
  : getFirestore();

export const firebaseAuth = getAuth();

