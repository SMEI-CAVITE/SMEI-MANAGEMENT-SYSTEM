# Enterprise Coding & Architecture Standards

## 1. Code Style & TypeScript Conventions

### 1.1 Strict Type System
- All variables, function parameters, state objects, and return values must be explicitly typed or cleanly inferred by TypeScript.
- The use of `any` is strictly prohibited unless interacting with legacy third-party untyped payloads, in which case `unknown` with runtime guard checks is preferred.
- Prefer `interface` for object payload and props contracts, and `type` for unions, primitives, and mapped types.

```tsx
// Preferred Type Definitions
export interface WasteRecord {
  id: string;
  manifestNo: string;
  client: string;
  mrrNo?: string;
  quantityKg: number;
  haulingDate: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
}
```

### 1.2 Module & Export Conventions
- All modules must use ES Module import/export syntax.
- Top-level named exports are preferred over default exports for utility modules to encourage tree-shaking.
- Group imports logically at the top of the file:
  1. React core hooks and standard React libraries
  2. Third-party UI icons, components, and utilities
  3. Internal components
  4. Internal utilities, constants, types, and services

---

## 2. React Component Architecture

### 2.1 Functional Components
- All components must be written as functional components using standard React hooks (`useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`).
- Class components are disallowed.

### 2.2 Hooks Rules & Dependency Integrity
- ESLint `react-hooks/exhaustive-deps` rules must be respected.
- Never omit required state or prop dependencies from `useMemo` or `useCallback` dependency arrays.
- Avoid passing unstable object references or inline functions directly into dependency arrays unless stabilized outside the component.

### 2.3 File & Directory Structure
- Place UI modules inside `src/components/`.
- Shared utility logic must reside inside `src/utils/`.
- Data interfaces and domain types belong in `src/types.ts` or module-specific type files.

---

## 3. Comments & Documentation Standards

- Document complex business logic, rounding algorithms, or regulatory compliance routines using JSDoc comment blocks above function signatures.
- Explain *why* a particular workaround or memoization guard exists, rather than stating the obvious.
