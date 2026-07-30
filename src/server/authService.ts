import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { UserRepository } from './userRepository.js';
import { UserDB } from './db.js';

// Legacy password hashing for compatibility
export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export class AuthService {
  static async validateLogin(username: string, password: string): Promise<{ user?: UserDB, error?: string, status?: number }> {
    if (!username || !password) {
      return { error: "Username and password are required", status: 400 };
    }

    const user = await UserRepository.getUserByUsername(username);

    if (!user) {
      return { error: "Invalid username or password", status: 401 };
    }

    if (user.status === "Disabled") {
      return { error: "Your account has been disabled. Please contact your Administrator.", status: 403 };
    }

    if (user.status === "Pending") {
      return { error: "Your account is pending administrator approval.", status: 403 };
    }

    if (user.status === "Locked") {
      return { error: "Your account is locked due to too many failed attempts.", status: 403 };
    }

    const hashed = hashPassword(password);
    if (user.passwordHash !== hashed) {
      // Track login attempts
      const attempts = (user.loginAttempts || 0) + 1;
      user.loginAttempts = attempts;
      if (attempts >= 5) {
        user.status = "Locked";
        await UserRepository.saveUser(user);
        return { error: "Account locked due to 5 consecutive failed login attempts.", status: 403 };
      }
      await UserRepository.saveUser(user);
      return { error: "Invalid username or password", status: 401 };
    }

    // Reset login attempts on success
    user.loginAttempts = 0;
    await UserRepository.saveUser(user);

    return { user, status: 200 };
  }

  static generateToken(user: UserDB, JWT_SECRET: string, expiresIn = "12h"): string {
    const payload = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      department: user.department,
      position: user.position
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
  }

  static verifyToken(token: string, JWT_SECRET: string): Promise<any> {
    return new Promise((resolve, reject) => {
      jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      });
    });
  }
}
