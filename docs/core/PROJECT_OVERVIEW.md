# Project Overview: Procurement Management System (SMEI)

## Purpose
The SMEI Procurement Management System is designed to automate, track, and streamline the end-to-end procurement process—ranging from initial Requests for Supply (RFS), multi-supplier canvassing, Purchase Order (PO) creation, and final Payment Instruction Slips (PIS). This document serves as the high-level functional specification and vision guide for both human engineers and AI coding assistants.

## Scope
The system handles:
1. **Request for Supply (RFS):** Creation, routing, departmental approval, and tracking of supply requests.
2. **Canvass Sheet Management:** Collecting quotations from multiple suppliers, comparing pricing, and auto-calculating optimal bids.
3. **Purchase Orders (PO):** Generating detailed legal purchase agreements with templates, auto-totals, and multi-signatory authorization.
4. **Payment Instruction Slips (PIS):** Standardized instructions facilitating disbursement from finance to suppliers.
5. **Reporting & Supplier Portals:** Supplier performance evaluation, order frequency, and financial spending metrics.

## Architecture & Data Flow Overview
```
+-------------+      +----------------+      +-------------+      +-------------+
|  RFS Stage  | ---> | Canvass Stage  | ---> |  PO Stage   | ---> |  PIS Stage  |
| (Requested) |      | (3+ Suppliers) |      | (Approved)  |      | (Disbursed) |
+-------------+      +----------------+      +-------------+      +-------------+
```

## Rules & Standards
* **Linear Procurement Integrity:** No Purchase Order can be created without a referenced and approved Canvass Sheet and RFS.
* **Audit Trail Preservation:** Once a PO or PIS is approved/signed, it is locked against edits. Any revisions must follow an amendment flow.
* **Dual Authorization:** Any transaction exceeding set threshold limits ($5,000 USD equivalent) automatically routes for executive signature.

## Best Practices
* **Consistent State Machine:** Ensure status flows (e.g., `Draft -> Pending Approval -> Approved -> Fulfilled`) are managed server-side and fully synchronized with the client UI.
* **Dynamic Calculations:** Client-side form totals must always match backend db calculations down to the lowest decimal point.

## Notes for AI Assistants
* When editing any module, consult the specific status transition rules defined in `STATUS_FLOW.md`.
* Ensure that the generated live document previews accurately represent the Word and Excel templates.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** This document must be updated whenever a new major procurement stage (e.g., Inventory, Warehousing) is introduced into the core workflow.
