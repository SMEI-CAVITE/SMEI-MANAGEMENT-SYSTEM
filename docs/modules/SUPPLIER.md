# Suppliers Profile Module Spec

## Purpose
Serves as the central repository of certified vendors, bank details, contact names, performance scores, and physical addresses.

## Features
* **Vendor Directory Table:** Comprehensive sorting by performance, category, and order volume.
* **Dynamic Search Bar:** Instant typing filters.
* **Purchase History Linkage:** Lists all historical POs issued to the selected vendor.

## User Flow
1. **Registration:** Buyer opens the Supplier registry and clicks "Add Vendor".
2. **Detail Entry:** Inputs contact information, bank names, routing codes, and business registration numbers.
3. **Canvassing Pool:** The registered supplier is immediately available to select during quotation canvassing.

## Business & Validation Rules
* Bank account numbers must be numeric and unique.
* Performance rating must sit within the standard `1` to `5` score scale.

## Database Usage
* Creates and updates documents in collection `suppliers`.
* Reads orders from `purchaseOrders` for historic stats compiling.

## UI Requirements
* High contrast lists and clean grid partitions.

## Future Improvements
* Automated credit score verification via third-party finance adapters.
* Supplier self-service portal to update banking documents.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Revise when introducing vendor category classifications.
