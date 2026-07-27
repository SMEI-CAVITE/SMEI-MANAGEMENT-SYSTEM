# Database Schema Blueprint

## Purpose
Provides structural definitions, field types, and default values for all collections inside our database.

## Scope
Applies to all Firestore document writes and backend object mappings.

## Collection Schemas

### 1. Collection: `purchaseOrders`
Stores approved purchase orders with reference numbers, supplier links, items, and signatories.
* `id` (string, UUID) - Primary identifier
* `poNumber` (string) - Unique sequential PO identifier (e.g., `PO-2026-0001`)
* `rfsId` (string) - Reference to source Request for Supply
* `canvassId` (string) - Reference to selected Canvass Sheet
* `supplierId` (string) - Link to supplier profile
* `items` (array of objects)
  * `description` (string)
  * `qty` (number)
  * `unitPrice` (number)
  * `total` (number)
* `totalAmount` (number) - Auto-calculated sum of items
* `status` (string enum: `Draft`, `Pending Approval`, `Approved`, `Rejected`)
* `createdAt` (timestamp)

### 2. Collection: `paymentInstructions`
* `id` (string, UUID)
* `pisNumber` (string)
* `poId` (string) - Reference to source PO
* `payeeName` (string)
* `bankName` (string)
* `accountNumber` (string)
* `totalAmount` (number)
* `status` (string enum: `Draft`, `Pending Payment`, `Paid`)

### 3. Collection: `requestForSupplies`
* `id` (string)
* `controlNumber` (string)
* `department` (string)
* `items` (array)
* `status` (string)

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** This schema map must be adjusted immediately upon adding or removing fields from any entity.
