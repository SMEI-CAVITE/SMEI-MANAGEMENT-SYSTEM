# Request For Supply (RFS) Module Spec

## Purpose
Enables departmental employees to raise supply requests, route them to department heads for approval, and monitor their status.

## Features
* **Department Filtering:** Quick status auditing across organization divisions.
* **Live Word Preview:** Renders real-time requisition layouts.
* **Multi-Stage Approval State Flow:** Tracks transitions from draft to fulfillment.

## User Flow
1. **Creation:** Requestor opens the RFS directory, clicks "New Requisition", and fills in requested items.
2. **Submission:** Submits the RFS; status changes to `Pending Approval`.
3. **Review:** Department Head opens their approval dashboard, checks the RFS live preview, and clicks "Approve".
4. **Handover:** The approved RFS automatically routes to the Buyer pool, ready for Canvass sheet creation.

## Business & Validation Rules
* Quantity of requested items must be greater than zero.
* Requisition dates cannot be backdated past the current calendar month.

## Database Usage
* Writes to and updates collection `requestForSupplies`.

## UI Requirements
* 40/60 split directory layout.
* Instant data sync when editing items.

## Future Improvements
* Predictive item catalogs powered by Gemini to autocomplete description fields.
* Auto-triggering alerts to inventory management boards.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Must be adjusted if adding a tier for department sub-categories.
