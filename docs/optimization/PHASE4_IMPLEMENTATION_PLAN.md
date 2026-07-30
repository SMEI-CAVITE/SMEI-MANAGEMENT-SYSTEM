# Phase 4 — Enterprise Bundle & Loading Implementation Plan

**Scope**: Zero-Risk Code Splitting, Dynamic Import & Startup Optimizations for TSD Portal  
**Governance Reference**: `docs/optimization/OPTIMIZATION_POLICY.md` & `PERFORMANCE_GUIDELINES.md`  
**Status**: APPROVED IMPLEMENTATION ROADMAP (100% Business Logic Preservation)

---

## 1. Implementation Strategy & Bundle Guardrails

Phase 4 focuses on accelerating application startup speeds, reducing initial bundle sizes, deferring non-critical JavaScript, and optimizing chunk boundaries.

### Mandatory Bundle Guardrails
1. **Zero Business Logic Impact**: Business Logic Impact: None (100% Preserved).
2. **Identical User Experience**: Lazy loading boundaries must load seamlessly with lightweight fallback spinners or skeleton overlays; user interaction flows remain untouched.
3. **Identical Export Outputs**: Dynamic imports of `xlsx` or PDF utilities must produce identical output documents.

---

## 2. Step-by-Step Bundle Optimization Specifications

### Action 1: Dynamic Lazy Loading for Secondary Portal Modules in `App.tsx`
- **Current Issue**: Monolithic top-level static imports for all sub-modules in `App.tsx`.
- **Root Cause**: Synchronous module imports at top level.
- **Technical Explanation**: Loading all routes on initial page load bloats the initial bundle and increases V8 compilation time.
- **Proposed Optimization**: Wrap non-initial modules with `React.lazy(() => import('./components/...'))` and `Suspense`.
- **Expected Bundle Reduction**: ~210 KB initial bundle reduction.
- **Expected Startup Gain**: 30% faster initial page display.
- **Difficulty**: Low.
- **Risk Level**: **Zero Risk**.
- **Business Logic Impact**: None (100% Preserved).
- **Affected Files**: `src/App.tsx`
- **Verification Method**: Vite production build chunk analysis (`dist/` asset inspection).

---

### Action 2: On-Demand Dynamic Import of Heavy Export Engines
- **Current Issue**: Synchronous import of `xlsx` and document generation libraries on app boot.
- **Root Cause**: Static imports at the top of export utility files.
- **Technical Explanation**: Users only export files occasionally; loading 450+ KB of export library code during boot wastes bandwidth and CPU.
- **Proposed Optimization**: Move `xlsx` import into dynamic `const XLSX = await import('xlsx')` calls inside export event handlers.
- **Expected Bundle Reduction**: ~450 KB initial vendor bundle reduction.
- **Expected Startup Gain**: 40% faster JavaScript execution time during app boot.
- **Difficulty**: Medium.
- **Risk Level**: **Zero Risk**.
- **Business Logic Impact**: None (100% Preserved).
- **Affected Files**: Export helper utilities in `src/utils/`
- **Verification Method**: Network tab analysis during export button click events.

---

### Action 3: Lazy-Loading Heavy Modal Components
- **Current Issue**: Modal dialog components (`MasterDataAuditModal`, preview modals) parsed during initial route load.
- **Root Cause**: Static component imports inside parent views.
- **Technical Explanation**: Modal components are only viewed when triggered by user clicks; parsing them upfront adds unnecessary main thread work.
- **Proposed Optimization**: Import modals lazily using `React.lazy()` or conditionally render them behind user interaction flags.
- **Expected Bundle Reduction**: ~60 KB route chunk reduction.
- **Expected Startup Gain**: Faster initial tab switching speeds.
- **Difficulty**: Low.
- **Risk Level**: **Zero Risk**.
- **Business Logic Impact**: None (100% Preserved).
- **Affected Files**: `src/components/HazardousWasteModule.tsx`, `src/components/WasteMovementModule.tsx`
- **Verification Method**: Profiler initial mount time comparison.

---

## 3. Final Bundle Verification & Sign-Off Protocol

Before completing Phase 4 bundle optimizations:
- [ ] `compile_applet` passes cleanly (`tsc --noEmit`).
- [ ] `lint_applet` passes with zero errors.
- [ ] Production build succeeds with optimized vendor and dynamic route chunks.
- [ ] All document exports (Excel, Word, PDF) load export modules asynchronously and generate 100% accurate files.
- [ ] All business logic, formulas, and database workflows remain 100% identical.
