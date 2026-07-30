# Enterprise Document Export Standards

## 1. Overview & Preservation Imperative

Document export engines (Excel spreadsheets, Word documents, and PDF summaries) represent mission-critical outputs of the SMEI Management System consumed by regulatory authorities, financial auditors, logistics managers, and clients. 

All export modules must adhere strictly to these enterprise standards during development and optimization.

---

## 2. Excel Workbook Export Standards (`xlsx` & Template Engine)

### 2.1 Template Preservation Rule
- Master Excel templates (stored in `src/masterData/` or template assets) must never be corrupted, modified, or overwritten by automated scripts.
- Cell coordinates, sheet indexes, column offsets, header rows, and formula cells must remain preserved.

### 2.2 Data Value Formatting
- Numerical quantities must be injected as true numbers (`number` primitive) rather than strings to preserve spreadsheet SUM/AVERAGE formula functionality.
- Floating-point weights must apply business rounding (`src/utils/wasteRounding.ts`) prior to template injection to guarantee that displayed values sum accurately.
- Control numbers (Manifest No., MRR No., RC No., PIS No.) must be converted to uppercase strings and formatted using `formatControlNumber`.

---

## 3. Word & PDF Document Export Standards

### 3.1 Visual Structure & Template Placeholders
- Word (`.docx`) template placeholders (e.g., `{MANIFEST_NO}`, `{CLIENT_NAME}`, `{TOTAL_QTY}`) must match exact placeholder naming contracts.
- Signature blocks, company headers, and regulatory approval notices must retain precise padding, alignment, and page margins.

### 3.2 Dynamic Table Generation
- Multi-row breakdown tables in exports must cleanly handle variable row counts without breaking page pagination or pushing signatures into orphaned overflows.

---

## 4. Verification & Testing Protocol

- Every build or refactoring phase affecting export utility services (`src/utils/templateExport.ts`, `src/utils/exportUtils.ts`) must undergo mandatory visual and structural export checks:
  1. Trigger test document generation in Light/Dark UI modes.
  2. Open exported Excel/Word/PDF files in Microsoft Office / Acrobat to verify zero template corruption or cell value misalignment.
