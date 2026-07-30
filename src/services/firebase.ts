/**
 * Firebase Service Initialization & Readiness Layer
 * Prepared for Firebase Spark (Free) plan integration.
 */

import { app, db } from "../lib/firebase";
import { getFirebaseConfig, isFirebaseConfigured } from "../config/env";

export { app, db };

export const isFirebaseReady = (): boolean => {
  return isFirebaseConfigured() && db !== undefined;
};

export const getActiveFirebaseConfig = () => {
  return getFirebaseConfig();
};
