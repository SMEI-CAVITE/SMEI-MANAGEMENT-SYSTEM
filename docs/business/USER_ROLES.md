# User Roles Matrix

## Purpose
Defines the authorized system roles, descriptive responsibilities, and assignment limits for users.

## Scope
Applies to client UI view layers, routing filters, and database writes.

## Standard Roles

### 1. Requestor (Employee)
* **Responsibility:** Creating, editing, and tracking their own Request for Supply (RFS) documents.
* **Limits:** Cannot view or edit other employees' requests, cannot access Canvass sheets or PO forms.

### 2. Buyer (Purchasing Agent)
* **Responsibility:** Building Canvass sheets, linking supplier quotes, and generating Purchase Orders.
* **Limits:** Cannot approve their own POs; cannot authorize disbursements.

### 3. Approver (Department Head / Executive)
* **Responsibility:** Reviewing, signing, and authorizing POs and RFS requests.
* **Limits:** Cannot create draft purchase forms.

### 4. Disburser (Finance Staff)
* **Responsibility:** Compiling and paying out Payment Instruction Slips (PIS).

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Revised upon adding third-party external auditors or warehouse clerk roles.
