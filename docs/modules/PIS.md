# Payment Instruction Slips (PIS) Module Spec

## Purpose
Enables procurement buyers to compile disbursement directions for the accounts department to execute payouts to suppliers.

## Features
* **Sticky Header Directory Table:** Quick tracking of paid vs. pending slips.
* **Split Preview Panel:** Dynamic rendering of bank accounts, invoice numbers, and disbursement figures.
* **Excel Template Export:** Generates standardized instruction files.

## User Flow
1. **Select PO:** Disbursers open the PIS screen and click "Create Slip", selecting an approved PO.
2. **Form Entry:** Input the invoice number, recipient bank details, and payment modes.
3. **Submission:** Click save to create a pending payment instruction, locking the referenced PO.
4. **Execution:** Finance staff view the pending slips, release the bank transfer, and flag the PIS as `Paid`.

## Business & Validation Rules
* Can only reference Purchase Orders in the `Approved` status.
* Payee Name must match the supplier's legal registered bank account title.
* Total Amount cannot exceed the value specified on the referenced PO.

## Database Usage
* Reads from collection `purchaseOrders`.
* Creates and updates documents in collection `paymentInstructions`.

## UI Requirements
* Split interface: 40% listing table on the left, 60% high-fidelity live spreadsheet layout on the right.

## Future Improvements
* Direct integration with bank APIs for instant automated bulk clearance.
* Automated payment receipt parsing using OCR.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Update if altering standard bank instruction fields.
