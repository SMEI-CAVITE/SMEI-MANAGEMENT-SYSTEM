/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db, hashPassword, UserDB, PurchaseOrderDB, AuditLogDB } from "./src/server/db.js";

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "smei-enterprise-secret-key-2026-secure-token";

app.use(express.json({ limit: "50mb" }));
app.use(express.static(path.join(process.cwd(), "public")));

// Helper to log audit trails
function logAudit(
  userId: string,
  username: string,
  role: string,
  action: string,
  module: string,
  recordId: string,
  oldVal: string,
  newVal: string,
  req: express.Request
) {
  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
  const browser = req.headers["user-agent"] || "Unknown Browser";
  
  const log: AuditLogDB = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    user_id: userId,
    username,
    role,
    action,
    module,
    record_id: recordId,
    old_value: oldVal,
    new_value: newVal,
    ip_address: ip,
    browser,
    timestamp: new Date().toISOString()
  };
  
  db.saveAuditLog(log);
}

// Helper to resolve or auto-save suppliers (case-insensitive duplicate check)
function resolveOrCreateSupplier(supplierName: string, userId: string): { id: string; name: string } {
  if (!supplierName || !supplierName.trim()) {
    return { id: "unknown", name: "Unknown Supplier" };
  }
  
  const trimmedName = supplierName.trim();
  const suppliers = db.getSuppliers();
  
  // Case-insensitive check
  const existing = suppliers.find(
    s => s.name.toLowerCase() === trimmedName.toLowerCase() || 
         (s.supplier_name && s.supplier_name.toLowerCase() === trimmedName.toLowerCase())
  );
  
  if (existing) {
    return { id: existing.id, name: existing.name };
  }
  
  // Create new supplier
  const newId = `s_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const dateStr = new Date().toISOString().split("T")[0];
  const newSupplier = {
    id: newId,
    name: trimmedName,
    supplier_name: trimmedName,
    attention: "N/A",
    phone: "N/A",
    fax: "N/A",
    address: "N/A",
    category: "Vatable",
    createdAt: dateStr,
    created_at: dateStr,
    created_by: userId
  };
  
  db.saveSupplier(newSupplier);
  return { id: newId, name: trimmedName };
}

// Authentication Middleware
interface AuthRequest extends express.Request {
  user?: {
    id: string;
    username: string;
    fullName: string;
    email: string;
    role: string;
    realRole?: string;
    department: string;
    position?: string;
  };
}

const authenticateToken = (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token is missing" });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    
    // Check if user is active/disabled/locked in DB
    const dbUser = db.getUsers().find(u => u.id === decoded.id);
    if (!dbUser) {
      return res.status(403).json({ error: "User no longer exists" });
    }
    if (dbUser.status !== "Active") {
      return res.status(403).json({ error: `Account is ${dbUser.status}` });
    }

    // Impersonation support for Administrator role
    const impersonatedRole = req.headers["x-impersonate-role"] as string;
    let activeRole = dbUser.role;
    if (dbUser.role === "Administrator" && impersonatedRole) {
      activeRole = impersonatedRole;
    }

    req.user = {
      ...decoded,
      role: activeRole,
      realRole: dbUser.role
    };
    next();
  });
};

// Admin Only Guard
const requireAdmin = (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  if (!req.user || req.user.role !== "Administrator") {
    return res.status(403).json({ error: "Access Denied: Administrator role required" });
  }
  next();
};

// ---------------- API ROUTES ----------------

// 1. AUTHENTICATION

// Login
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const user = db.getUsers().find((u) => u.username.toLowerCase() === username.toLowerCase());

  if (!user) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  if (user.status === "Disabled") {
    return res.status(403).json({ error: "Your account has been disabled. Please contact your Administrator." });
  }

  if (user.status === "Pending") {
    return res.status(403).json({ error: "Your account is pending administrator approval." });
  }

  if (user.status === "Locked") {
    return res.status(403).json({ error: "Your account is locked due to too many failed attempts." });
  }

  const hashed = hashPassword(password);
  if (user.passwordHash !== hashed) {
    // Track login attempts
    const attempts = (user.loginAttempts || 0) + 1;
    user.loginAttempts = attempts;
    if (attempts >= 5) {
      user.status = "Locked";
      db.saveUser(user);
      logAudit(user.id, user.username, user.role, "Account Locked", "Users", user.id, "Active", "Locked", req);
      return res.status(403).json({ error: "Account locked due to 5 consecutive failed login attempts." });
    }
    db.saveUser(user);
    return res.status(401).json({ error: "Invalid username or password" });
  }

  // Reset login attempts on success
  user.loginAttempts = 0;
  db.saveUser(user);

  // Sign JWT with role and department details
  const payload = {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    department: user.department,
    position: user.position
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
  
  logAudit(user.id, user.username, user.role, "User Logged In", "Auth", user.id, "-", "Token Issued", req);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      realRole: user.role,
      department: user.department,
      avatarUrl: user.avatarUrl,
      profile_image: user.profile_image,
      phone_number: user.phone_number,
      position: user.position,
      notificationPreferences: user.notificationPreferences
    }
  });
});

// Get and verify invitation
app.get("/api/auth/invitation/:token", (req, res) => {
  const { token } = req.params;
  const invite = db.getInvitations().find((i) => i.token === token);
  if (!invite) {
    return res.status(404).json({ error: "Invalid invitation link." });
  }
  if (invite.used) {
    return res.status(400).json({ error: "This invitation link has already been used." });
  }
  if (new Date(invite.expiresAt) < new Date()) {
    return res.status(400).json({ error: "This invitation link has expired." });
  }
  res.json({ valid: true, role: invite.role, department: invite.department });
});

// Complete secure registration
app.post("/api/auth/register-public", (req, res) => {
  const { username, password, fullName, department } = req.body;
  if (!username || !password || !fullName || !department) {
    return res.status(400).json({ error: "All registration fields are required." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long." });
  }

  const dup = db.getUsers().find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (dup) {
    return res.status(400).json({ error: "Username is already taken." });
  }

  const userId = `u_${Date.now()}`;
  const newUser: UserDB = {
    id: userId,
    username,
    passwordHash: hashPassword(password),
    fullName,
    email: `${username}@smei-enterprise.com`,
    role: "Viewer", // Default role, Admin can change later
    department,
    status: "Pending" // Awaiting admin approval
  };

  db.saveUser(newUser);
  logAudit(userId, username, "Viewer", "User Registered", "Auth", userId, "-", "New account created via public registration (Pending Approval)", req);

  res.status(201).json({ message: "Registration successful. Please wait for an administrator to approve your account." });
});

app.post("/api/auth/register", (req, res) => {
  const { token, username, password, fullName } = req.body;
  if (!token || !username || !password || !fullName) {
    return res.status(400).json({ error: "All registration fields are required." });
  }

  const invite = db.getInvitations().find((i) => i.token === token);
  if (!invite) {
    return res.status(404).json({ error: "Invalid invitation link." });
  }
  if (invite.used) {
    return res.status(400).json({ error: "This invitation link has already been used." });
  }
  if (new Date(invite.expiresAt) < new Date()) {
    return res.status(400).json({ error: "This invitation link has expired." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long." });
  }

  // Check if username is already taken
  const dup = db.getUsers().find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (dup) {
    return res.status(400).json({ error: "Username is already taken." });
  }

  const userId = `u_${Date.now()}`;
  const newUser: UserDB = {
    id: userId,
    username,
    passwordHash: hashPassword(password),
    fullName,
    email: `${username}@smei-enterprise.com`,
    role: invite.role,
    department: invite.department,
    status: "Active"
  };

  db.saveUser(newUser);

  // Mark invitation as used
  if (invite.isOneTime) {
    invite.used = true;
    db.saveInvitation(invite);
  }

  logAudit(userId, username, invite.role, "User Registered", "Auth", userId, "-", "New account created via invitation", req);

  // Auto log them in
  const payload = {
    id: userId,
    username,
    fullName,
    email: newUser.email,
    role: invite.role,
    department: invite.department
  };

  const jwtToken = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

  res.status(201).json({
    token: jwtToken,
    user: {
      id: userId,
      username,
      fullName,
      email: newUser.email,
      role: invite.role,
      realRole: invite.role,
      department: invite.department
    }
  });
});

// Logout
app.post("/api/auth/logout", authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  logAudit(user.id, user.username, user.role, "User Logged Out", "Auth", user.id, "-", "Logged Out", req);
  res.json({ success: true });
});

// Refresh / Verify Session
app.get("/api/auth/me", authenticateToken, (req: AuthRequest, res) => {
  const user = db.getUsers().find((u) => u.id === req.user!.id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Dynamically refresh JWT on active request to keep session alive for working users
  const payload = {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    role: req.user!.role,
    department: user.department,
    position: user.position
  };
  const refreshedToken = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

  res.json({
    token: refreshedToken,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: req.user!.role,
      realRole: req.user!.realRole,
      department: user.department,
      avatarUrl: user.avatarUrl,
      profile_image: user.profile_image,
      phone_number: user.phone_number,
      position: user.position,
      notificationPreferences: user.notificationPreferences
    }
  });
});

// Update Profile details
app.put("/api/users/profile", authenticateToken, (req: AuthRequest, res) => {
  const user = db.getUsers().find((u) => u.id === req.user!.id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const { 
    firstName, 
    lastName, 
    email, 
    phoneNumber, 
    department, 
    position, 
    username, 
    notificationPreferences,
    currentPassword,
    newPassword
  } = req.body;

  // 1. Password change logic if requested
  if (currentPassword || newPassword) {
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Both current password and new password are required to change password." });
    }
    const hashedCurrent = hashPassword(currentPassword);
    if (user.passwordHash !== hashedCurrent) {
      return res.status(400).json({ error: "Current password is incorrect." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters long." });
    }
    user.passwordHash = hashPassword(newPassword);
    logAudit(user.id, user.username, user.role, "Change Password", "Users", user.id, "-", "Password Updated", req);
  }

  // 2. Profile fields update
  if (firstName !== undefined && lastName !== undefined) {
    user.fullName = `${firstName} ${lastName}`.trim();
  } else if (firstName !== undefined) {
    const parts = user.fullName.split(" ");
    const last = parts.slice(1).join(" ");
    user.fullName = `${firstName} ${last}`.trim();
  } else if (lastName !== undefined) {
    const parts = user.fullName.split(" ");
    const first = parts[0] || "";
    user.fullName = `${first} ${lastName}`.trim();
  }

  if (email !== undefined) user.email = email;
  if (phoneNumber !== undefined) user.phone_number = phoneNumber;
  if (department !== undefined) user.department = department;
  if (position !== undefined) user.position = position;
  if (username !== undefined) {
    // Check username duplicate if changing
    if (username.toLowerCase() !== user.username.toLowerCase()) {
      const dup = db.getUsers().find(u => u.username.toLowerCase() === username.toLowerCase());
      if (dup) {
        return res.status(400).json({ error: "Username is already taken" });
      }
      user.username = username;
    }
  }

  if (notificationPreferences !== undefined) {
    user.notificationPreferences = notificationPreferences;
  }

  db.saveUser(user);
  logAudit(user.id, user.username, user.role, "Update Profile", "Users", user.id, "-", "Profile Details Updated", req);

  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      department: user.department,
      avatarUrl: user.avatarUrl,
      profile_image: user.profile_image,
      phone_number: user.phone_number,
      position: user.position,
      notificationPreferences: user.notificationPreferences
    }
  });
});

// Dedicated log-export route to prevent polluting the User Profile Update logs
app.post("/api/audit/log-export", authenticateToken, (req: AuthRequest, res) => {
  const user = db.getUsers().find((u) => u.id === req.user!.id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  const { action, module, details } = req.body;
  logAudit(
    user.id,
    user.username,
    user.role,
    action || "Export Document",
    module || "Procurement",
    "-",
    "-",
    details || "Exported document",
    req
  );
  res.json({ success: true });
});

// Update Profile Avatar
app.put("/api/users/profile/avatar", authenticateToken, (req: AuthRequest, res) => {
  const user = db.getUsers().find((u) => u.id === req.user!.id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const { avatarData } = req.body; // base64 string or null
  user.avatarUrl = avatarData || undefined;
  user.profile_image = avatarData || undefined;

  db.saveUser(user);
  logAudit(user.id, user.username, user.role, "Update Avatar", "Users", user.id, "-", avatarData ? "Uploaded avatar" : "Removed avatar", req);

  res.json({
    success: true,
    avatarUrl: user.avatarUrl,
    profile_image: user.profile_image
  });
});


// 2. USER MANAGEMENT (Admin Only)
app.get("/api/users", authenticateToken, requireAdmin, (req, res) => {
  const users = db.getUsers().map(({ passwordHash, ...rest }) => rest);
  res.json(users);
});

app.post("/api/users", authenticateToken, requireAdmin, (req: AuthRequest, res) => {
  const { username, password, fullName, email, role, department } = req.body;
  if (!username || !password || !fullName || !email || !role || !department) {
    return res.status(400).json({ error: "All fields are required" });
  }

  // Check if username already exists
  const existing = db.getUsers().find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: "Username already exists" });
  }

  const newUser: UserDB = {
    id: `u_${Date.now()}`,
    username,
    passwordHash: hashPassword(password),
    fullName,
    email,
    role,
    department,
    status: "Active"
  };

  db.saveUser(newUser);
  logAudit(req.user!.id, req.user!.username, req.user!.role, "Create User", "Users", newUser.id, "-", `Created user: ${username}`, req);
  
  const { passwordHash, ...safeUser } = newUser;
  res.status(201).json(safeUser);
});

app.post("/api/users/invite", authenticateToken, requireAdmin, (req: AuthRequest, res) => {
  const { role, department, expiresIn, isOneTime } = req.body;
  if (!role || !department) {
    return res.status(400).json({ error: "Role and department are required for invitations." });
  }

  // Calculate expiration
  let ms = 24 * 60 * 60 * 1000; // default 24h
  if (expiresIn === "1h") ms = 1 * 60 * 60 * 1000;
  else if (expiresIn === "7d") ms = 7 * 24 * 60 * 60 * 1000;
  
  const expiresAt = new Date(Date.now() + ms).toISOString();
  const token = crypto.randomBytes(24).toString("hex");

  const newInvite = {
    token,
    role,
    department,
    expiresAt,
    isOneTime: isOneTime !== false,
    used: false
  };

  db.saveInvitation(newInvite);
  logAudit(req.user!.id, req.user!.username, req.user!.role, "Generate Invitation Link", "Users", token, "-", `Generated link for ${role} in ${department}`, req);

  res.status(201).json({ token });
});

app.put("/api/users/:id", authenticateToken, requireAdmin, (req: AuthRequest, res) => {
  const { fullName, email, role, department, status } = req.body;
  const targetId = req.params.id;

  const user = db.getUsers().find((u) => u.id === targetId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Prevent users from changing their own role/status if they are the logged in admin
  if (targetId === req.user!.id && (role !== user.role || status !== user.status)) {
    return res.status(400).json({ error: "You cannot change your own role or account status" });
  }

  const oldVal = `${user.role} | ${user.status} | ${user.department}`;
  
  if (fullName) user.fullName = fullName;
  if (email) user.email = email;
  if (role) user.role = role;
  if (department) user.department = department;
  if (status) {
    user.status = status;
    if (status === "Active") {
      user.loginAttempts = 0; // reset lock
    }
  }

  db.saveUser(user);
  
  const newVal = `${user.role} | ${user.status} | ${user.department}`;
  logAudit(req.user!.id, req.user!.username, req.user!.role, "Update User Profile", "Users", user.id, oldVal, newVal, req);

  const { passwordHash, ...safeUser } = user;
  res.json(safeUser);
});

app.post("/api/users/:id/reset-password", authenticateToken, requireAdmin, (req: AuthRequest, res) => {
  const { newPassword } = req.body;
  const targetId = req.params.id;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long" });
  }

  const user = db.getUsers().find((u) => u.id === targetId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  user.passwordHash = hashPassword(newPassword);
  user.loginAttempts = 0;
  if (user.status === "Locked") {
    user.status = "Active";
  }
  
  db.saveUser(user);
  logAudit(req.user!.id, req.user!.username, req.user!.role, "Reset User Password", "Users", user.id, "-", "Password Reset Successful", req);

  res.json({ success: true, message: "Password reset successful" });
});


// 3. ROLE MANAGEMENT (Admin Only)
app.get("/api/roles", authenticateToken, requireAdmin, (req, res) => {
  res.json(db.getRoles());
});

app.post("/api/roles", authenticateToken, requireAdmin, (req: AuthRequest, res) => {
  const { name, permissions } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Role name is required" });
  }

  const trimmedName = name.trim();
  const existing = db.getRoles().find(r => r.name.toLowerCase() === trimmedName.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: `Role '${trimmedName}' already exists.` });
  }

  const newRole = {
    id: `role_${Date.now()}`,
    name: trimmedName,
    permissions: permissions || []
  };

  db.saveRole(newRole);
  logAudit(req.user!.id, req.user!.username, req.user!.role, "Create Role", "Roles", newRole.id, "-", newRole.name, req);
  res.status(201).json(newRole);
});

app.put("/api/roles/:id", authenticateToken, requireAdmin, (req: AuthRequest, res) => {
  const { permissions } = req.body;
  const roleId = req.params.id;

  const role = db.getRoles().find((r) => r.id === roleId);
  if (!role) {
    return res.status(404).json({ error: "Role not found" });

app.delete("/api/roles/:id", authenticateToken, requireAdmin, (req: AuthRequest, res) => {
  const { id } = req.params;
  const roles = db.getRoles();
  const index = roles.findIndex((r) => r.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Role not found" });
  }
  
  if (roles[index].name === "Administrator") {
    return res.status(400).json({ error: "Cannot delete the Administrator role" });
  }
  
  const roleName = roles[index].name;
  roles.splice(index, 1);
  db.saveRoles(roles);
  
  if (req.user) {
    logAudit(req.user.id, req.user.username, req.user.role, "Delete Role", "Roles", id, roleName, "-", req);
  }
  
  res.json({ success: true });
});

  }

  const oldVal = role.permissions.join(", ");
  role.permissions = permissions;
  db.saveRole(role);

  logAudit(req.user!.id, req.user!.username, req.user!.role, "Update Role Permissions", "Roles", role.id, oldVal, permissions.join(", "), req);

  res.json(role);
});


// 4. DEPARTMENTS & SUPPLIERS
app.get("/api/departments", authenticateToken, (req, res) => {
  res.json(db.getDepartments());
});

app.get("/api/suppliers", authenticateToken, (req, res) => {
  res.json(db.getSuppliers());
});

app.post("/api/suppliers", authenticateToken, (req: AuthRequest, res) => {
  if (req.user!.role !== "Administrator" && req.user!.role !== "Purchasing Staff") {
    return res.status(403).json({ error: "Access Denied: You do not have permission to create suppliers." });
  }
  const { name, attention, phone, fax, address, category } = req.body;
  if (!name || !attention || !category) {
    return res.status(400).json({ error: "Supplier Name, Attention and Category are required" });
  }

  const trimmedName = name.trim();
  const existing = db.getSuppliers().find(
    s => s.name.toLowerCase() === trimmedName.toLowerCase()
  );
  if (existing) {
    return res.status(400).json({ error: `Supplier '${trimmedName}' already exists.` });
  }

  const existingSuppliers = db.getSuppliers();
  let maxIdNum = 0;
  existingSuppliers.forEach(s => {
    const match = s.id.match(/^[sS]_?(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxIdNum) {
        maxIdNum = num;
      }
    }
  });
  const newId = `s${maxIdNum + 1}`;

  const newSupplier = {
    id: newId,
    name: trimmedName,
    attention,
    phone: phone || "",
    fax: fax || "",
    address: address || "",
    category,
    status: "Active" as const,
    createdAt: new Date().toISOString().split("T")[0],
    created_by: req.user!.fullName || req.user!.username
  };

  db.saveSupplier(newSupplier);
  logAudit(req.user!.id, req.user!.username, req.user!.role, "Create Supplier", "Suppliers", newSupplier.id, "-", `Created: ${name}`, req);

  res.status(201).json(newSupplier);
});

app.put("/api/suppliers/:id", authenticateToken, (req: AuthRequest, res) => {
  if (req.user!.role !== "Administrator" && req.user!.role !== "Purchasing Staff") {
    return res.status(403).json({ error: "Access Denied: You do not have permission to update suppliers." });
  }
  const supplierId = req.params.id;
  const supplier = db.getSuppliers().find((s) => s.id === supplierId);
  if (!supplier) {
    return res.status(404).json({ error: "Supplier not found" });
  }

  const { name, attention, phone, fax, address, category, status } = req.body;
  const oldVal = `${supplier.name} (${supplier.status || "Active"})`;

  if (name && name.trim().toLowerCase() !== supplier.name.toLowerCase()) {
    const trimmedName = name.trim();
    const existing = db.getSuppliers().find(
      s => s.id !== supplierId && s.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (existing) {
      return res.status(400).json({ error: `Supplier '${trimmedName}' already exists.` });
    }
    supplier.name = trimmedName;
  }
  if (attention) supplier.attention = attention;
  if (phone !== undefined) supplier.phone = phone;
  if (fax !== undefined) supplier.fax = fax;
  if (address) supplier.address = address;
  if (category) supplier.category = category;
  if (status) supplier.status = status;

  db.saveSupplier(supplier);
  logAudit(req.user!.id, req.user!.username, req.user!.role, "Update Supplier", "Suppliers", supplier.id, oldVal, `${supplier.name} (${supplier.status || "Active"})`, req);

  res.json(supplier);
});

// Merge duplicate suppliers
app.post("/api/suppliers/merge", authenticateToken, (req: AuthRequest, res) => {
  if (req.user!.role !== "Administrator" && req.user!.role !== "Purchasing Staff") {
    return res.status(403).json({ error: "Access Denied: You do not have permission to merge suppliers." });
  }
  const { sourceId, targetId } = req.body;
  if (!sourceId || !targetId) {
    return res.status(400).json({ error: "Source and Target suppliers are required" });
  }
  const suppliers = db.getSuppliers();
  const source = suppliers.find(s => s.id === sourceId);
  const target = suppliers.find(s => s.id === targetId);
  if (!source || !target) {
    return res.status(404).json({ error: "Source or Target supplier not found" });
  }

  // Update all POs pointing to sourceId to targetId
  const pos = db.getPurchaseOrders();
  let updatedCount = 0;
  pos.forEach(po => {
    if (po.supplierId === sourceId) {
      po.supplierId = targetId;
      po.supplierName = target.name;
      db.savePurchaseOrder(po);
      updatedCount++;
    }
  });

  // Delete source supplier
  db.deleteSupplier(sourceId);

  logAudit(req.user!.id, req.user!.username, req.user!.role, "Merge Supplier", "Suppliers", targetId, source.name, `Merged into: ${target.name} (Updated ${updatedCount} POs)`, req);

  res.json({ success: true, updatedCount });
});

app.delete("/api/suppliers/:id", authenticateToken, (req: AuthRequest, res) => {
  if (req.user!.role !== "Administrator" && req.user!.role !== "Purchasing Staff") {
    return res.status(403).json({ error: "Access Denied: You do not have permission to delete suppliers." });
  }
  const supplierId = req.params.id;
  const supplier = db.getSuppliers().find((s) => s.id === supplierId);
  if (!supplier) {
    return res.status(404).json({ error: "Supplier not found" });
  }

  // Check if there are any purchase orders linked to this supplier
  const linkedPOs = db.getPurchaseOrders().filter(po => po.supplierId === supplierId);
  if (linkedPOs.length > 0) {
    return res.status(400).json({ 
      error: "This supplier is linked to existing Purchase Orders.", 
      poCount: linkedPOs.length 
    });
  }

  db.deleteSupplier(supplierId);
  logAudit(req.user!.id, req.user!.username, req.user!.role, "Delete Supplier", "Suppliers", supplierId, supplier.name, "-", req);

  res.json({ success: true });
});

function getNextPONumber(): string {
  const currentYear = new Date().getFullYear();
  const prefix = `SMEI-${currentYear}-`;
  const records = db.getPurchaseOrders();
  let maxSeq = 0;
  for (const r of records) {
    if (r.poNumber && r.poNumber.startsWith(prefix)) {
      const parts = r.poNumber.split("-");
      const seqStr = parts[parts.length - 1];
      const seq = parseInt(seqStr, 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    } else if (r.poNumber && r.poNumber.startsWith("SMEI-")) {
      const parts = r.poNumber.split("-");
      const seqStr = parts[parts.length - 1];
      const seq = parseInt(seqStr, 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }
  const nextSeq = maxSeq + 1;
  return `${prefix}${nextSeq.toString().padStart(4, "0")}`;
}


// 5. PURCHASE ORDERS (WITH FULL LIFECYCLE, DEPARTMENT & RECORD OWNERSHIP SECURITY)
app.get("/api/pos/next-number", authenticateToken, (req: AuthRequest, res) => {
  res.json({ nextNumber: getNextPONumber() });
});

app.get("/api/pos", authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  let pos = db.getPurchaseOrders();

  // 10. DEPARTMENT RESTRICTIONS
  // Department Heads only see Purchase Orders from their department
  if (user.role === "Department Head") {
    pos = pos.filter((p) => p.department === user.department);
  }

  // 11. RECORD OWNERSHIP SECURITY
  // Purchasing Staff can view all POs but can only EDIT records they created.
  // (We'll enforce edit ownership inside PUT route, here we can return all or filtered if requested)

  res.json(pos);
});

// Helper to validate PO data fields and financial totals arithmetic
function validateAndSanitizePO(poData: any): { error?: string } {
  // 1. Basic field checks
  if (!poData.poNumber || !poData.poNumber.trim()) {
    return { error: "PO Number is required." };
  }
  if (!poData.items || !Array.isArray(poData.items) || poData.items.length === 0) {
    return { error: "Purchase Order must contain at least one line item." };
  }

  // 2. Validate tax category
  const validCategories = ["Vatable", "Zero Rated", "VAT Exempt"];
  if (poData.category && !validCategories.includes(poData.category)) {
    return { error: "Invalid VAT category. Must be Vatable, Zero Rated, or VAT Exempt." };
  }

  // 3. Validate items grid entries
  for (let i = 0; i < poData.items.length; i++) {
    const item = poData.items[i];
    if (!item.description || !item.description.trim()) {
      return { error: `Line item #${i + 1} description is blank.` };
    }
    if (typeof item.quantity !== "number" || item.quantity <= 0) {
      return { error: `Line item #${i + 1} quantity must be greater than zero.` };
    }
    if (typeof item.unitPrice !== "number" || item.unitPrice < 0) {
      return { error: `Line item #${i + 1} unit price cannot be negative.` };
    }
    // Sanitize amount matching qty * unitPrice
    item.amount = Math.round(item.quantity * item.unitPrice * 100) / 100;
  }

  // 4. Validate financial arithmetic
  const submittedVatsSum = (poData.vatableAmount || 0) + (poData.vat12 || 0) + (poData.vatExemptAmount || 0) + (poData.zeroRatedAmount || 0);
  const expectedNetTotal = submittedVatsSum - (poData.partsEwt1 || 0) - (poData.laborEwt2 || 0) - (poData.discountVatAmount || 0);
  
  if (Math.abs((poData.totalAmount || 0) - expectedNetTotal) > 5.0) { // allow small margin for rounding variations
    return { error: `Financial arithmetic validation failed: totalAmount (${poData.totalAmount}) does not match the sum of taxable parts and EWT deductions (${expectedNetTotal.toFixed(2)}).` };
  }

  return {};
}

app.post("/api/pos", authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  
  // Only Purchasing Staff or Admin can create POs
  if (user.role !== "Purchasing Staff" && user.role !== "Administrator") {
    return res.status(403).json({ error: "Only Purchasing Staff can create Purchase Orders." });
  }

  const poData = req.body;
  const supplierNameInput = poData.supplierName || poData.supplierId;
  if (!poData.poNumber || !supplierNameInput || !poData.items || poData.items.length === 0) {
    return res.status(400).json({ error: "PO Number, Supplier and at least one item are required" });
  }

  // Validate PO field data and financial arithmetic
  const validation = validateAndSanitizePO(poData);
  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  // Resolve or create supplier in database
  const resolvedSupplier = resolveOrCreateSupplier(supplierNameInput, user.id);
  poData.supplierId = resolvedSupplier.id;
  poData.supplierName = resolvedSupplier.name;

  // Check for duplicate PO Number
  const duplicate = db.getPurchaseOrders().find(p => p.poNumber.toUpperCase() === poData.poNumber.toUpperCase());
  if (duplicate) {
    return res.status(400).json({ error: `Purchase Order Number '${poData.poNumber}' already exists.` });
  }

  const newPO: PurchaseOrderDB = {
    ...poData,
    id: `po_${Date.now()}`,
    status: poData.status || "Draft", // Respect client-selected status on creation
    created_by: user.id,
    created_department: user.department,
    // If the PO doesn't have a targeted department, default to Purchasing or user department
    department: poData.department || user.department,
    preparedBy: user.fullName,
    preparedByTitle: user.position || "Purchasing Staff",
    updatedAt: new Date().toISOString()
  };

  db.savePurchaseOrder(newPO);
  logAudit(user.id, user.username, user.role, "Create PO", "Purchase Orders", newPO.id, "-", `${newPO.poNumber} (Draft)`, req);

  res.status(201).json(newPO);
});

// Update Purchase Order
app.put("/api/pos/:id", authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const poId = req.params.id;
  const po = db.getPurchaseOrders().find(p => p.id === poId);

  if (!po) {
    return res.status(404).json({ error: "Purchase Order not found" });
  }

  // 11. RECORD OWNERSHIP SECURITY
  // Only authorized roles can edit POs
  if (user.role !== "Administrator" && user.role !== "Purchasing Staff") {
    return res.status(403).json({ error: "Access Denied: You do not have permission to edit Purchase Order details." });
  }

  // Purchasing Staff can edit only records they created, and only in Draft or Rejected status
  if (user.role === "Purchasing Staff") {
    if (po.created_by !== user.id) {
      return res.status(403).json({ error: "Access Denied: You can only edit Purchase Orders created by yourself." });
    }
    if (po.status !== "Draft" && po.status !== "Rejected") {
      return res.status(400).json({ error: `Cannot edit a Purchase Order in '${po.status}' status. It must be Draft or Rejected.` });
    }
  }

  // Administrators can edit any PO (including Approved POs), but non-admins cannot edit Approved POs directly
  if (po.status === "Approved" && user.role !== "Administrator") {
    return res.status(400).json({ error: "Cannot edit an Approved Purchase Order without Administrator authorization." });
  }

  const updateData = req.body;
  const oldVal = po.status;

  // Check for duplicate PO Number
  if (updateData.poNumber && updateData.poNumber.toUpperCase() !== po.poNumber.toUpperCase()) {
    const duplicate = db.getPurchaseOrders().find(p => p.poNumber.toUpperCase() === updateData.poNumber.toUpperCase());
    if (duplicate) {
      return res.status(400).json({ error: `Purchase Order Number '${updateData.poNumber}' already exists.` });
    }
  }

  // Validate PO field data and financial arithmetic for incoming updates
  const validation = validateAndSanitizePO(updateData);
  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  // Resolve or create supplier in database if changed
  if (updateData.supplierName || updateData.supplierId) {
    const supplierNameInput = updateData.supplierName || updateData.supplierId;
    const resolvedSupplier = resolveOrCreateSupplier(supplierNameInput, user.id);
    updateData.supplierId = resolvedSupplier.id;
    updateData.supplierName = resolvedSupplier.name;
  }

  // Merge update data
  Object.assign(po, updateData, {
    id: po.id, // keep ID
    created_by: po.created_by, // keep creator
    created_department: po.created_department, // keep creator department
    updatedAt: new Date().toISOString()
  });

  db.savePurchaseOrder(po);
  logAudit(user.id, user.username, user.role, "Edit PO", "Purchase Orders", po.id, oldVal, po.status, req);

  res.json(po);
});

// Delete Purchase Order (Cancel/Delete draft)
app.delete("/api/pos/:id", authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const poId = req.params.id;
  const po = db.getPurchaseOrders().find(p => p.id === poId);

  if (!po) {
    return res.status(404).json({ error: "Purchase Order not found" });
  }

  // Only Creator (Purchasing Staff) or Admin can delete
  if (user.role !== "Administrator" && user.role !== "Purchasing Staff") {
    return res.status(403).json({ error: "Access Denied: You do not have permission to delete Purchase Orders." });
  }

  if (user.role !== "Administrator" && po.created_by !== user.id) {
    return res.status(403).json({ error: "Access Denied: You cannot delete this Purchase Order." });
  }

  // Non-admins cannot delete in-flight or closed POs
  if (user.role !== "Administrator" && po.status !== "Draft" && po.status !== "Rejected" && po.status !== "Cancelled") {
    return res.status(400).json({ error: `Cannot delete a Purchase Order in '${po.status}' status. It must be Draft, Rejected, or Cancelled.` });
  }

  // Cannot delete Approved POs (all roles)
  if (po.status === "Approved") {
    return res.status(400).json({ error: "Cannot delete an Approved Purchase Order." });
  }

  db.deletePurchaseOrder(poId);
  logAudit(user.id, user.username, user.role, "Delete PO", "Purchase Orders", poId, po.poNumber, "-", req);

  res.json({ success: true });
});

// SMEI Workflow Transition
app.post("/api/pos/:id/workflow", authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const poId = req.params.id;
  const { action, remarks } = req.body; // action: "Submit", "Approve", "Verify", "Final Approve", "Reject", "Return"
  
  const po = db.getPurchaseOrders().find(p => p.id === poId);
  if (!po) {
    return res.status(404).json({ error: "Purchase Order not found" });
  }

  const oldStatus = po.status;
  let newStatus = po.status;

  // 8. SMEI APPROVAL WORKFLOW
  // Draft -> Submitted -> Department Head Review -> Accounting Verification -> Director Approval -> Approved
  // Rejections: any stage -> Rejected (Returned to Purchasing Staff for edit & resubmit)

  switch (action) {
    case "Submit":
      // Only Purchasing Staff (creator) or Admin can submit draft
      if (user.role !== "Purchasing Staff" && user.role !== "Administrator") {
        return res.status(403).json({ error: "Only Purchasing Staff can submit Purchase Orders." });
      }
      if (po.status !== "Draft" && po.status !== "Rejected") {
        return res.status(400).json({ error: "Can only submit a Draft or Rejected PO." });
      }
      newStatus = "Pending Review"; // Submitted for Department Head Review
      
      // Create notification for Department Head
      db.saveNotification({
        id: `n_${Date.now()}`,
        userId: "", // broadcast to role
        role: "Department Head",
        title: "PO Submitted for Review",
        message: `PO ${po.poNumber} submitted by ${user.fullName} requires your department head review.`,
        date: new Date().toISOString().split("T")[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isRead: false,
        poId: po.id
      });
      break;

    case "Approve": // Department Head action
      if (user.role !== "Department Head" && user.role !== "Administrator") {
        return res.status(403).json({ error: "Only Department Heads can approve submitted POs." });
      }
      if (po.status !== "Pending Review") {
        return res.status(400).json({ error: "PO is not awaiting Department Head Review." });
      }
      // Department head must belong to the PO department
      if (user.role === "Department Head" && po.department !== user.department) {
        return res.status(403).json({ error: `You can only review purchase orders from your department: ${user.department}` });
      }

      newStatus = "Pending Verification"; // Approved by Dept Head, sent to Accounting
      po.approved_by = user.id;
      po.checkedBy = user.fullName;
      po.checkedByTitle = user.position || "Department Head";

      // Notify Accounting
      db.saveNotification({
        id: `n_${Date.now()}`,
        userId: "",
        role: "Accounting Staff",
        title: "PO Pending Verification",
        message: `PO ${po.poNumber} has been approved by ${user.fullName} and is ready for Accounting Verification.`,
        date: new Date().toISOString().split("T")[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isRead: false,
        poId: po.id
      });
      break;

    case "Verify": // Accounting action
      if (user.role !== "Accounting Staff" && user.role !== "Administrator") {
        return res.status(403).json({ error: "Only Accounting Staff can verify purchase orders." });
      }
      if (po.status !== "Pending Verification") {
        return res.status(400).json({ error: "PO is not awaiting Accounting Verification." });
      }

      newStatus = "Pending Approval"; // Verified by Accounting, sent to Director
      po.verified_by = user.id;
      po.verifiedBy = user.fullName;
      po.verifiedByTitle = user.position || "Accounting Staff";

      // Notify Director
      db.saveNotification({
        id: `n_${Date.now()}`,
        userId: "",
        role: "Director",
        title: "PO Pending Final Approval",
        message: `PO ${po.poNumber} has been verified by Accounting and is ready for final Director authorization.`,
        date: new Date().toISOString().split("T")[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isRead: false,
        poId: po.id
      });
      break;

    case "Final Approve": // Director action
      if (user.role !== "Director" && user.role !== "Administrator") {
        return res.status(403).json({ error: "Only Directors can issue final approval." });
      }
      if (po.status !== "Pending Approval") {
        return res.status(400).json({ error: "PO is not awaiting Final Director Approval." });
      }

      newStatus = "Approved";
      po.final_approved_by = user.id;
      po.approvedBy = user.fullName;
      po.approvedByTitle = user.position || "Authorized Director";
      po.dateApproved = new Date().toISOString().split("T")[0];
      po.signature = `${user.fullName} Digital Signature`;

      // Notify Purchasing Staff (creator)
      db.saveNotification({
        id: `n_${Date.now()}`,
        userId: po.created_by,
        role: "Purchasing Staff",
        title: "Purchase Order APPROVED",
        message: `Your PO ${po.poNumber} has been given final approval by Director ${user.fullName}.`,
        date: new Date().toISOString().split("T")[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isRead: false,
        poId: po.id
      });
      break;

    case "Reject": // Reject to Draft stage
    case "Return":
      // Valid rejecters: Dept Head, Accounting, Director, Admin
      if (user.role === "Viewer" || user.role === "Purchasing Staff") {
        return res.status(403).json({ error: "You do not have permission to reject/return this Purchase Order." });
      }
      if (po.status === "Approved" || po.status === "Draft") {
        return res.status(400).json({ error: "Cannot reject a Draft or already Approved PO." });
      }

      newStatus = "Rejected"; // Move back to Rejected (which functions as an editable draft)
      
      // Save approval action log
      db.saveApprovalLog({
        id: `app_${Date.now()}`,
        poId: po.id,
        userId: user.id,
        fullName: user.fullName,
        role: user.role,
        action: "Reject",
        remarks: remarks || "Returned for correction",
        timestamp: new Date().toISOString()
      });

      // Notify Purchasing Staff (creator)
      db.saveNotification({
        id: `n_${Date.now()}`,
        userId: po.created_by,
        role: "Purchasing Staff",
        title: "PO Returned/Rejected",
        message: `PO ${po.poNumber} was returned by ${user.fullName} for correction. Reason: ${remarks || "No remarks provided"}`,
        date: new Date().toISOString().split("T")[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isRead: false,
        poId: po.id
      });
      break;

    default:
      return res.status(400).json({ error: "Invalid workflow action" });
  }

  po.status = newStatus;
  po.updatedAt = new Date().toISOString();
  db.savePurchaseOrder(po);

  // Save Approval History Log
  db.saveApprovalLog({
    id: `app_${Date.now()}`,
    poId: po.id,
    userId: user.id,
    fullName: user.fullName,
    role: user.role,
    action: action,
    remarks: remarks || "",
    timestamp: new Date().toISOString()
  });

  logAudit(user.id, user.username, user.role, `${action} PO`, "Purchase Orders", po.id, oldStatus, newStatus, req);

  res.json(po);
});

// Get PO approvals logs
app.get("/api/pos/:id/approvals", authenticateToken, (req, res) => {
  const approvals = db.getApprovals().filter(a => a.poId === req.params.id);
  res.json(approvals);
});


// 6. AUDIT TRAIL LOGS (Admin Only)
app.get("/api/audit-logs", authenticateToken, requireAdmin, (req, res) => {
  res.json(db.getAuditLogs());
});

app.post("/api/audit-logs", authenticateToken, (req: AuthRequest, res) => {
  const { action, module, recordId, oldValue, newValue } = req.body;
  if (!action || !module) {
    return res.status(400).json({ error: "Action and module are required" });
  }
  const user = req.user!;
  logAudit(
    user.id,
    user.username,
    user.role,
    action,
    module,
    recordId || "-",
    oldValue || "-",
    newValue || "-",
    req
  );
  res.json({ success: true });
});


// 7. NOTIFICATIONS
app.get("/api/notifications", authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  let notifs = db.getNotifications();

  // Filter based on role or specific user ID
  notifs = notifs.filter((n) => {
    if (n.userId && n.userId === user.id) return true;
    if (!n.userId && n.role === user.role) return true;
    return false;
  });

  res.json(notifs);
});

app.put("/api/notifications/:id/read", authenticateToken, (req, res) => {
  const notif = db.getNotifications().find(n => n.id === req.params.id);
  if (notif) {
    notif.isRead = true;
    db.saveNotification(notif);
  }
  res.json({ success: true });
});

app.put("/api/notifications/read-all", authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const notifs = db.getNotifications().filter(n => {
    if (n.userId && n.userId === user.id) return true;
    if (!n.userId && n.role === user.role) return true;
    return false;
  });

  notifs.forEach(n => {
    n.isRead = true;
    db.saveNotification(n);
  });

  res.json({ success: true });
});


// ============================================================================
//               OPERATIONS MODULES (PIS, RFS, CANVASS SHEET)
// ============================================================================

// Auto-generation helpers
function getNextPISNumber(): string {
  const yearStr = new Date().getFullYear().toString().slice(-2); // "26"
  const prefix = `PURC-PIS-${yearStr}-`;
  const records = db.getPaymentInstructionSlips();
  let maxSeq = 0;
  for (const r of records) {
    if (r.pisNumber && r.pisNumber.startsWith(prefix)) {
      const parts = r.pisNumber.split("-");
      const seqStr = parts[parts.length - 1];
      const seq = parseInt(seqStr, 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }
  const nextSeq = maxSeq + 1;
  return `${prefix}${nextSeq.toString().padStart(3, "0")}`;
}

function getNextRFSNumber(): string {
  const date = new Date();
  const yyyy = date.getFullYear().toString();
  const mm = (date.getMonth() + 1).toString().padStart(2, "0");
  const prefix = `${yyyy}-${mm}-`;
  const records = db.getRequestsForSupply();
  let maxSeq = 0;
  for (const r of records) {
    if (r.rfsNumber && r.rfsNumber.startsWith(prefix)) {
      const parts = r.rfsNumber.split("-");
      const seqStr = parts[parts.length - 1];
      const seq = parseInt(seqStr, 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }
  const nextSeq = maxSeq + 1;
  return `${prefix}${nextSeq.toString().padStart(3, "0")}`;
}

function getNextCanvassNumber(): string {
  const records = db.getCanvassSheets();
  let maxSeq = 0;
  for (const r of records) {
    if (r.canvassNumber) {
      const seq = parseInt(r.canvassNumber, 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }
  const nextSeq = maxSeq + 1;
  return nextSeq.toString().padStart(5, "0");
}

// 1. PAYMENT INSTRUCTION SLIP (PIS) ROUTES
app.get("/api/pis", authenticateToken, (req: AuthRequest, res) => {
  res.json(db.getPaymentInstructionSlips());
});

app.get("/api/pis/next-number", authenticateToken, (req: AuthRequest, res) => {
  res.json({ nextNumber: getNextPISNumber() });
});

app.get("/api/pis/:id", authenticateToken, (req: AuthRequest, res) => {
  const item = db.getPaymentInstructionSlips().find(p => p.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Payment Instruction Slip not found" });
  res.json(item);
});

app.post("/api/pis", authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  if (user.role !== "Administrator" && user.role !== "Purchasing Staff") {
    return res.status(403).json({ error: "Access Denied: Only Purchasing Staff or Admin can create Payment Instruction Slips." });
  }

  const data = req.body;
  if (!data.pisNumber) {
    data.pisNumber = getNextPISNumber();
  }

  // Validate format PURC-PIS-YY-###
  const pisFormat = /^PURC-PIS-\d{2}-\d{3}$/;
  if (!pisFormat.test(data.pisNumber)) {
    return res.status(400).json({ error: "Invalid PIS Number format. Expected: PURC-PIS-YY-### (e.g. PURC-PIS-26-001)" });
  }

  // Check duplicate PIS number
  const duplicate = db.getPaymentInstructionSlips().find(p => p.pisNumber.toUpperCase() === data.pisNumber.toUpperCase());
  if (duplicate) {
    return res.status(400).json({ error: `Payment Instruction Slip Number '${data.pisNumber}' already exists.` });
  }

  // Validate fields
  if (!data.payee || data.amount === undefined || !data.scheduleDate) {
    return res.status(400).json({ error: "Payee, Amount, and Schedule Date are required." });
  }
  if (Number(data.amount) < 0) {
    return res.status(400).json({ error: "Amount cannot be negative." });
  }

  const newPIS = {
    ...data,
    id: `pis_${Date.now()}`,
    status: data.status || "Draft",
    created_by: user.id,
    created_department: user.department,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.savePaymentInstructionSlip(newPIS);
  logAudit(user.id, user.username, user.role, "Create Payment Instruction Slip", "PIS", newPIS.id, "-", newPIS.pisNumber, req);
  res.status(201).json(newPIS);
});

app.put("/api/pis/:id", authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  if (user.role !== "Administrator" && user.role !== "Purchasing Staff") {
    return res.status(403).json({ error: "Access Denied: Only Purchasing Staff or Admin can edit Payment Instruction Slips." });
  }

  const existing = db.getPaymentInstructionSlips().find(p => p.id === req.params.id);
  if (!existing) return res.status(404).json({ error: "Payment Instruction Slip not found" });

  const data = req.body;
  if (data.pisNumber && data.pisNumber.toUpperCase() !== existing.pisNumber.toUpperCase()) {
    // Validate format
    const pisFormat = /^PURC-PIS-\d{2}-\d{3}$/;
    if (!pisFormat.test(data.pisNumber)) {
      return res.status(400).json({ error: "Invalid PIS Number format. Expected: PURC-PIS-YY-###" });
    }
    // Check duplicate
    const duplicate = db.getPaymentInstructionSlips().find(p => p.id !== req.params.id && p.pisNumber.toUpperCase() === data.pisNumber.toUpperCase());
    if (duplicate) {
      return res.status(400).json({ error: `PIS Number '${data.pisNumber}' already exists.` });
    }
  }

  if (data.amount !== undefined && Number(data.amount) < 0) {
    return res.status(400).json({ error: "Amount cannot be negative." });
  }

  const updatedPIS = {
    ...existing,
    ...data,
    updatedAt: new Date().toISOString()
  };

  db.savePaymentInstructionSlip(updatedPIS);
  logAudit(user.id, user.username, user.role, "Update Payment Instruction Slip", "PIS", updatedPIS.id, existing.pisNumber, updatedPIS.pisNumber, req);
  res.json(updatedPIS);
});

app.delete("/api/pis/:id", authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  if (user.role !== "Administrator" && user.role !== "Purchasing Staff") {
    return res.status(403).json({ error: "Access Denied: Only Purchasing Staff or Admin can delete Payment Instruction Slips." });
  }

  const existing = db.getPaymentInstructionSlips().find(p => p.id === req.params.id);
  if (!existing) return res.status(404).json({ error: "Payment Instruction Slip not found" });

  db.deletePaymentInstructionSlip(req.params.id);
  logAudit(user.id, user.username, user.role, "Delete Payment Instruction Slip", "PIS", req.params.id, existing.pisNumber, "-", req);
  res.json({ success: true });
});

// 2. REQUEST FOR SUPPLY (RFS) ROUTES
app.get("/api/rfs", authenticateToken, (req: AuthRequest, res) => {
  res.json(db.getRequestsForSupply());
});

app.get("/api/rfs/next-number", authenticateToken, (req: AuthRequest, res) => {
  res.json({ nextNumber: getNextRFSNumber() });
});

app.get("/api/rfs/:id", authenticateToken, (req: AuthRequest, res) => {
  const item = db.getRequestsForSupply().find(r => r.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Request for Supply not found" });
  res.json(item);
});

app.post("/api/rfs", authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  if (user.role !== "Administrator" && user.role !== "Purchasing Staff") {
    return res.status(403).json({ error: "Access Denied: Only Purchasing Staff or Admin can create Requests for Supply." });
  }

  const data = req.body;
  if (!data.rfsNumber) {
    data.rfsNumber = getNextRFSNumber();
  }

  // Validate format YYYY-MM-###
  const rfsFormat = /^\d{4}-\d{2}-\d{3}$/;
  if (!rfsFormat.test(data.rfsNumber)) {
    return res.status(400).json({ error: "Invalid RFS Number format. Expected: YYYY-MM-### (e.g. 2026-07-001)" });
  }

  // Check duplicate
  const duplicate = db.getRequestsForSupply().find(r => r.rfsNumber.toUpperCase() === data.rfsNumber.toUpperCase());
  if (duplicate) {
    return res.status(400).json({ error: `RFS Number '${data.rfsNumber}' already exists.` });
  }

  // Validate items
  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
    return res.status(400).json({ error: "RFS must contain at least one line item." });
  }
  for (let i = 0; i < data.items.length; i++) {
    const it = data.items[i];
    if (!it.description || !it.description.trim()) {
      return res.status(400).json({ error: `Line item #${i + 1} description is required.` });
    }
    if (it.quantity === undefined || Number(it.quantity) <= 0) {
      return res.status(400).json({ error: `Line item #${i + 1} quantity must be greater than zero.` });
    }
  }

  const newRFS = {
    ...data,
    id: `rfs_${Date.now()}`,
    status: data.status || "Incomplete",
    created_by: user.id,
    created_department: user.department,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.saveRequestForSupply(newRFS);
  logAudit(user.id, user.username, user.role, "Create Request for Supply", "RFS", newRFS.id, "-", newRFS.rfsNumber, req);
  res.status(201).json(newRFS);
});

app.put("/api/rfs/:id", authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const roles = db.getRoles();
  const userRole = roles.find(r => r.name === user.role);
  const hasApproveRfs = userRole?.permissions.includes("approve_rfs");

  if (user.role !== "Administrator" && user.role !== "Purchasing Staff" && !hasApproveRfs) {
    return res.status(403).json({ error: "Access Denied: Only Purchasing Staff, Admin, or users with RFS Approval permission can edit/approve Requests for Supply." });
  }

  const existing = db.getRequestsForSupply().find(r => r.id === req.params.id);
  if (!existing) return res.status(404).json({ error: "Request for Supply not found" });

  const data = req.body;
  if (data.rfsNumber && data.rfsNumber.toUpperCase() !== existing.rfsNumber.toUpperCase()) {
    // Validate format
    const rfsFormat = /^\d{4}-\d{2}-\d{3}$/;
    if (!rfsFormat.test(data.rfsNumber)) {
      return res.status(400).json({ error: "Invalid RFS Number format. Expected: YYYY-MM-###" });
    }
    // Check duplicate
    const duplicate = db.getRequestsForSupply().find(r => r.id !== req.params.id && r.rfsNumber.toUpperCase() === data.rfsNumber.toUpperCase());
    if (duplicate) {
      return res.status(400).json({ error: `RFS Number '${data.rfsNumber}' already exists.` });
    }
  }

  // Validate items if present
  if (data.items) {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      return res.status(400).json({ error: "RFS must contain at least one line item." });
    }
    for (let i = 0; i < data.items.length; i++) {
      const it = data.items[i];
      if (!it.description || !it.description.trim()) {
        return res.status(400).json({ error: `Line item #${i + 1} description is required.` });
      }
      if (it.quantity === undefined || Number(it.quantity) <= 0) {
        return res.status(400).json({ error: `Line item #${i + 1} quantity must be greater than zero.` });
      }
    }
  }

  const updatedRFS = {
    ...existing,
    ...data,
    updatedAt: new Date().toISOString()
  };

  db.saveRequestForSupply(updatedRFS);
  logAudit(user.id, user.username, user.role, "Update Request for Supply", "RFS", updatedRFS.id, existing.rfsNumber, updatedRFS.rfsNumber, req);
  res.json(updatedRFS);
});

app.delete("/api/rfs/:id", authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  if (user.role !== "Administrator" && user.role !== "Purchasing Staff") {
    return res.status(403).json({ error: "Access Denied: Only Purchasing Staff or Admin can delete Requests for Supply." });
  }

  const existing = db.getRequestsForSupply().find(r => r.id === req.params.id);
  if (!existing) return res.status(404).json({ error: "Request for Supply not found" });

  db.deleteRequestForSupply(req.params.id);
  logAudit(user.id, user.username, user.role, "Delete Request for Supply", "RFS", req.params.id, existing.rfsNumber, "-", req);
  res.json({ success: true });
});

// 3. CANVASS SHEET ROUTES
app.get("/api/canvass", authenticateToken, (req: AuthRequest, res) => {
  res.json(db.getCanvassSheets());
});

app.get("/api/canvass/next-number", authenticateToken, (req: AuthRequest, res) => {
  res.json({ nextNumber: getNextCanvassNumber() });
});

app.get("/api/canvass/:id", authenticateToken, (req: AuthRequest, res) => {
  const item = db.getCanvassSheets().find(c => c.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Canvass Sheet not found" });
  res.json(item);
});

app.post("/api/canvass", authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  if (user.role !== "Administrator" && user.role !== "Purchasing Staff") {
    return res.status(403).json({ error: "Access Denied: Only Purchasing Staff or Admin can create Canvass Sheets." });
  }

  const data = req.body;
  if (!data.canvassNumber) {
    data.canvassNumber = getNextCanvassNumber();
  }

  // Validate format 00001
  const canvFormat = /^\d{5}$/;
  if (!canvFormat.test(data.canvassNumber)) {
    return res.status(400).json({ error: "Invalid Canvass Number format. Expected: 5-digit sequential number (e.g. 00001)" });
  }

  // Check duplicate
  const duplicate = db.getCanvassSheets().find(c => c.canvassNumber.toUpperCase() === data.canvassNumber.toUpperCase());
  if (duplicate) {
    return res.status(400).json({ error: `Canvass Sheet Number '${data.canvassNumber}' already exists.` });
  }

  // Validate items
  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
    return res.status(400).json({ error: "Canvass Sheet must contain at least one item." });
  }
  for (let i = 0; i < data.items.length; i++) {
    const it = data.items[i];
    if (!it.item || !it.item.trim()) {
      return res.status(400).json({ error: `Item #${i + 1} name is required.` });
    }
    if (it.quantity === undefined || Number(it.quantity) <= 0) {
      return res.status(400).json({ error: `Item #${i + 1} quantity must be greater than zero.` });
    }
  }

  const newCanvass = {
    ...data,
    id: `canv_${Date.now()}`,
    created_by: user.id,
    created_department: user.department,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.saveCanvassSheet(newCanvass);
  logAudit(user.id, user.username, user.role, "Create Canvass Sheet", "Canvass", newCanvass.id, "-", newCanvass.canvassNumber, req);
  res.status(201).json(newCanvass);
});

app.put("/api/canvass/:id", authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  if (user.role !== "Administrator" && user.role !== "Purchasing Staff") {
    return res.status(403).json({ error: "Access Denied: Only Purchasing Staff or Admin can edit Canvass Sheets." });
  }

  const existing = db.getCanvassSheets().find(c => c.id === req.params.id);
  if (!existing) return res.status(404).json({ error: "Canvass Sheet not found" });

  const data = req.body;
  if (data.canvassNumber && data.canvassNumber.toUpperCase() !== existing.canvassNumber.toUpperCase()) {
    // Validate format
    const canvFormat = /^\d{5}$/;
    if (!canvFormat.test(data.canvassNumber)) {
      return res.status(400).json({ error: "Invalid Canvass Number format. Expected: 5-digit sequential number (e.g. 00001)" });
    }
    // Check duplicate
    const duplicate = db.getCanvassSheets().find(c => c.id !== req.params.id && c.canvassNumber.toUpperCase() === data.canvassNumber.toUpperCase());
    if (duplicate) {
      return res.status(400).json({ error: `Canvass Sheet Number '${data.canvassNumber}' already exists.` });
    }
  }

  // Validate items if present
  if (data.items) {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      return res.status(400).json({ error: "Canvass Sheet must contain at least one item." });
    }
    for (let i = 0; i < data.items.length; i++) {
      const it = data.items[i];
      if (!it.item || !it.item.trim()) {
        return res.status(400).json({ error: `Item #${i + 1} name is required.` });
      }
      if (it.quantity === undefined || Number(it.quantity) <= 0) {
        return res.status(400).json({ error: `Item #${i + 1} quantity must be greater than zero.` });
      }
    }
  }

  const updatedCanvass = {
    ...existing,
    ...data,
    updatedAt: new Date().toISOString()
  };

  db.saveCanvassSheet(updatedCanvass);
  logAudit(user.id, user.username, user.role, "Update Canvass Sheet", "Canvass", updatedCanvass.id, existing.canvassNumber, updatedCanvass.canvassNumber, req);
  res.json(updatedCanvass);
});

app.delete("/api/canvass/:id", authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  if (user.role !== "Administrator" && user.role !== "Purchasing Staff") {
    return res.status(403).json({ error: "Access Denied: Only Purchasing Staff or Admin can delete Canvass Sheets." });
  }

  const existing = db.getCanvassSheets().find(c => c.id === req.params.id);
  if (!existing) return res.status(404).json({ error: "Canvass Sheet not found" });

  db.deleteCanvassSheet(req.params.id);
  logAudit(user.id, user.username, user.role, "Delete Canvass Sheet", "Canvass", req.params.id, existing.canvassNumber, "-", req);
  res.json({ success: true });
});


// ---------------- VITE MIDDLEWARE SETUP & BOOTSTRAP ----------------

async function bootstrap() {
  const isProd = process.env.NODE_ENV === "production" || 
                 (process.argv[1] && (process.argv[1].endsWith(".cjs") || process.argv[1].includes("dist")));

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      setHeaders: (res, filepath) => {
        if (filepath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        }
      }
    }));
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("Critical server boot error:", err);
});
