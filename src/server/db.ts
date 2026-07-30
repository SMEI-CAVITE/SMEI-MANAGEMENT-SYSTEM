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
  password?: string;
  fullName: string;
  email: string;
  role: string;
  department: string;
  status: "Active" | "Disabled" | "Locked" | "Pending";
  employeeId?: string;
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
  portal?: string;
  module?: string;
  priority?: string;
  workflowId?: string;
  userId: string;
  role: string;
  title: string;
  message: string;
  date: string;
  time: string;
  isRead: boolean;
  poId?: string;
  documentType?: string;
  documentId?: string;
  documentNumber?: string;
  status?: string;
  eventType?: string;
  createdAt?: string;
  readAt?: string;
  createdBy?: string;
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
  employee_sequence?: number;
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
  monitoring_file_registry?: any[];
  monitoring_operations_log?: any[];
  monitoring_snapshots?: any[];
  monitoring_settings?: any;
}

// TEMPORARY COMPATIBILITY SUPPORT FOR VERCEL
// Vercel serverless functions have a read-only filesystem except for /tmp.
// This is a temporary patch to prevent crashes while migrating modules to Firebase.
// Data stored in /tmp will be lost between invocations.
const isVercel = process.env.VERCEL === "1";
const DATA_DIR = isVercel ? path.join("/tmp", "data") : path.join(process.cwd(), "data");
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
        if (this.data.requests_for_supply.length === 0) {
          this.data.requests_for_supply = [
            {
              id: "rfs-001",
              rfsNumber: "2026-07-001",
              dateRequested: "2026-07-15",
              dueDate: "2026-07-30",
              department: "Purchasing",
              controlNumber: "SMEI-RFS-2026-001",
              purchaseOrderNumber: "SMEI-2026-0001",
              items: [
                {
                  id: "item-1",
                  quantity: 10,
                  unit: "pcs",
                  description: "STRUCTURAL STEEL REINFORCEMENT SUPPORT GIRDERS",
                  lastPurchaseDate: "2026-01-10",
                  lastPurchaseQuantity: 10,
                  lastPurchaseUnitPrice: 5000,
                  currentPurchaseDate: "2026-07-15",
                  currentPurchaseQuantity: 10,
                  currentPurchaseUnitPrice: 5200,
                  remarks: "Standard stock"
                }
              ],
              status: "Complete",
              approvalStatus: "Approved",
              modeOfRequest: "Regular",
              purpose: "STRUCTURAL STEEL REINFORCEMENT SUPPORT GIRDERS",
              requestedBy: "VICEDO, Lalaine",
              verifiedBy: "ORONGAN, Eliza C.",
              approvedBy: "Agnes C. Vallejo",
              approvedByName: "Agnes C. Vallejo",
              approvedAt: "2026-07-16T10:00:00.000Z",
              created_by: "Purchasing Staff",
              createdAt: "2026-07-15T08:00:00.000Z",
              updatedAt: "2026-07-16T10:00:00.000Z"
            },
            {
              id: "rfs-002",
              rfsNumber: "2026-07-002",
              dateRequested: "2026-07-20",
              dueDate: "2026-08-05",
              department: "Production",
              controlNumber: "SMEI-RFS-2026-002",
              purchaseOrderNumber: "",
              items: [
                {
                  id: "item-2",
                  quantity: 50,
                  unit: "kgs",
                  description: "STAINLESS STEEL WELDING RODS 3.2MM E308L-16",
                  lastPurchaseDate: "2026-03-01",
                  lastPurchaseQuantity: 30,
                  lastPurchaseUnitPrice: 450,
                  currentPurchaseDate: "2026-07-20",
                  currentPurchaseQuantity: 50,
                  currentPurchaseUnitPrice: 480,
                  remarks: "Urgent replenishment"
                }
              ],
              status: "Complete",
              approvalStatus: "Approved",
              modeOfRequest: "Urgent",
              purpose: "PRODUCTION WELDING CONSUMABLES REPLENISHMENT",
              requestedBy: "ROGADOR, Aprilyn",
              verifiedBy: "ORONGAN, Eliza C.",
              approvedBy: "Agnes C. Vallejo",
              approvedByName: "Agnes C. Vallejo",
              approvedAt: "2026-07-21T09:30:00.000Z",
              created_by: "Department Head",
              createdAt: "2026-07-20T08:00:00.000Z",
              updatedAt: "2026-07-21T09:30:00.000Z"
            }
          ];
        }
        if (!this.data.canvass_sheets) this.data.canvass_sheets = [];

        // Ensure user employeeIds are migrated and normalized to SMEI-EMPLOYEE-### format
        let maxExistingSeq = 0;
        let unassignedIndex = 1;
        this.data.users.forEach((u) => {
          if (!u.employeeId || !u.employeeId.startsWith("SMEI-EMPLOYEE-")) {
            if (u.username.toLowerCase() === "admin" || u.id === "u1") {
              u.employeeId = "SMEI-EMPLOYEE-001";
            } else {
              while (this.data.users.some(other => other.employeeId === `SMEI-EMPLOYEE-${String(unassignedIndex).padStart(3, '0')}`)) {
                unassignedIndex++;
              }
              u.employeeId = `SMEI-EMPLOYEE-${String(unassignedIndex).padStart(3, '0')}`;
              unassignedIndex++;
            }
          }
          if (u.employeeId) {
            const match = u.employeeId.match(/\d+/);
            if (match) {
              const num = parseInt(match[0], 10);
              if (!isNaN(num) && num > maxExistingSeq) {
                maxExistingSeq = num;
              }
            }
          }
        });

        if (this.data.employee_sequence === undefined || this.data.employee_sequence < maxExistingSeq) {
          this.data.employee_sequence = maxExistingSeq;
        }

        // Force the admin's password to be "123!" and active status for user convenience
        const adminUser = this.data.users.find(u => u.username.toLowerCase() === "admin");
        if (adminUser) {
          adminUser.passwordHash = hashPassword("123!");
          adminUser.status = "Active";
          adminUser.loginAttempts = 0;
        }
        this.save();
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
        permissions: ["view_dashboard", "create_po", "edit_own_po", "submit_po", "view_all_pos", "view_suppliers"]
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
        employeeId: "SMEI-EMPLOYEE-001",
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
    const notifications: NotificationDB[] = [
      {
        id: "notif_tsd_seed_1",
        portal: "TSD",
        module: "control-no",
        priority: "MEDIUM",
        userId: "",
        role: "Administrator",
        title: "Control Number Created",
        message: "Control Number CA-01-0001-26 generated for Inbound Manifest #1002.",
        date: new Date().toISOString().split("T")[0],
        time: "09:00 AM",
        isRead: false,
        status: "ACTIVE",
        eventType: "INFO",
        createdAt: new Date().toISOString()
      },
      {
        id: "notif_tsd_seed_2",
        portal: "TSD",
        module: "unloading-loading",
        priority: "MEDIUM",
        userId: "",
        role: "Administrator",
        title: "Unloading / Loading Completed",
        message: "Unloading/Loading session verified for Control No: CA-01-0001-26.",
        date: new Date().toISOString().split("T")[0],
        time: "10:30 AM",
        isRead: false,
        status: "ACTIVE",
        eventType: "INFO",
        createdAt: new Date().toISOString()
      },
      {
        id: "notif_tsd_seed_3",
        portal: "TSD",
        module: "hazardous-waste",
        priority: "HIGH",
        userId: "",
        role: "Administrator",
        title: "Hazardous Waste Processing Completed",
        message: "Hazardous waste catalog breakdown completed for Control No: CA-01-0001-26.",
        date: new Date().toISOString().split("T")[0],
        time: "01:15 PM",
        isRead: false,
        status: "ACTIVE",
        eventType: "INFO",
        createdAt: new Date().toISOString()
      }
    ];

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

  public previewNextEmployeeId(): string {
    let maxSeq = this.data.employee_sequence || 0;
    this.data.users.forEach((u) => {
      if (u.employeeId) {
        const match = u.employeeId.match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    });

    let nextSeq = maxSeq + 1;
    let candidate = `SMEI-EMPLOYEE-${String(nextSeq).padStart(3, '0')}`;
    while (this.data.users.some((u) => u.employeeId === candidate)) {
      nextSeq++;
      candidate = `SMEI-EMPLOYEE-${String(nextSeq).padStart(3, '0')}`;
    }
    return candidate;
  }

  public getNextEmployeeId(): string {
    let maxSeq = this.data.employee_sequence || 0;
    this.data.users.forEach((u) => {
      if (u.employeeId) {
        const match = u.employeeId.match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    });

    let nextSeq = maxSeq + 1;
    let candidate = `SMEI-EMPLOYEE-${String(nextSeq).padStart(3, '0')}`;
    while (this.data.users.some((u) => u.employeeId === candidate)) {
      nextSeq++;
      candidate = `SMEI-EMPLOYEE-${String(nextSeq).padStart(3, '0')}`;
    }

    this.data.employee_sequence = nextSeq;
    this.save();
    return candidate;
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

  // ==========================================
  // SYSTEM RESOURCE & STORAGE MONITORING METHODS
  // ==========================================

  public getMonitoringFiles(): any[] {
    if (!this.data.monitoring_file_registry) this.data.monitoring_file_registry = [];
    return this.data.monitoring_file_registry;
  }

  public saveMonitoringFile(fileRecord: any) {
    if (!this.data.monitoring_file_registry) this.data.monitoring_file_registry = [];
    const idx = this.data.monitoring_file_registry.findIndex((f) => f.id === fileRecord.id);
    if (idx >= 0) {
      this.data.monitoring_file_registry[idx] = {
        ...this.data.monitoring_file_registry[idx],
        ...fileRecord,
        updatedAt: new Date().toISOString()
      };
    } else {
      this.data.monitoring_file_registry.push({
        ...fileRecord,
        createdAt: fileRecord.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    this.save();
  }

  public bulkSyncMonitoringFiles(files: any[]) {
    if (!this.data.monitoring_file_registry) this.data.monitoring_file_registry = [];
    
    files.forEach((f) => {
      const idx = this.data.monitoring_file_registry!.findIndex((existing) => existing.id === f.id);
      if (idx >= 0) {
        this.data.monitoring_file_registry![idx] = {
          ...this.data.monitoring_file_registry![idx],
          ...f,
          updatedAt: new Date().toISOString()
        };
      } else {
        this.data.monitoring_file_registry!.push({
          ...f,
          createdAt: f.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    });

    this.save();
  }

  public deleteMonitoringFile(id: string) {
    if (!this.data.monitoring_file_registry) this.data.monitoring_file_registry = [];
    const record = this.data.monitoring_file_registry.find((f) => f.id === id);
    if (record) {
      record.status = "DELETED";
      record.updatedAt = new Date().toISOString();
      this.save();
    }
  }

  public logDatabaseOperation(portal: string, moduleName: string, operation: "READ" | "CREATE" | "UPDATE" | "DELETE", count: number = 1) {
    if (!this.data.monitoring_operations_log) this.data.monitoring_operations_log = [];
    const today = new Date().toISOString().split("T")[0];
    
    // Aggregate by day, portal, module, operation to keep data lightweight
    const existing = this.data.monitoring_operations_log.find(
      (log) => log.date === today && log.portal === portal && log.module === moduleName && log.operation === operation
    );

    if (existing) {
      existing.count = (existing.count || 0) + count;
      existing.timestamp = new Date().toISOString();
    } else {
      this.data.monitoring_operations_log.push({
        id: `OP-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        date: today,
        timestamp: new Date().toISOString(),
        portal,
        module: moduleName,
        operation,
        count
      });
    }

    this.save();
  }

  public getMonitoringOperations(date?: string): any[] {
    if (!this.data.monitoring_operations_log) this.data.monitoring_operations_log = [];
    if (date) {
      return this.data.monitoring_operations_log.filter((log) => log.date === date);
    }
    return this.data.monitoring_operations_log;
  }

  public getMonitoringSnapshots(): any[] {
    if (!this.data.monitoring_snapshots) this.data.monitoring_snapshots = [];
    return this.data.monitoring_snapshots;
  }

  public createMonitoringSnapshot(snapshot: any) {
    if (!this.data.monitoring_snapshots) this.data.monitoring_snapshots = [];
    const today = snapshot.date || new Date().toISOString().split("T")[0];
    const idx = this.data.monitoring_snapshots.findIndex((s) => s.date === today);
    if (idx >= 0) {
      this.data.monitoring_snapshots[idx] = { ...snapshot, date: today, timestamp: new Date().toISOString() };
    } else {
      this.data.monitoring_snapshots.push({ ...snapshot, date: today, timestamp: new Date().toISOString() });
    }
    this.save();
  }

  public getMonitoringSettings(): any {
    if (!this.data.monitoring_settings) {
      this.data.monitoring_settings = {
        storageLimitBytes: 5368709120, // 5 GB
        warningThresholdPct: 70,
        criticalThresholdPct: 85,
        extremeThresholdPct: 95
      };
      this.save();
    }
    return this.data.monitoring_settings;
  }

  public saveMonitoringSettings(settings: any) {
    this.data.monitoring_settings = {
      ...this.getMonitoringSettings(),
      ...settings
    };
    this.save();
  }
}

let dbInstance: Database | null = null;

export function getDatabase(): Database {
  if (!dbInstance) {
    dbInstance = new Database();
  }
  return dbInstance;
}
