# Procurement Lifecycle Workflows

## Purpose
Maps the end-to-end sequential pipeline of procurement stages, illustrating how requests transition into final disbursements.

## Scope
Provides a high-level flowchart and state map of the entire business process.

## Sequential Stage Map

```
Stage 1: Request Supply (RFS)
   |  - Raised by departmental employee
   |  - Approved by department head
   v
Stage 2: Quotation Canvassing (Canvass Sheet)
   |  - Buyer collects quotes from 3+ suppliers
   |  - Compiles prices and identifies best bid
   v
Stage 3: Purchase Agreement (PO)
   |  - Buyer creates PO linking back to Canvass and RFS
   |  - Signed by Buyer and Approving Official
   v
Stage 4: Payment Issuance (PIS)
   |  - Issued by procurement desk; authorized by Finance
   |  - Disbursed directly to supplier bank account
```

## Workflow Execution Rules
* **No Stage Skipping:** Creating a PO without an associated Canvass reference or creating a PIS without an approved PO reference is strictly prohibited by backend route validators.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Update if integrating a Goods Received Note (GRN) stage or quality assurance inspections.
