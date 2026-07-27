# Validation and Field Verification Rules

## Purpose
Documents strict input boundaries, number lengths, status structures, and automated checks used to preserve data health.

## Scope
Applies to both React client form verification and Firestore schema writes.

## Core Validation Checks

### 1. Numeric Fields
* **Quantity Fields:** Must be positive integers greater than zero (`qty > 0`).
* **Unit Prices:** Must be decimal amounts greater than zero (`unitPrice > 0.00`).
* **Amounts / Totals:** Auto-totals must precisely match the sum of row items:
  $$\text{Total Amount} = \sum (\text{qty} \times \text{unitPrice})$$

### 2. Form Completeness
* **PO Forms:** Require a valid linked supplier record, buyer signature metadata, and date.
* **Canvass Forms:** Require quotes from at least 3 distinct suppliers.

### 3. Date Integrity
* **PO Date:** Must be equal to or greater than the referenced RFS request date.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Must be adjusted if adding custom currency exchange rate adapters.
