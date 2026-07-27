# Canvass Sheets Module Spec

## Purpose
Facilitates price comparison and automated tender selection by linking an RFS to quotes from at least three different suppliers.

## Features
* **Matrix Comparison Sheet:** Side-by-side pricing matrices matching items and supplier bids.
* **Auto-Bid Analysis:** Highlights the optimal cost-saving bid.
* **Dynamic Bid Calculator:** Recalculates total values as prices are inputted.

## User Flow
1. **Creation:** Buyer creates a new Canvass sheet referencing an approved RFS.
2. **Quote Entry:** Inputs quotes received from at least 3 distinct vendors.
3. **Analysis:** Review the highlighted lowest-cost options in the live canvas table.
4. **Save:** Saves the canvass, transitioning the RFS status and authorizing PO creation.

## Business & Validation Rules
* Requires quotations from a minimum of **3 independent suppliers**.
* All prices must be positive numeric figures.

## Database Usage
* Creates and updates collection `canvassSheets`.
* Reads from collection `suppliers` and `requestForSupplies`.

## UI Requirements
* Responsive pricing matrix table with sticky row headings.
* Auto-collapsing sidebar upon opening the edit modal.

## Future Improvements
* AI extraction of emailed supplier quotes directly into the canvass matrix.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Update if adding qualitative criteria to the bidding comparison matrix.
