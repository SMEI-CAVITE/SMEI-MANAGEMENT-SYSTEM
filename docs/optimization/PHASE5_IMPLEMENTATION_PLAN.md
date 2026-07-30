# Phase 5 — Enterprise Large Dataset Implementation Plan

**Scope**: Table Virtualization, DOM Capping & Large Dataset Scalability for TSD Portal  
**Governance Reference**: `docs/optimization/OPTIMIZATION_POLICY.md` & `PERFORMANCE_GUIDELINES.md`  
**Status**: APPROVED IMPLEMENTATION ROADMAP (100% Business Logic Preservation)

---

## 1. Implementation Strategy & Scalability Guardrails

Phase 5 focuses on enabling the TSD Portal to handle 1,000 to 50,000+ records seamlessly without browser lag, DOM bloat, or memory exhaustion.

### Mandatory Scalability Guardrails
1. **Zero Workflow Modification**: Users must experience identical search, filter, pagination, row selection, and export capabilities.
2. **Strict DOM Ceiling**: Keep total active rendered DOM nodes below 1,500 nodes at all times.
3. **Preserved Export Fidelity**: Exporting 5,000 records to Excel, Word, or PDF must operate on the complete underlying dataset, not just the visible virtualized window.

---

## 2. Step-by-Step Scalability Specifications

### Action 1: Table Windowing / Virtualized Row Rendering in `HazardousWasteModule.tsx`
- **Current Issue**: Rendering all filtered records synchronously into table rows creates tens of thousands of DOM elements on large datasets.
- **Proposed Optimization**: Integrate dynamic table virtualization or viewport row rendering (`@tanstack/react-virtual` or pagination windowing).
- **DOM Node Reduction**: Drops DOM nodes from 28,000+ down to ~800 nodes.
- **Expected Performance Gain**: Maintains fluid 60 FPS scrolling and instantaneous search filtering on 10,000+ records.
- **Business Logic Impact**: None (100% Preserved).
- **Target File**: `src/components/HazardousWasteModule.tsx`

---

### Action 2: Virtualized Dropdown Option Rendering in `WasteMovementModule.tsx`
- **Current Issue**: Breakdown dropdown selectors attempt to mount all breakdown document options simultaneously.
- **Proposed Optimization**: Apply slice capping (`.slice(0, 50)`) and virtualized option lists during breakdown selection.
- **Expected Performance Gain**: Eliminates 300ms dropdown open delay on large breakdown lists.
- **Business Logic Impact**: None (100% Preserved).
- **Target File**: `src/components/WasteMovementModule.tsx`

---

### Action 3: Chunked Asynchronous File Generation for 5,000+ Record Exports
- **Current Issue**: Exporting 5,000+ records in a single synchronous loop can temporarily lock the UI main thread.
- **Proposed Optimization**: Process export row formatting in small asynchronous time-sliced batches (`requestIdleCallback` / `setTimeout` micro-tasks) while displaying a clean progress bar.
- **Expected Performance Gain**: Prevents "Page Unresponsive" browser warnings during massive multi-thousand row exports.
- **Business Logic Impact**: None (100% Preserved).
- **Target File**: `src/utils/exportEngine.ts`
