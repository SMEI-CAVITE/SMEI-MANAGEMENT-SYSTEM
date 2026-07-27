# Purchase Orders (PO) Module Spec

## Purpose
Manages the creation, verification, approval, signing, and printing/exporting of corporate Purchase Orders.

## Features
* **Split Directory Layout:** 40% list table on the left, 60% live document preview on the right.
* **Side-by-Side Editor:** Generates real-time Word layout updates as user types.
* **Integrated Word Exporter:** Generates legal purchase documents streaming from server templates.

## User Flow
1. **Creation:** Buyer clicks "Create PO", which collapses the navigation sidebar and opens the side-by-side workspace.
2. **Setup:** Selects an approved Canvass Sheet reference; the system auto-populates items, totals, and supplier details.
3. **Save/Submit:** Saves the draft or submits it for Approval.
4. **Action:** Approver reviews the live document preview in their directory and clicks "Approve" or "Reject".

## Business & Validation Rules
* Must link to a valid `supplierId` and approved `canvassId`.
* Sum of total amounts must match the sum of item details precisely.
* Requires signature metadata (name, role, timestamp) upon approval.

## Database Usage
* Writes to collection `purchaseOrders`.
* Reads from collections `canvassSheets`, `suppliers`, and `users`.

## UI Requirements
* Live preview updates instantly with no manual reloading.
* Workspace automatically collapses the sidebar on entering the form, restoring it on close.

## Future Improvements
* Integration with automatic electronic signature providers (e.g. DocuSign).
* Multi-currency automatic spot rate exchange adapters.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Re-evaluate if migrating the file layout formats to PDF.
