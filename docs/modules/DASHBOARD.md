# Primary Portal Dashboard Spec

## Purpose
Presents users with their daily activities, active alerts, task queues, and pending documents upon logging in.

## Features
* **KPI Metrics Bento:** High-impact metric boxes listing "Outstanding POs", "Pending RFS", and "Monthly Disbursements".
* **Interactive Task Queue:** Staggered list items linking to files waiting for active user signatures.
* **Procurement Activity Logs:** Live timeline feed highlighting system actions.

## User Flow
1. **Authentication:** User logs in and lands on the dashboard.
2. **Review Metrics:** Examines pending items needing action.
3. **Action Routing:** Click on a task queue item to open its split directory view.

## Business & Validation Rules
* Displayed cards and metrics are filtered dynamically based on current user roles.

## Database Usage
* Dynamically counts documents across `purchaseOrders`, `requestForSupplies`, and `canvassSheets`.

## UI Requirements
* High contrast bento layouts utilizing modern space-efficient spacing.
* Custom entering animations for KPI metric widgets.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Update upon redesigning dashboard widget layouts.
