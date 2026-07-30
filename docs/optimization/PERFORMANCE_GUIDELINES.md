# Enterprise Performance Guidelines & Coding Patterns

## 1. Introduction

This handbook serves as the official technical reference for writing high-performance, memory-efficient React & TypeScript code for the SMEI Management System. Engineers and AI agents must adhere to these guidelines during all refactoring and feature implementation tasks.

---

## 2. React Rendering Best Practices

### 2.1 Component Decomposition
Avoid building monolithic components that handle layout, form state, table rendering, calculations, and exports within a single render function. Decompose large components into smaller, single-responsibility sub-components so that state updates in one area (e.g., search input) do not force re-renders in unrelated areas (e.g., summary statistics panel).

### 2.2 Strategic Component Memoization (`React.memo`)
Wrap purely presentational components and table row components with `React.memo` when they receive primitive props or memoized reference props:

```tsx
// Preferred Pattern for Table Row Components
export const RecordRow = React.memo(({ record, onSelect }: RecordRowProps) => {
  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <td>{record.manifestNo}</td>
      <td>{record.client}</td>
      <td>
        <button onClick={() => onSelect(record.id)}>View</button>
      </td>
    </tr>
  );
}, (prevProps, nextProps) => {
  return prevProps.record === nextProps.record && prevProps.onSelect === nextProps.onSelect;
});
```

### 2.3 Stabilizing Props (`useCallback` & `useMemo`)
Passing inline arrow functions or inline object literals as props invalidates child component memoization:

```tsx
// ANTI-PATTERN: Inline arrow function and inline object
<RecordTable 
  data={records} 
  options={{ showActions: true }} 
  onSelect={(id) => handleSelect(id)} 
/>

// RECOMMENDED PATTERN: Memoized references
const tableOptions = useMemo(() => ({ showActions: true }), []);
const handleSelectCallback = useCallback((id: string) => {
  handleSelect(id);
}, [handleSelect]);

<RecordTable 
  data={records} 
  options={tableOptions} 
  onSelect={handleSelectCallback} 
/>
```

---

## 3. Computation & Data Processing

### 3.1 Memoizing Data Transformations
Expensive mathematical aggregations, array filtering, and multi-column sorting must be wrapped in `useMemo` with explicit dependency tracking:

```tsx
// Recommended Pattern: Memoized Filtering & Calculations
const filteredRecords = useMemo(() => {
  if (!searchQuery.trim()) return records;
  const q = searchQuery.toLowerCase();
  return records.filter(r => 
    r.manifestNo.toLowerCase().includes(q) ||
    r.client.toLowerCase().includes(q)
  );
}, [records, searchQuery]);

const summaryTotals = useMemo(() => {
  return filteredRecords.reduce((acc, r) => {
    acc.totalQty += r.quantityKg || 0;
    acc.totalValue += r.recoveryValue || 0;
    return acc;
  }, { totalQty: 0, totalValue: 0 });
}, [filteredRecords]);
```

### 3.2 Extracting Pure Helper Functions
Helper functions that do not depend on component state or props must be defined outside the component render function or in separate utility modules. This prevents function re-allocation on every render.

---

## 4. Memory Management & Leak Prevention

### 4.1 Listener & Subscription Cleanup
Every event listener, subscription, interval, or timeout initialized inside a `useEffect` must return an explicit cleanup function:

```tsx
// Recommended Pattern: Safe Listener Cleanup
useEffect(() => {
  const handleResize = () => {
    setWindowWidth(window.innerWidth);
  };
  window.addEventListener("resize", handleResize);
  
  return () => {
    window.removeEventListener("resize", handleResize);
  };
}, []);

useEffect(() => {
  const unsubscribe = onSnapshot(collectionRef, (snapshot) => {
    // Process records
  });

  return () => unsubscribe();
}, [collectionRef]);
```

### 4.2 Eliminating State Duplication
Do not copy props or derived values into state if they can be calculated on-the-fly during render:

```tsx
// ANTI-PATTERN: Duplicating state
const [records, setRecords] = useState([]);
const [filteredRecords, setFilteredRecords] = useState([]); // Redundant!

// RECOMMENDED PATTERN: Derived value via useMemo
const [records, setRecords] = useState([]);
const filteredRecords = useMemo(() => {
  return records.filter(/* ... */);
}, [records, searchQuery]);
```

---

## 5. Bundle & Asset Optimization

### 5.1 Dynamic Component Imports (`React.lazy`)
Large modal components, export generators, and audit viewers that are not needed on initial page load should be dynamically imported:

```tsx
// Recommended Pattern: Lazy Loading Heavy Modals
const MasterDataAuditModal = React.lazy(() => import("./MasterDataAuditModal"));

// Usage inside component
<Suspense fallback={<div className="p-4 text-xs">Loading Audit Engine...</div>}>
  {isModalOpen && <MasterDataAuditModal isOpen={isModalOpen} onClose={closeModal} />}
</Suspense>
```

### 5.2 Subpath Icon Imports
Import icons directly or ensure the bundler tree-shakes unused exports:

```tsx
// Preferred: Explicit Named Imports
import { Search, ChevronDown, CheckCircle, AlertCircle } from "lucide-react";
```

---

## 6. Local Storage & Serialization

### 6.1 Avoiding Frequent JSON Serialization
Avoid calling `JSON.stringify` or `JSON.parse` synchronously on large objects inside render bodies or high-frequency event handlers. Debounce storage updates or serialize only when necessary.
