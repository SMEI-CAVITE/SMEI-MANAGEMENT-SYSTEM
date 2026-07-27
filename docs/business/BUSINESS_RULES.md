# Procurement Business Rules

## Purpose
Defines the strict regulatory boundaries, threshold levels, and audit rules governing the enterprise procurement process.

## Scope
Applies to both client-side authorization locks and server-side state machine updates.

## Core Regulations

### 1. The Canvass Sheet Rule
* **Mandatory Supplier Pool:** No Purchase Order (PO) can be created without a prior Canvass Sheet comparing a minimum of **3 independent supplier quotations**.
* **Rationale:** Ensures fair pricing, competitive comparison, and transparent corporate governance.

### 2. High-Value Authorization Limits
* **Standard Threshold:** Transactions under **$5,000 USD equivalent** can be approved by department heads or dedicated Purchasing Agents.
* **Executive Approval:** Any Purchase Order exceeding **$5,000 USD** automatically routes to executive directors or company officers for secondary digital signature.

### 3. Payment Separation (PIS Control)
* **PIS Creation Trigger:** A Payment Instruction Slip (PIS) can *only* be created for Purchase Orders marked as `Approved` and `Delivered`. Draft or pending POs are strictly blocked from generating payment requests.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Re-evaluate immediately when financial limits or audit rules are adjusted by the corporate board.
