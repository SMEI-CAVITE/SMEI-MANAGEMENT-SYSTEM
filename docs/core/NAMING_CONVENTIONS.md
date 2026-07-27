# Naming Conventions Reference

## Purpose
Establishes clear naming rules across the repository for files, functions, variables, database fields, and UI IDs. Consistent naming allows AI coding assistants to predict, query, and edit files without errors.

## Scope
Applies to both the frontend (React/TypeScript) and backend (Express/CJS).

## Rules & Standards

### 1. Files and Directories
* **React Components:** PascalCase. Example: `POForm.tsx`, `DocumentPreview.tsx`.
* **Utility Files / Helpers:** camelCase. Example: `templatePreview.ts`, `databaseRules.ts`.
* **Directories:** kebab-case. Example: `design-system`, `user-roles`.

### 2. Code Identifiers
* **Variables & Functions:** camelCase. Example: `selectedPOId`, `handleFormSubmit()`.
* **React Hooks:** camelCase prefixed with `use`. Example: `useTheme()`, `useEffect()`.
* **TypeScript Types & Interfaces:** PascalCase. Example: `PurchaseOrder`, `CanvassSheet`.
* **Constants:** UPPER_CASE with underscores. Example: `DEFAULT_ZOOM_RATIO`, `MAX_SUPPLIERS`.

### 3. Database & Database Fields
* **Collections (Firestore):** camelCase plural. Example: `purchaseOrders`, `paymentInstructions`.
* **Document Attributes:** camelCase. Example: `poNumber`, `createdAt`, `totalAmount`.

### 4. HTML ID Attributes (UI Verification)
* **Meaningful Interactive Elements:** Must have unique IDs prefixed with `smei-`.
* **Examples:** `smei-po-table`, `smei-zoom-in`, `smei-preview-canvas`.

## Notes for AI Assistants
* Do not introduce arbitrary abbreviations. Use full nouns for variables (e.g., use `purchaseOrder` instead of `poObj` or `pOrd`).

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Must be updated if the project adopts a database schema with snake_case.
