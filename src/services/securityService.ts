/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, UserRole } from "../types";

export interface PinProtectionRule {
  id: string;
  moduleName: string;
  actionName: string;
  pinCode: string;
  isEnabled: boolean;
}

export interface SecurityConfig {
  enabled: boolean;
}

// Centralized Module Registry with canonical IDs and aliases
export interface ModuleDefinition {
  id: string;
  name: string;
  aliases: string[];
}

export const MODULE_REGISTRY: Record<string, ModuleDefinition> = {
  PO_APPROVAL: {
    id: "po_approval_gate",
    name: "PO Approval",
    aliases: ["po_approval_gate", "po_approval", "PO Approval", "PO_APPROVAL"]
  },
  PIS_APPROVAL: {
    id: "pis_approval_gate",
    name: "PIS Approval",
    aliases: ["pis_approval_gate", "pis_approval", "PIS Approval", "PIS_APPROVAL"]
  },
  RFS_APPROVAL: {
    id: "rfs_approval_gate",
    name: "RFS Approval",
    aliases: ["rfs_approval_gate", "rfs_approval", "RFS Approval", "RFS_APPROVAL"]
  },
  CANVASS_APPROVAL: {
    id: "canvass_approval_gate",
    name: "Canvass Approval",
    aliases: ["canvass_approval_gate", "canvass_approval", "Canvass Approval", "CANVASS_APPROVAL"]
  },
  PURCHASE_ORDER: {
    id: "po_status_change",
    name: "Purchase Order",
    aliases: ["po_status_change", "po", "Purchase Order", "PO", "purchase_order"]
  },
  PAYMENT_INSTRUCTION_SLIP: {
    id: "pis_access",
    name: "Payment Instruction Slip",
    aliases: ["pis_access", "pis", "Payment Instruction Slip", "PIS", "payment_instruction_slip"]
  },
  REQUEST_FOR_SUPPLY: {
    id: "rfs_access",
    name: "Request For Supply",
    aliases: ["rfs_access", "rfs", "Request For Supply", "RFS", "request_for_supply"]
  },
  CANVASS_SHEET: {
    id: "canvass_access",
    name: "Canvass Sheet",
    aliases: ["canvass_access", "canvass", "Canvass Sheet", "CANVASS", "canvass_sheet"]
  },
  PROCUREMENT_APPROVAL: {
    id: "procurement_approval_access",
    name: "Procurement Approval",
    aliases: ["procurement_approval_access", "procurement_approval", "Procurement Approval", "PROCUREMENT_APPROVAL"]
  }
};

export const DEFAULT_PIN_RULES: PinProtectionRule[] = [
  { id: "po_approval_gate", moduleName: "PO Approval", actionName: "Access PO Approval Workspace", pinCode: "1234", isEnabled: true },
  { id: "pis_approval_gate", moduleName: "PIS Approval", actionName: "Access PIS Approval Workspace", pinCode: "5678", isEnabled: true },
  { id: "rfs_approval_gate", moduleName: "RFS Approval", actionName: "Access RFS Approval Workspace", pinCode: "9012", isEnabled: true },
  { id: "canvass_approval_gate", moduleName: "Canvass Approval", actionName: "Access Canvass Approval Workspace", pinCode: "3456", isEnabled: true },
  { id: "po_status_change", moduleName: "Purchase Order", actionName: "Access Purchase Orders", pinCode: "1111", isEnabled: true },
  { id: "pis_access", moduleName: "Payment Instruction Slip", actionName: "Access Payment Instruction Slip", pinCode: "2222", isEnabled: true },
  { id: "rfs_access", moduleName: "Request For Supply", actionName: "Access Request For Supply", pinCode: "3333", isEnabled: true },
  { id: "canvass_access", moduleName: "Canvass Sheet", actionName: "Access Canvass Sheets", pinCode: "4444", isEnabled: true }
];

export interface ISecurityRepository {
  getGlobalSecurityEnabled(): boolean;
  setGlobalSecurityEnabled(enabled: boolean): void;
  getModuleRules(): PinProtectionRule[];
  saveModuleRules(rules: PinProtectionRule[]): void;
  isModuleUnlockedInSession(ruleId: string): boolean;
  unlockModuleInSession(ruleId: string): void;
  clearAllUnlockSessions(): void;
}

class LocalStorageSecurityRepository implements ISecurityRepository {
  private STORAGE_KEY_CONFIG = "smei_security_config";
  private STORAGE_KEY_RULES = "smei_module_pins";
  private UNLOCK_PREFIX = "smei_unlocked_";

  getGlobalSecurityEnabled(): boolean {
    try {
      const savedSetting = localStorage.getItem(this.STORAGE_KEY_CONFIG);
      if (savedSetting === null) {
        // FAIL CLOSED: Default to true if not explicitly configured
        return true;
      }
      const parsed = JSON.parse(savedSetting);
      return parsed.enabled !== false;
    } catch (e) {
      console.error("[SecurityRepository] Error reading global security config, failing closed:", e);
      return true; // Fail closed
    }
  }

  setGlobalSecurityEnabled(enabled: boolean): void {
    try {
      localStorage.setItem(this.STORAGE_KEY_CONFIG, JSON.stringify({ enabled }));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {
      console.error("[SecurityRepository] Error saving global security config:", e);
    }
  }

  getModuleRules(): PinProtectionRule[] {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY_RULES);
      if (saved) {
        let rules: PinProtectionRule[] = JSON.parse(saved);
        let updated = false;

        // Ensure all default rules exist and repair any legacy enabled:false defaults
        DEFAULT_PIN_RULES.forEach((defRule) => {
          const existingIdx = rules.findIndex(r => r.id === defRule.id || r.moduleName === defRule.moduleName);
          if (existingIdx === -1) {
            rules.push(defRule);
            updated = true;
          } else if (rules[existingIdx].isEnabled === false && (defRule.id === "po_status_change" || defRule.id === "pis_access" || defRule.id === "rfs_access" || defRule.id === "canvass_access")) {
            // Repair legacy defect where default main module rules were initialized as isEnabled: false
            rules[existingIdx].isEnabled = true;
            updated = true;
          }
        });

        if (updated) {
          localStorage.setItem(this.STORAGE_KEY_RULES, JSON.stringify(rules));
        }
        return rules;
      }
    } catch (e) {
      console.error("[SecurityRepository] Error reading module rules, falling back to defaults:", e);
    }

    // Default fallback
    try {
      localStorage.setItem(this.STORAGE_KEY_RULES, JSON.stringify(DEFAULT_PIN_RULES));
    } catch (e) {}
    return DEFAULT_PIN_RULES;
  }

  saveModuleRules(rules: PinProtectionRule[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY_RULES, JSON.stringify(rules));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {
      console.error("[SecurityRepository] Error saving module rules:", e);
    }
  }

  isModuleUnlockedInSession(ruleId: string): boolean {
    try {
      const unlockKey = `${this.UNLOCK_PREFIX}${ruleId}`;
      if (sessionStorage.getItem(unlockKey) === "true") {
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  unlockModuleInSession(ruleId: string): void {
    try {
      const unlockKey = `${this.UNLOCK_PREFIX}${ruleId}`;
      sessionStorage.setItem(unlockKey, "true");
      window.dispatchEvent(new Event("storage"));
    } catch (e) {
      console.error("[SecurityRepository] Error unlocking module session:", e);
    }
  }

  clearAllUnlockSessions(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.startsWith("smei_unlocked_") || key.startsWith("smei_session_"))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => sessionStorage.removeItem(k));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {
      console.error("[SecurityRepository] Error clearing unlock sessions:", e);
    }
  }
}

class SecurityServiceClass {
  private repository: ISecurityRepository;

  constructor(repository: ISecurityRepository) {
    this.repository = repository;
  }

  public getRepository(): ISecurityRepository {
    return this.repository;
  }

  public getGlobalSecurityEnabled(): boolean {
    return this.repository.getGlobalSecurityEnabled();
  }

  public setGlobalSecurityEnabled(enabled: boolean): void {
    this.repository.setGlobalSecurityEnabled(enabled);
  }

  public getModuleRules(): PinProtectionRule[] {
    return this.repository.getModuleRules();
  }

  public saveModuleRules(rules: PinProtectionRule[]): void {
    this.repository.saveModuleRules(rules);
  }

  public resolveRuleId(inputKeyOrName: string): string {
    if (!inputKeyOrName) return "po_status_change";
    const trimmed = inputKeyOrName.trim();
    
    for (const def of Object.values(MODULE_REGISTRY)) {
      if (
        def.id === trimmed ||
        def.name.toLowerCase() === trimmed.toLowerCase() ||
        def.aliases.some(a => a.toLowerCase() === trimmed.toLowerCase())
      ) {
        return def.id;
      }
    }
    return trimmed;
  }

  public resolveModuleName(inputKeyOrName: string): string {
    if (!inputKeyOrName) return "Purchase Order";
    const trimmed = inputKeyOrName.trim();
    for (const def of Object.values(MODULE_REGISTRY)) {
      if (
        def.id === trimmed ||
        def.name.toLowerCase() === trimmed.toLowerCase() ||
        def.aliases.some(a => a.toLowerCase() === trimmed.toLowerCase())
      ) {
        return def.name;
      }
    }
    return trimmed;
  }

  public isAdmin(user: User | null | undefined): boolean {
    if (!user) return false;
    return user.role === UserRole.Administrator;
  }

  public isPINRequired(
    inputKeyOrName: string,
    user: User | null | undefined
  ): { required: boolean; rule: PinProtectionRule | null; unlocked: boolean; ruleId: string; moduleName: string } {
    const ruleId = this.resolveRuleId(inputKeyOrName);
    const moduleName = this.resolveModuleName(inputKeyOrName);

    // 1. Administrator ALWAYS bypasses PIN challenges
    if (this.isAdmin(user)) {
      return { required: false, rule: null, unlocked: true, ruleId, moduleName };
    }

    // 2. Global Security Switch Check (Fail Closed)
    const globalEnabled = this.repository.getGlobalSecurityEnabled();
    if (!globalEnabled) {
      return { required: false, rule: null, unlocked: true, ruleId, moduleName };
    }

    // 3. Find specific rule
    const rules = this.repository.getModuleRules();
    let rule = rules.find(r => r.id === ruleId);
    if (!rule) {
      rule = rules.find(r => r.moduleName === moduleName || r.moduleName.toLowerCase() === inputKeyOrName.toLowerCase());
    }

    // If no rule found, generate fallback default rule with isEnabled = true (Fail Closed)
    if (!rule) {
      let defaultPin = "1234";
      if (ruleId.includes("pis")) defaultPin = "5678";
      else if (ruleId.includes("rfs")) defaultPin = "9012";
      else if (ruleId.includes("canvass")) defaultPin = "3456";

      rule = {
        id: ruleId,
        moduleName: moduleName,
        actionName: `Access ${moduleName}`,
        pinCode: defaultPin,
        isEnabled: true
      };
    }

    // 4. Check if rule itself is explicitly disabled
    if (rule.isEnabled === false) {
      return { required: false, rule, unlocked: true, ruleId, moduleName };
    }

    // 5. Check if unlocked in current session specifically for this ruleId
    const unlocked = this.repository.isModuleUnlockedInSession(rule.id);
    return {
      required: !unlocked,
      rule,
      unlocked,
      ruleId: rule.id,
      moduleName: rule.moduleName
    };
  }

  public verifyAndUnlock(
    inputKeyOrName: string,
    inputPin: string,
    user: User | null | undefined
  ): { success: boolean; error?: string } {
    const check = this.isPINRequired(inputKeyOrName, user);

    if (!check.required) {
      return { success: true };
    }

    if (!check.rule) {
      return { success: false, error: "Security rule configuration missing." };
    }

    if (inputPin.trim() === check.rule.pinCode) {
      this.repository.unlockModuleInSession(check.rule.id);
      return { success: true };
    }

    return { success: false, error: "Invalid Administrative PIN code. Please try again." };
  }

  public clearAllSessions(): void {
    this.repository.clearAllUnlockSessions();
  }
}

export const SecurityService = new SecurityServiceClass(new LocalStorageSecurityRepository());
