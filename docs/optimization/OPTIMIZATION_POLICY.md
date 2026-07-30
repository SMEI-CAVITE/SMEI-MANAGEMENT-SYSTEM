# Enterprise Optimization Policy

## 1. Executive Summary & Objective

The SMEI Management System Enterprise Optimization Policy establishes the binding rules, operational boundaries, and verification criteria for all performance engineering and refactoring activities across the application codebase. 

The primary objective of optimization is to continuously enhance system performance, memory efficiency, rendering fluidity, and long-term maintainability without introducing functional regressions, altering business logic, or compromising enterprise data integrity.

---

## 2. Business Logic Freeze Policy

Under no circumstances shall any optimization phase or performance refactoring modify, rewrite, or alter business domain logic.

### Strictly Frozen Elements
1. **Business Rules & Decision Matrices**: All hazard classification rules, waste recovery percentages, and client-specific business rules.
2. **Formulas & Calculations**: Business rounding, waste movement distribution formulas, recovery tonnage calculations, and tax or financial totals.
3. **Control Numbering Systems**: Sequences, templates, prefixes, auto-formatting, and validation patterns (e.g., Manifest numbers, MRR numbers, PIS/RFS/PO numbers, RC numbers).
4. **Validation Schemas & Field Requirements**: Required field indicators, regex patterns, input masks, and validation state error messages.
5. **Workflows & Gatekeepers**: Security gates, role-based access checks, approval steps, status state machines, and document status lifecycles.
6. **Export & Template Logic**: Excel workbook structures, cell coordinates, template placeholders, Word document generation logic, and PDF render engines.
7. **Database Schemas & Firestore Flow**: Firestore collection schemas, document field types, security rules, offline queue structures, and sync logic.
8. **Storage Schemas & Browser Cache**: LocalStorage keys, structural models, user session keys, and caching contracts.
9. **API Contracts & Endpoint Interfaces**: Express API routes, request/response payload schemas, authentication header handling, and HTTP status handling.

---

## 3. Zero Regression Policy

Every performance optimization effort must guarantee total functional parity before and after refactoring. The system must undergo mandatory regression verification across all document generation and enterprise integration paths.

### Protected Operations
- **Excel Exports**: Output file structures, formatting, merged cells, formulas, sheet naming, and cell-level data accuracy must remain 100% bit-exact or functionally equivalent.
- **Word & PDF Exports**: Typography styling, logo placement, margin alignment, signature blocks, and data bindings must remain identical.
- **Upload & File Reading Workflows**: Excel/CSV parsing logic, column header identification, template validation, and error reporting during uploads must function unchanged.
- **Template Injection & Previews**: Dynamic document template mapping and modal document previews must behave seamlessly.
- **Security & Authentication**: User permissions, PIN modal validations, profile updates, and audit trail generation must remain completely unaffected.
- **UI Responsiveness & Layout**: Visual layout rhythm, theme adherence (Light/Dark mode), spacing tokens, typography scales, and element positioning must remain unaltered.

---

## 4. Scope of Allowed Optimizations

Engineers and AI agents are strictly limited to technical performance techniques that enhance runtime efficiency without altering functional behavior.

### Permitted Technical Modifications
- **React Rendering Optimization**: Implementing `React.memo`, `useMemo`, `useCallback` (when supported by profiling data), component splitting, and custom hook extraction.
- **Code Splitting & Lazy Loading**: Dynamic `import()` statements for modal dialogs, route components, heavy chart modules, and document export libraries.
- **Computational Memoization**: Memoizing expensive array transformations, multi-column search filtering, multi-field sorting, and aggregate mathematical reductions.
- **Virtualization & Pagination**: Virtualizing long data tables or applying client-side pagination for collections exceeding hundreds of rows.
- **Memory & Resource Cleanup**: Unsubscribing from Firestore real-time listeners, clearing timers/intervals, removing window event listeners on unmount, and breaking circular references.
- **Import & Bundle Optimization**: Removing unused imports, replacing monolithic import paths with subpath imports (e.g., `lucide-react` subpathing), and eliminating dead code.
- **State Structure Streamlining**: Flattening overly nested local state, eliminating redundant state, and computing derived values during render or via memoization instead of duplicate state variables.

---

## 5. Forbidden Optimization Practices

The following actions are strictly prohibited in any performance task:

1. **Algorithm Replacement**: Replacing proven business algorithms with alternative implementations that yield different rounding or floating-point outcomes.
2. **Workflow & UI Redesign**: Modifying navigation structures, removing buttons, collapsing modal steps, or altering form layouts under the guise of performance.
3. **Template or Asset Removal**: Removing brand assets, document templates, signature blocks, or regulatory disclosures.
4. **Database Schema Mutation**: Adding, renaming, or dropping Firestore fields or backend database models without formal architecture board authorization.
5. **API Contract Changes**: Modifying URL parameters, response keys, or payload formats consumed by front-end clients or external webhooks.
6. **Bypassing Validations**: Disabling or relaxing form validations or control number formatting rules to improve input frame rates.

---

## 6. Performance Measurement Policy

Every proposed optimization must be justified and measured using standard telemetry metrics:

1. **Justification**: A clear statement explaining why the refactoring is required (e.g., "Extremely high render count on table state updates").
2. **Expected Gain**: Quantifiable performance target (e.g., "Reduce frame render time from 45ms to <8ms during search input typing").
3. **Risk Level**: Risk categorization (**Low**, **Medium**, or **High**) evaluated against module criticality.
4. **Verification Method**: Defined profiling method (e.g., React DevTools Profiler, Chrome Memory Snapshot, Lighthouse audit, bundle analyzer).

---

## 7. Regression Testing & Sign-Off Policy

Before any performance pull request or code change is merged, it must pass mandatory verification steps:

1. **Compilation**: `npm run build` must execute without any TypeScript errors (`tsc --noEmit`).
2. **Static Analysis**: `npm run lint` must pass with zero fatal linting errors.
3. **Build Execution**: Vite bundling must complete without unresolved module dependencies or dynamic import warnings.
4. **Document Export Verification**: Test export generation for Excel, Word, and PDF files to verify structural correctness.
5. **Form & Entry Flow Verification**: Validate creation, editing, modal opening/closing, and deletion cycles.
6. **Visual Inspection**: Verify dark/light mode rendering, mobile/desktop layout integrity, and zero visual layout shifts.
