# Table and Collection Relationships

## Purpose
Maps the logical entity connections, foreign references, and validation routes in our database.

## Scope
Applies to relational query construction, document cascading, and schema validation.

## Entity Relationship Diagram
```
+--------------------------+
|  requestForSupplies      |
|  - id                    |
+--------------------------+
             | (1 : 1)
             v
+--------------------------+
|  canvassSheets           |
|  - id                    |
|  - rfsId (FK)            |
+--------------------------+
             | (1 : 1)
             v
+--------------------------+          +-------------------------+
|  purchaseOrders          | -------> |  suppliers              |
|  - id                    | (N : 1)  |  - id                   |
|  - canvassId (FK)        |          +-------------------------+
|  - supplierId (FK)       |
+--------------------------+
             | (1 : 1)
             v
+--------------------------+
|  paymentInstructions     |
|  - id                    |
|  - poId (FK)             |
+--------------------------+
```

## Cascade Deletion Rules
1. **RFS Archival:** Deleting or archiving an RFS will automatically archive the linked Canvass Sheet.
2. **Immutable PO Reference:** A Purchase Order cannot be deleted if a corresponding Payment Instruction Slip (PIS) already exists in any status.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Re-assess whenever introducing sub-collections or tertiary mapping documents.
