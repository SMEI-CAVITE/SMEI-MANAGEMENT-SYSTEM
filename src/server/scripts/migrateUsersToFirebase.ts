import fs from 'fs';
import path from 'path';
import { firestore } from '../firebaseAdmin.js';
import { UserDB } from '../db.js';

// Setup environment and paths
const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

export async function runMigration() {
  if (!fs.existsSync(DB_FILE)) {
    console.error("Local db.json not found. Run this from the project root where data/db.json exists.");
    process.exit(1);
  }

  console.log(`Reading local database from: ${DB_FILE}`);
  const raw = fs.readFileSync(DB_FILE, "utf-8");
  const data = JSON.parse(raw);

  const users: UserDB[] = data.users || [];

  if (users.length === 0) {
    console.log("No users found to migrate.");
    process.exit(0);
  }

  console.log(`Found ${users.length} users. Starting migration to Firestore...`);

  const batch = firestore.batch();
  let count = 0;

  for (const user of users) {
    // Preserve passwordHash, username, role, status exactly
    const userRef = firestore.collection('users').doc(user.id);
    batch.set(userRef, user, { merge: true });
    console.log(`Prepared user: ${user.username} (${user.id})`);
    count++;

    // Firestore batched writes can have up to 500 operations
    if (count % 400 === 0) {
      await batch.commit();
      console.log(`Committed ${count} users so far...`);
    }
  }

  if (count % 400 !== 0) {
    await batch.commit();
  }

  console.log(`Migration complete. Successfully migrated ${count} users to Firestore.`);
}

// Support running directly from CLI (basic check)
const isCLI = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() || '');
if (isCLI) {
  runMigration().catch(console.error);
}
