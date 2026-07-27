/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, Supplier, PurchaseOrder, AuditLog, Notification, POStatus, POItem, UserRole, PaymentInstructionSlip, RequestForSupply, CanvassSheet } from "../types";

const TOKEN_KEY = "smei_jwt_token";

let activeRefreshPromise: Promise<{ user: User; token?: string }> | null = null;

// Get token from local storage
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

// Set token in local storage
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

// Remove token from local storage
export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Generic Fetch Wrapper
async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  const impersonatedRole = localStorage.getItem("smei_impersonated_role");
  if (impersonatedRole) {
    headers.set("X-Impersonate-Role", impersonatedRole);
  }

  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(endpoint, {
    ...options,
    headers
  });

  if (response.status === 401 || response.status === 403) {
    // If token is invalid or expired, clear and force reload/logout
    const errData = await response.json().catch(() => ({}));
    if (token) {
      removeToken();
      window.dispatchEvent(new Event("auth-expired"));
    }
    throw new Error(errData.error || "Session expired or unauthorized access.");
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Auth
  async login(username: string, password: string): Promise<{ token: string; user: User }> {
    const data = await apiFetch<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    setToken(data.token);
    return data;
  },

  async logout(): Promise<void> {
    try {
      await apiFetch<void>("/api/auth/logout", { method: "POST" });
    } catch (e) {
      // Ignore network errors on logout
    } finally {
      removeToken();
    }
  },

  async getCurrentUser(): Promise<{ user: User; token?: string }> {
    if (activeRefreshPromise) {
      return activeRefreshPromise;
    }
    
    activeRefreshPromise = apiFetch<{ user: User; token?: string }>("/api/auth/me")
      .then((data) => {
        if (data.token) {
          setToken(data.token);
        }
        activeRefreshPromise = null;
        return data;
      })
      .catch((err) => {
        activeRefreshPromise = null;
        throw err;
      });
      
    return activeRefreshPromise;
  },

  // Users Management (Admin Only)
  async getUsers(): Promise<User[]> {
    return apiFetch<User[]>("/api/users");
  },

  async createUser(userData: Partial<User> & { password?: string }): Promise<User> {
    return apiFetch<User>("/api/users", {
      method: "POST",
      body: JSON.stringify(userData)
    });
  },

  async updateUser(id: string, userData: Partial<User> & { status?: string }): Promise<User> {
    return apiFetch<User>(`/api/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(userData)
    });
  },

  async resetPassword(id: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return apiFetch<{ success: boolean; message: string }>(`/api/users/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ newPassword })
    });
  },

  // Roles & Permissions (Admin Only)
  async getRoles(): Promise<Array<{ id: string; name: string; permissions: string[] }>> {
    return apiFetch<Array<{ id: string; name: string; permissions: string[] }>>("/api/roles");
  },

  async createRole(name: string, permissions: string[] = []): Promise<{ id: string; name: string; permissions: string[] }> {
    return apiFetch<{ id: string; name: string; permissions: string[] }>("/api/roles", {
      method: "POST",
      body: JSON.stringify({ name, permissions })
    });
  },

  async updateRolePermissions(id: string, permissions: string[]): Promise<{ id: string; name: string; permissions: string[] }> {
    return apiFetch<{ id: string; name: string; permissions: string[] }>(`/api/roles/${id}`, {
      method: "PUT",
      body: JSON.stringify({ permissions })
    });
  },

  async deleteRole(id: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/api/roles/${id}`, {
      method: "DELETE"
    });
  },

  // Departments
  async getDepartments(): Promise<Array<{ id: string; name: string }>> {
    return apiFetch<Array<{ id: string; name: string }>>("/api/departments");
  },

  // Suppliers
  async getSuppliers(): Promise<Supplier[]> {
    return apiFetch<Supplier[]>("/api/suppliers");
  },

  async createSupplier(supplierData: Partial<Supplier>): Promise<Supplier> {
    return apiFetch<Supplier>("/api/suppliers", {
      method: "POST",
      body: JSON.stringify(supplierData)
    });
  },

  async updateSupplier(id: string, supplierData: Partial<Supplier>): Promise<Supplier> {
    return apiFetch<Supplier>(`/api/suppliers/${id}`, {
      method: "PUT",
      body: JSON.stringify(supplierData)
    });
  },

  async deleteSupplier(id: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/api/suppliers/${id}`, {
      method: "DELETE"
    });
  },

  async mergeSuppliers(sourceId: string, targetId: string): Promise<{ success: boolean; updatedCount: number }> {
    return apiFetch<{ success: boolean; updatedCount: number }>("/api/suppliers/merge", {
      method: "POST",
      body: JSON.stringify({ sourceId, targetId })
    });
  },

  // Purchase Orders
  async getPOs(): Promise<PurchaseOrder[]> {
    return apiFetch<PurchaseOrder[]>("/api/pos");
  },

  async getNextPONumber(): Promise<{ nextNumber: string }> {
    return apiFetch<{ nextNumber: string }>("/api/pos/next-number");
  },

  async createPO(poData: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    return apiFetch<PurchaseOrder>("/api/pos", {
      method: "POST",
      body: JSON.stringify(poData)
    });
  },

  async updatePO(id: string, poData: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    return apiFetch<PurchaseOrder>(`/api/pos/${id}`, {
      method: "PUT",
      body: JSON.stringify(poData)
    });
  },

  async deletePO(id: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/api/pos/${id}`, {
      method: "DELETE"
    });
  },

  // Workflow State-Machine Transactions
  async triggerWorkflow(id: string, action: string, remarks?: string): Promise<PurchaseOrder> {
    return apiFetch<PurchaseOrder>(`/api/pos/${id}/workflow`, {
      method: "POST",
      body: JSON.stringify({ action, remarks })
    });
  },

  async getPOApprovals(id: string): Promise<Array<{
    id: string;
    poId: string;
    userId: string;
    fullName: string;
    role: string;
    action: string;
    remarks?: string;
    timestamp: string;
  }>> {
    return apiFetch<Array<{
      id: string;
      poId: string;
      userId: string;
      fullName: string;
      role: string;
      action: string;
      remarks?: string;
      timestamp: string;
    }>>(`/api/pos/${id}/approvals`);
  },

  // Audit logs (Admin Only)
  async getAuditLogs(): Promise<AuditLog[]> {
    const logs = await apiFetch<any[]>("/api/audit-logs");
    // Adapt backend timestamp/browser fields to frontend types if needed
    return logs.map((l) => ({
      id: l.id,
      userId: l.user_id,
      username: l.username,
      role: l.role,
      action: l.action,
      date: l.timestamp ? l.timestamp.split("T")[0] : "",
      time: l.timestamp ? new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "",
      oldValue: l.old_value,
      newValue: l.new_value,
      ipAddress: l.ip_address,
      timestamp: l.timestamp
    }));
  },

  // Notifications
  async getNotifications(): Promise<Notification[]> {
    return apiFetch<Notification[]>("/api/notifications");
  },

  async readNotification(id: string): Promise<void> {
    return apiFetch<void>(`/api/notifications/${id}/read`, { method: "PUT" });
  },

  async readAllNotifications(): Promise<void> {
    return apiFetch<void>("/api/notifications/read-all", { method: "PUT" });
  },

  // User Profile
  async updateProfile(profileData: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string;
    department?: string;
    position?: string;
    username?: string;
    notificationPreferences?: { email: boolean; system: boolean };
    currentPassword?: string;
    newPassword?: string;
  }): Promise<{ success: boolean; user: User }> {
    return apiFetch<{ success: boolean; user: User }>("/api/users/profile", {
      method: "PUT",
      body: JSON.stringify(profileData)
    });
  },

  async updateAvatar(avatarData: string | null): Promise<{ success: boolean; avatarUrl?: string; profile_image?: string }> {
    return apiFetch<{ success: boolean; avatarUrl?: string; profile_image?: string }>("/api/users/profile/avatar", {
      method: "PUT",
      body: JSON.stringify({ avatarData })
    });
  },

  // Secure User invitations and verification
  async generateInvitation(inviteConfig: {
    role: string;
    department: string;
    expiresIn: string;
    isOneTime: boolean;
  }): Promise<{ token: string }> {
    return apiFetch<{ token: string }>("/api/users/invite", {
      method: "POST",
      body: JSON.stringify(inviteConfig)
    });
  },

  async getInvitation(token: string): Promise<{ valid: boolean; role: string; department: string }> {
    return apiFetch<{ valid: boolean; role: string; department: string }>(`/api/auth/invitation/${token}`);
  },

  async registerUser(registerData: {
    token: string;
    username: string;
    password?: string;
    fullName: string;
  }): Promise<{ token: string; user: User }> {
    const data = await apiFetch<{ token: string; user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(registerData)
    });
    setToken(data.token);
    return data;
  },

  async registerPublicUser(registerData: {
    username: string;
    password?: string;
    fullName: string;
    department: string;
  }): Promise<{ message: string }> {
    return apiFetch<{ message: string }>("/api/auth/register-public", {
      method: "POST",
      body: JSON.stringify(registerData)
    });
  },

  // Payment Instruction Slips (PIS)
  async getPIS(): Promise<PaymentInstructionSlip[]> {
    return apiFetch<PaymentInstructionSlip[]>("/api/pis");
  },
  async getNextPISNumber(): Promise<{ nextNumber: string }> {
    return apiFetch<{ nextNumber: string }>("/api/pis/next-number");
  },
  async createPIS(pisData: Partial<PaymentInstructionSlip>): Promise<PaymentInstructionSlip> {
    return apiFetch<PaymentInstructionSlip>("/api/pis", {
      method: "POST",
      body: JSON.stringify(pisData)
    });
  },
  async updatePIS(id: string, pisData: Partial<PaymentInstructionSlip>): Promise<PaymentInstructionSlip> {
    return apiFetch<PaymentInstructionSlip>(`/api/pis/${id}`, {
      method: "PUT",
      body: JSON.stringify(pisData)
    });
  },
  async deletePIS(id: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/api/pis/${id}`, {
      method: "DELETE"
    });
  },

  // Request for Supply (RFS)
  async getRFS(): Promise<RequestForSupply[]> {
    return apiFetch<RequestForSupply[]>("/api/rfs");
  },
  async getNextRFSNumber(): Promise<{ nextNumber: string }> {
    return apiFetch<{ nextNumber: string }>("/api/rfs/next-number");
  },
  async createRFS(rfsData: Partial<RequestForSupply>): Promise<RequestForSupply> {
    return apiFetch<RequestForSupply>("/api/rfs", {
      method: "POST",
      body: JSON.stringify(rfsData)
    });
  },
  async updateRFS(id: string, rfsData: Partial<RequestForSupply>): Promise<RequestForSupply> {
    return apiFetch<RequestForSupply>(`/api/rfs/${id}`, {
      method: "PUT",
      body: JSON.stringify(rfsData)
    });
  },
  async deleteRFS(id: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/api/rfs/${id}`, {
      method: "DELETE"
    });
  },

  // Canvass Sheets
  async getCanvass(): Promise<CanvassSheet[]> {
    return apiFetch<CanvassSheet[]>("/api/canvass");
  },
  async getNextCanvassNumber(): Promise<{ nextNumber: string }> {
    return apiFetch<{ nextNumber: string }>("/api/canvass/next-number");
  },
  async createCanvass(canvData: Partial<CanvassSheet>): Promise<CanvassSheet> {
    return apiFetch<CanvassSheet>("/api/canvass", {
      method: "POST",
      body: JSON.stringify(canvData)
    });
  },
  async updateCanvass(id: string, canvData: Partial<CanvassSheet>): Promise<CanvassSheet> {
    return apiFetch<CanvassSheet>(`/api/canvass/${id}`, {
      method: "PUT",
      body: JSON.stringify(canvData)
    });
  },
  async deleteCanvass(id: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/api/canvass/${id}`, {
      method: "DELETE"
    });
  }
};
