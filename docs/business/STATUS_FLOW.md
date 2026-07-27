# Document Status State Machine

## Purpose
Maps and secures all valid status pathways and transition triggers for our system documents.

## Scope
Applies directly to document state handlers in both client forms and Express routers.

## Status Transitions Blueprints

### 1. Request for Supply (RFS) Status Lifecycle
```
[Draft] -> [Pending Approval] -> [Approved] or [Rejected]
```
* **Rules:**
  * Only the original owner can change status to `Pending Approval`.
  * Only designated Approvers can shift status from `Pending` to `Approved`/`Rejected`.

### 2. Purchase Order (PO) Status Lifecycle
```
[Draft] -> [Pending Approval] -> [Approved] or [Rejected] -> [Closed]
```
* **Rules:**
  * When a PO transitions to `Approved`, the document becomes **read-only** in the database to prevent retrospective modification.

## Implementation Standard
All transitions must be verified by comparing current state in Firestore before saving changes:
```ts
if (currentStatus === "Approved" && nextStatus === "Draft") {
  throw new Error("Invalid transition: Approved documents cannot revert to Draft state");
}
```

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Revise when introducing secondary multi-stage review sub-states.
