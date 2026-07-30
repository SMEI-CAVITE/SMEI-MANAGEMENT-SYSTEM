import { firestore } from './firebaseAdmin.js';
import { UserDB, hashPassword } from './db.js';

const USERS_COLLECTION = 'users';

export class UserRepository {
  /**
   * Ensures default admin user exists in Firestore.
   */
  static async ensureAdminUser(): Promise<UserDB> {
    const adminUsername = "admin";
    const hashedPassword = hashPassword("Admin@12345");
    const existing = await UserRepository.getUserByUsername(adminUsername);

    if (existing) {
      if (existing.passwordHash !== hashedPassword || existing.role !== "Administrator" || existing.status !== "Active") {
        const updated: UserDB = {
          ...existing,
          passwordHash: hashedPassword,
          role: "Administrator",
          status: "Active",
          loginAttempts: 0
        };
        await UserRepository.saveUser(updated);
        return updated;
      }
      return existing;
    }

    const newAdmin: UserDB = {
      id: "usr-admin-initial",
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
    return newAdmin;
  }

  /**
   * Retrieves a user by their exact username.
   */
  static async getUserByUsername(username: string): Promise<UserDB | null> {
    const querySnapshot = await firestore
      .collection(USERS_COLLECTION)
      .where('username', '==', username)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      // Fallback: try case-insensitive search if needed, but Firestore doesn't natively support it.
      // Usually, it's better to store usernames in lowercase as a separate field or just ensure they are stored correctly.
      // For this migration, we'll fetch all and filter to maintain exact compatibility if needed,
      // but let's assume they are stored case-sensitively or we lowercase them upon storage.
      // We will perform a client-side filter just in case.
      const allUsers = await firestore.collection(USERS_COLLECTION).get();
      const match = allUsers.docs.find(doc => doc.data().username.toLowerCase() === username.toLowerCase());
      if (match) {
        return match.data() as UserDB;
      }
      return null;
    }
    return querySnapshot.docs[0].data() as UserDB;
  }

  /**
   * Retrieves a user by their ID.
   */
  static async getUserById(id: string): Promise<UserDB | null> {
    const doc = await firestore.collection(USERS_COLLECTION).doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data() as UserDB;
  }

  /**
   * Retrieves all users.
   */
  static async getAllUsers(): Promise<UserDB[]> {
    const snapshot = await firestore.collection(USERS_COLLECTION).get();
    return snapshot.docs.map(doc => doc.data() as UserDB);
  }

  /**
   * Saves a user (creates or updates).
   */
  static async saveUser(user: UserDB): Promise<void> {
    if (!user.id) {
      throw new Error("User must have an ID to be saved.");
    }
    await firestore.collection(USERS_COLLECTION).doc(user.id).set(user, { merge: true });
  }

  /**
   * Deletes a user by ID.
   */
  static async deleteUser(id: string): Promise<void> {
    await firestore.collection(USERS_COLLECTION).doc(id).delete();
  }
}
