/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { PaymentInstructionSlip, RequestForSupply, CanvassSheet } from "../types.js";

export type PaymentInstructionSlipDB = PaymentInstructionSlip;
export type RequestForSupplyDB = RequestForSupply;
export type CanvassSheetDB = CanvassSheet;

// Password Hash Helper (using native Node crypto SHA-256)
export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export interface UserDB {
  id: string;
  username: string;
  passwordHash: string;
  fullName: string;
  email: string;
  role: string;
  department: string;
  status: "Active" | "Disabled" | "Locked" | "Pending";
  avatarUrl?: string;
  loginAttempts?: number;
  profile_image?: string;
  phone_number?: string;
  position?: string;
  notificationPreferences?: {
    email: boolean;
    system: boolean;
  };
}

export interface RoleDB {
  id: string;
  name: string;
  permissions: string[];
}

export interface DepartmentDB {
  id: string;
  name: string;
}

export interface SupplierDB {
  id: string;
  name: string;
  supplier_name?: string;
  attention: string;
  phone: string;
  fax: string;
  address: string;
  category: string;
  createdAt: string;
  created_at?: string;
  created_by?: string;
  status?: "Active" | "Disabled";
}

export interface POItemDB {
  id: string;
  quantity: number;
  unit: string;
  description: string;
  unitPrice: number;
  amount: number;
}

export interface PurchaseOrderDB {
  id: string;
  poNumber: string;
  poDate: string;
  deliveryDate: string;
  supplierId: string;
  supplierName: string;
  attention: string;
  telNo: string;
  faxNo: string;
  purpose: string;
  category: string;
  items: POItemDB[];
  
  // Tax & VAT Calculations
  vatableAmount: number;
  vat12: number;
  vatExemptAmount: number;
  zeroRatedAmount: number;
  grossAmount: number;
  discountVatAmount: number;
  partsEwt1: number;
  laborEwt2: number;
  ewtType?: string;
  ewtPercentage?: number;
  partsEwtPercentage?: number;
  laborEwtPercentage?: number;
  totalAmount: number;
  
  // Terms
  paymentTerms: string;
  workDuration: string;
  warranty: string;
  remarks: string;
  
  // Ownership & Approval Flow
  created_by: string;           // user ID of creator
  created_department: string;   // creator's department
  department: string;           // PO target department
  approved_by?: string;         // Dept head user ID
  verified_by?: string;         // Accounting user ID
  final_approved_by?: string;   // Director user ID
  
  preparedBy: string;
  preparedByTitle?: string;
  checkedBy?: string;
  checkedByTitle?: string;
  verifiedBy?: string;
  verifiedByTitle?: string;
  verifiedBy2?: string;
  verifiedBy2Title?: string;
  approvedBy?: string;
  approvedByTitle?: string;
  conforme?: string;
  conformeTitle?: string;
  
  additionalSignatories?: any[]; // using any for simplicity in DB schema for now
  
  signature?: string;
  dateApproved?: string;
  status: string;
  currencySymbol?: string;
  updatedAt: string;
}

export interface ApprovalLogDB {
  id: string;
  poId: string;
  userId: string;
  fullName: string;
  role: string;
  action: "Submit" | "Approve" | "Verify" | "Final Approve" | "Reject" | "Return";
  remarks?: string;
  timestamp: string;
}

export interface NotificationDB {
  id: string;
  userId: string;
  role: string;
  title: string;
  message: string;
  date: string;
  time: string;
  isRead: boolean;
  poId?: string;
}

export interface AuditLogDB {
  id: string;
  user_id: string;
  username: string;
  role: string;
  action: string;
  module: string;
  record_id: string;
  old_value: string;
  new_value: string;
  ip_address: string;
  browser: string;
  timestamp: string;
}

export interface InvitationDB {
  token: string;
  role: string;
  department: string;
  expiresAt: string;
  isOneTime: boolean;
  used: boolean;
}

export interface DBStructure {
  users: UserDB[];
  roles: RoleDB[];
  departments: DepartmentDB[];
  suppliers: SupplierDB[];
  purchase_orders: PurchaseOrderDB[];
  approvals: ApprovalLogDB[];
  notifications: NotificationDB[];
  audit_logs: AuditLogDB[];
  invitations?: InvitationDB[];
  payment_instruction_slips?: PaymentInstructionSlipDB[];
  requests_for_supply?: RequestForSupplyDB[];
  canvass_sheets?: CanvassSheetDB[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

class Database {
  private data: DBStructure;

  constructor() {
    this.data = {
      users: [],
      roles: [],
      departments: [],
      suppliers: [],
      purchase_orders: [],
      approvals: [],
      notifications: [],
      audit_logs: [],
      invitations: [],
      payment_instruction_slips: [],
      requests_for_supply: [],
      canvass_sheets: []
    };
    this.init();
  }

  private init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        this.data = JSON.parse(raw);
        // Ensure all tables exist in loaded JSON
        if (!this.data.users) this.data.users = [];
        if (!this.data.roles) this.data.roles = [];
        if (!this.data.departments) this.data.departments = [];
        if (!this.data.suppliers) this.data.suppliers = [];
        this.data.suppliers = this.data.suppliers.map(s => ({
          ...s,
          status: s.status || "Active",
          created_by: s.created_by || "System Seed"
        }));
        if (!this.data.purchase_orders) this.data.purchase_orders = [];
        if (!this.data.approvals) this.data.approvals = [];
        if (!this.data.notifications) this.data.notifications = [];
        if (!this.data.audit_logs) this.data.audit_logs = [];
        if (!this.data.invitations) this.data.invitations = [];
        if (!this.data.payment_instruction_slips) this.data.payment_instruction_slips = [];
        if (!this.data.requests_for_supply) this.data.requests_for_supply = [];
        if (!this.data.canvass_sheets) this.data.canvass_sheets = [];

        // Force the admin's password to be "123!" and active status for user convenience
        const adminUser = this.data.users.find(u => u.username.toLowerCase() === "admin");
        if (adminUser) {
          adminUser.passwordHash = hashPassword("123!");
          adminUser.status = "Active";
          adminUser.loginAttempts = 0;
          this.save();
        }
      } catch (err) {
        console.error("Error reading database file, resetting to seed data:", err);
        this.seed();
      }
    } else {
      this.seed();
    }
  }

  private save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (err) {
      console.error("Error writing to database file:", err);
    }
  }

  private seed() {
    console.log("Seeding Database...");

    // Seed Departments
    const departments: DepartmentDB[] = [
      { id: "d1", name: "Purchasing" },
      { id: "d2", name: "Accounting" },
      { id: "d3", name: "Operations" },
      { id: "d4", name: "Production" },
      { id: "d5", name: "Warehouse" },
      { id: "d6", name: "Management" },
      { id: "d7", name: "HR" },
      { id: "d8", name: "IT" }
    ];

    // Seed Roles & Permissions
    const roles: RoleDB[] = [
      {
        id: "r1",
        name: "Administrator",
        permissions: ["view_dashboard", "manage_users", "manage_roles", "view_all_pos", "view_audit_logs", "view_suppliers", "manage_suppliers"]
      },
      {
        id: "r2",
        name: "Purchasing Staff",
        permissions: ["view_dashboard", "create_po", "edit_own_po", "submit_po", "view_all_pos", "view_suppliers", "import_excel", "export_excel"]
      },
      {
        id: "r3",
        name: "Department Head",
        permissions: ["view_dashboard", "review_po", "approve_po", "view_dept_pos"]
      },
      {
        id: "r4",
        name: "Accounting Staff",
        permissions: ["view_dashboard", "verify_po", "view_all_pos", "view_suppliers"]
      },
      {
        id: "r5",
        name: "Director",
        permissions: ["view_dashboard", "final_approve_po", "view_all_pos"]
      },
      {
        id: "r6",
        name: "Viewer",
        permissions: ["view_dashboard", "view_all_pos"]
      }
    ];

    // Seed Users (Default Passwords: Username + "123")
    const users: UserDB[] = [
      {
        id: "u1",
        username: "admin",
        passwordHash: hashPassword("123!"),
        fullName: "John Doe",
        email: "admin@southcoastmetal.com",
        role: "Administrator",
        department: "Management",
        status: "Active",
        avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
      }
    ];

    // Seed Suppliers
    const suppliers: SupplierDB[] = [
      {
        id: "s1",
        name: "Cavite Metal Casting Corp.",
        attention: "Mr. Arthur Alcantara",
        phone: "+63-46-437-1234",
        fax: "+63-46-437-5678",
        address: "Block 5, Phase 2, CEZ, Rosario, Cavite",
        category: "Raw Metals",
        createdAt: "2026-01-15",
        status: "Active",
        created_by: "System Seed"
      },
      {
        id: "s2",
        name: "Rosario Steel Works Inc.",
        attention: "Ms. Sarah Jingco",
        phone: "+63-46-437-8899",
        fax: "+63-46-437-8800",
        address: "Lot 12, Phase 1, CEZ, Rosario, Cavite",
        category: "Steel Plates & Rods",
        createdAt: "2026-02-10",
        status: "Active",
        created_by: "System Seed"
      },
      {
        id: "s3",
        name: "Fastener World Philippines",
        attention: "Mr. Jose Rizal Jr.",
        phone: "+63-2-812-3456",
        fax: "+63-2-812-3457",
        address: "142 Pasong Tamo Ext., Makati City",
        category: "Hardware Supplies",
        createdAt: "2026-03-05",
        status: "Active",
        created_by: "System Seed"
      },
      {
        id: "s4",
        name: "Tri-State Industrial Gases",
        attention: "Mr. Henry Sy Jr.",
        phone: "+63-46-484-9000",
        fax: "+63-46-484-9001",
        address: "Anabu II-E, Imus, Cavite",
        category: "Gases & Chemicals",
        createdAt: "2026-04-12",
        status: "Active",
        created_by: "System Seed"
      },
      {
        id: "s5",
        name: "Zenith Machinery & Calibration",
        attention: "Engr. Paul Peralta",
        phone: "+63-46-501-1111",
        fax: "+63-46-501-2222",
        address: "Tejero, General Trias, Cavite",
        category: "Machinery Repair & Services",
        createdAt: "2026-05-20",
        status: "Active",
        created_by: "System Seed"
      }
    ];

    // Seed Purchase Orders
    const purchase_orders: PurchaseOrderDB[] = [];

    // Seed Approvals History
    const approvals: ApprovalLogDB[] = [];

    // Seed Notifications
    const notifications: NotificationDB[] = [];

    // Seed Audit Logs
    const audit_logs: AuditLogDB[] = [];

    this.data = {
      users,
      roles,
      departments,
      suppliers,
      purchase_orders,
      approvals,
      notifications,
      audit_logs
    };

    this.save();
  }

  // Generic helpers
  public getUsers(): UserDB[] {
    return this.data.users;
  }

  public saveUser(user: UserDB) {
    const idx = this.data.users.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      this.data.users[idx] = user;
    } else {
      this.data.users.push(user);
    }
    this.save();
  }

  public deleteUser(id: string) {
    this.data.users = this.data.users.filter((u) => u.id !== id);
    this.save();
  }

  public getRoles(): RoleDB[] {
    return this.data.roles;
  }

  public saveRole(role: RoleDB) {
    const idx = this.data.roles.findIndex((r) => r.id === role.id);
    if (idx >= 0) {
      this.data.roles[idx] = role;
    } else {
      this.data.roles.push(role);
    }
    this.save();
  }

  public saveRoles(roles: RoleDB[]) {
    this.data.roles = roles;
    this.save();
  }

  public deleteRole(id: string) {
    this.data.roles = this.data.roles.filter((r) => r.id !== id);
    this.save();
  }

  public getDepartments(): DepartmentDB[] {
    return this.data.departments;
  }

  public getSuppliers(): SupplierDB[] {
    return this.data.suppliers;
  }

  public saveSupplier(supplier: SupplierDB) {
    const idx = this.data.suppliers.findIndex((s) => s.id === supplier.id);
    if (idx >= 0) {
      this.data.suppliers[idx] = supplier;
    } else {
      this.data.suppliers.push(supplier);
    }
    this.save();
  }

  public deleteSupplier(id: string) {
    this.data.suppliers = this.data.suppliers.filter((s) => s.id !== id);
    this.save();
  }

  public getPurchaseOrders(): PurchaseOrderDB[] {
    return this.data.purchase_orders;
  }

  public savePurchaseOrder(po: PurchaseOrderDB) {
    const idx = this.data.purchase_orders.findIndex((p) => p.id === po.id);
    if (idx >= 0) {
      this.data.purchase_orders[idx] = po;
    } else {
      this.data.purchase_orders.push(po);
    }
    this.save();
  }

  public deletePurchaseOrder(id: string) {
    this.data.purchase_orders = this.data.purchase_orders.filter((p) => p.id !== id);
    this.save();
  }

  public getApprovals(): ApprovalLogDB[] {
    return this.data.approvals;
  }

  public saveApprovalLog(log: ApprovalLogDB) {
    this.data.approvals.push(log);
    this.save();
  }

  public getNotifications(): NotificationDB[] {
    return this.data.notifications;
  }

  public saveNotification(notif: NotificationDB) {
    const idx = this.data.notifications.findIndex((n) => n.id === notif.id);
    if (idx >= 0) {
      this.data.notifications[idx] = notif;
    } else {
      this.data.notifications.push(notif);
    }
    this.save();
  }

  public deleteNotification(id: string) {
    this.data.notifications = this.data.notifications.filter((n) => n.id !== id);
    this.save();
  }

  public getAuditLogs(): AuditLogDB[] {
    return this.data.audit_logs;
  }

  public saveAuditLog(log: AuditLogDB) {
    this.data.audit_logs.push(log);
    this.save();
  }

  public getInvitations(): InvitationDB[] {
    if (!this.data.invitations) this.data.invitations = [];
    return this.data.invitations;
  }

  public saveInvitation(invite: InvitationDB) {
    if (!this.data.invitations) this.data.invitations = [];
    const idx = this.data.invitations.findIndex((i) => i.token === invite.token);
    if (idx >= 0) {
      this.data.invitations[idx] = invite;
    } else {
      this.data.invitations.push(invite);
    }
    this.save();
  }

  // Payment Instruction Slips (PIS) getters/setters/deleters
  public getPaymentInstructionSlips(): PaymentInstructionSlipDB[] {
    if (!this.data.payment_instruction_slips) this.data.payment_instruction_slips = [];
    return this.data.payment_instruction_slips;
  }

  public savePaymentInstructionSlip(pis: PaymentInstructionSlipDB) {
    if (!this.data.payment_instruction_slips) this.data.payment_instruction_slips = [];
    const idx = this.data.payment_instruction_slips.findIndex((p) => p.id === pis.id);
    if (idx >= 0) {
      this.data.payment_instruction_slips[idx] = pis;
    } else {
      this.data.payment_instruction_slips.push(pis);
    }
    this.save();
  }

  public deletePaymentInstructionSlip(id: string) {
    if (!this.data.payment_instruction_slips) this.data.payment_instruction_slips = [];
    this.data.payment_instruction_slips = this.data.payment_instruction_slips.filter((p) => p.id !== id);
    this.save();
  }

  // Request for Supply (RFS) getters/setters/deleters
  public getRequestsForSupply(): RequestForSupplyDB[] {
    if (!this.data.requests_for_supply) this.data.requests_for_supply = [];
    return this.data.requests_for_supply;
  }

  public saveRequestForSupply(rfs: RequestForSupplyDB) {
    if (!this.data.requests_for_supply) this.data.requests_for_supply = [];
    const idx = this.data.requests_for_supply.findIndex((r) => r.id === rfs.id);
    if (idx >= 0) {
      this.data.requests_for_supply[idx] = rfs;
    } else {
      this.data.requests_for_supply.push(rfs);
    }
    this.save();
  }

  public deleteRequestForSupply(id: string) {
    if (!this.data.requests_for_supply) this.data.requests_for_supply = [];
    this.data.requests_for_supply = this.data.requests_for_supply.filter((r) => r.id !== id);
    this.save();
  }

  // Canvass Sheet getters/setters/deleters
  public getCanvassSheets(): CanvassSheetDB[] {
    if (!this.data.canvass_sheets) this.data.canvass_sheets = [];
    return this.data.canvass_sheets;
  }

  public saveCanvassSheet(canvass: CanvassSheetDB) {
    if (!this.data.canvass_sheets) this.data.canvass_sheets = [];
    const idx = this.data.canvass_sheets.findIndex((c) => c.id === canvass.id);
    if (idx >= 0) {
      this.data.canvass_sheets[idx] = canvass;
    } else {
      this.data.canvass_sheets.push(canvass);
    }
    this.save();
  }

  public deleteCanvassSheet(id: string) {
    if (!this.data.canvass_sheets) this.data.canvass_sheets = [];
    this.data.canvass_sheets = this.data.canvass_sheets.filter((c) => c.id !== id);
    this.save();
  }
}

export const db = new Database();
