import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { hashPassword, UserDB } from './src/server/db.js';

async function createAdminUser() {
  console.log("==================================================");
  console.log("Initializing SMEI Management System Admin User...");
  console.log("==================================================");

  const adminUsername = "admin";
  const adminPassword = "Admin@12345";
  const hashedPassword = hashPassword(adminPassword);

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountKey) {
    console.log("FIREBASE_SERVICE_ACCOUNT_KEY detected. Using Firebase Admin SDK...");
    const { UserRepository } = await import('./src/server/userRepository.js');
    await runWithAdminSDK(UserRepository, adminUsername, hashedPassword);
  } else {
    console.log("No FIREBASE_SERVICE_ACCOUNT_KEY found in environment.");
    console.log("Attempting fallback using Firebase Web SDK with firebase-applet-config.json...");
    await runWithClientSDK(adminUsername, hashedPassword);
  }
}

async function runWithAdminSDK(UserRepository: any, adminUsername: string, hashedPassword: string) {
  try {
    console.log(`Checking if user '${adminUsername}' already exists in Firestore (Admin SDK)...`);
    const existingUser = await UserRepository.getUserByUsername(adminUsername);

    if (existingUser) {
      console.log(`User '${adminUsername}' already exists (ID: ${existingUser.id}).`);
      console.log("Updating password hash, role, and status to ensure admin access...");

      const updatedUser: UserDB = {
        ...existingUser,
        passwordHash: hashedPassword,
        role: "Administrator",
        status: "Active",
        loginAttempts: 0
      };

      await UserRepository.saveUser(updatedUser);
      console.log("Successfully updated existing admin user credentials in Firestore.");
    } else {
      console.log(`User '${adminUsername}' not found. Creating new administrator user...`);

      const newAdmin: UserDB = {
        id: `usr-admin-${Date.now()}`,
        username: adminUsername,
        passwordHash: hashedPassword,
        fullName: "System Administrator",
        email: "admin@smei.com",
        role: "Administrator",
        department: "Management",
        status: "Active",
        loginAttempts: 0,
        position: "System Administrator",
        notificationPreferences: {
          email: true,
          system: true
        }
      };

      await UserRepository.saveUser(newAdmin);
      console.log(`Successfully created admin user '${adminUsername}' with ID: ${newAdmin.id}`);
    }

    printSuccess(adminUsername, hashedPassword);
  } catch (error) {
    console.error("ERROR running with Admin SDK:", error);
    process.exit(1);
  }
}

async function runWithClientSDK(adminUsername: string, hashedPassword: string) {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) {
      throw new Error("firebase-applet-config.json file not found.");
    }

    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const { initializeApp } = await import('firebase/app');
    const { getFirestore, collection, getDocs, doc, setDoc, query, where, limit } = await import('firebase/firestore');

    const app = initializeApp(firebaseConfig);
    const db = firebaseConfig.firestoreDatabaseId 
      ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
      : getFirestore(app);

    const usersCol = collection(db, 'users');
    const q = query(usersCol, where('username', '==', adminUsername), limit(1));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      const existingData = docSnap.data() as UserDB;
      console.log(`User '${adminUsername}' already exists (ID: ${existingData.id || docSnap.id}).`);
      console.log("Updating password hash, role, and status to ensure admin access...");

      const updatedUser: UserDB = {
        ...existingData,
        id: existingData.id || docSnap.id,
        passwordHash: hashedPassword,
        role: "Administrator",
        status: "Active",
        loginAttempts: 0
      };

      await setDoc(doc(db, 'users', updatedUser.id), updatedUser, { merge: true });
      console.log("Successfully updated existing admin user credentials in Firestore.");
    } else {
      console.log(`User '${adminUsername}' not found. Creating new administrator user...`);
      const userId = `usr-admin-${Date.now()}`;

      const newAdmin: UserDB = {
        id: userId,
        username: adminUsername,
        passwordHash: hashedPassword,
        fullName: "System Administrator",
        email: "admin@smei.com",
        role: "Administrator",
        department: "Management",
        status: "Active",
        loginAttempts: 0,
        position: "System Administrator",
        notificationPreferences: {
          email: true,
          system: true
        }
      };

      await setDoc(doc(db, 'users', userId), newAdmin);
      console.log(`Successfully created admin user '${adminUsername}' with ID: ${userId}`);
    }

    printSuccess(adminUsername, hashedPassword);
  } catch (error: any) {
    console.error("==================================================");
    console.error("Notice: Firebase Admin SDK authentication requires FIREBASE_SERVICE_ACCOUNT_KEY in production/Vercel.");
    console.error("Details:", error?.message || error);
    console.error("==================================================");
    process.exit(1);
  }
}

function printSuccess(adminUsername: string, hashedPassword: string) {
  console.log("==================================================");
  console.log("ADMIN CREATION COMPLETE");
  console.log(`Username: ${adminUsername}`);
  console.log(`Password: Admin@12345`);
  console.log(`Password Hash: ${hashedPassword}`);
  console.log(`Role: Administrator`);
  console.log(`Status: Active`);
  console.log("==================================================");
  process.exit(0);
}

createAdminUser();
