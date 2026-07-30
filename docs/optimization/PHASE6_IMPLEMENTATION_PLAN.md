# Phase 6 — Enterprise Database & Pipeline Implementation Plan

**Scope**: Zero-Risk Firestore Query Caching, Listener Stream Consolidation & Local Storage Pipeline Optimizations  
**Governance Reference**: `docs/optimization/OPTIMIZATION_POLICY.md` & `PERFORMANCE_GUIDELINES.md`  
**Status**: APPROVED IMPLEMENTATION ROADMAP (100% Data Contract & Security Rule Preservation)

---

## 1. Implementation Strategy & Database Guardrails

Phase 6 focuses on minimizing Firestore read/write billing operations, optimizing client-side offline persistence, eliminating duplicate query subscriptions, and caching static template assets.

### Mandatory Database Guardrails
1. **Zero Data Contract Alteration**: Collection names, document IDs, field types, and security rules (`firestore.rules`) remain 100% unchanged.
2. **Identical Real-Time Synchronization**: Users must continue receiving instant multi-device data updates without delay or data loss.
3. **Preserved LocalStorage Schema**: Key names and data structures stored in browser `localStorage` remain identical.

---

## 2. Step-by-Step Database & Pipeline Specifications

### Action 1: Master Data Document In-Memory Cache Singleton
- **Current Issue**: Re-fetching master data recovery rules and company lists on every module mount.
- **Proposed Optimization**: Cache master data documents in an in-memory runtime cache with instant fallback to Firestore listener streams.
- **Expected Read Reduction**: Eliminates ~60% of redundant master data document reads.
- **Business Logic Impact**: None (100% Preserved).
- **Affected Files**: `src/services/firebase.ts`, `src/utils/masterDataCache.ts`

---

### Action 2: Document Export Template ArrayBuffer Caching
- **Current Issue**: Re-fetching binary Excel and Word template files from public storage on every export action.
- **Proposed Optimization**: Store loaded template `ArrayBuffer` binaries in an in-memory LRU cache map.
- **Expected Performance Gain**: Second and subsequent document exports trigger instantaneously without network latency.
- **Business Logic Impact**: None (100% Preserved).
- **Affected Files**: Export engine helpers in `src/utils/`

---

### Action 3: Optimized LocalStorage Key Compression & Debounced Writes
- **Current Issue**: Synchronous `localStorage.setItem()` calls on every keystroke in search inputs or draft forms.
- **Proposed Optimization**: Debounce draft form state serialization to `localStorage` using a 300ms timer.
- **Expected Performance Gain**: Eliminates main thread I/O blocking during rapid typing.
- **Business Logic Impact**: None (100% Preserved).
- **Affected Files**: `src/hooks/useLocalStorage.ts`
