# Coding Standards & Guidelines

## Purpose
This document enforces strict programming rules, architectural patterns, and code design decisions to ensure the codebase remains clean, predictable, and robust.

## Scope
Applies to all TypeScript (.ts, .tsx) files within both the client (`/src`) and server (`server.ts`) boundaries.

## Strict Standards

### 1. TypeScript & Type Safety
* **Avoid Implicit `any`:** All variable declarations, parameters, and function return values must specify clean types or use inference.
* **Importing Types:** Use named imports at the top-level. Do not import types destructured with values unless strictly allowed.
* **Enums Over Const Enums:** Always declare standard `enum` styles. Never use `const enum`.

### 2. React Components & Hooks
* **Functional Components Only:** Class components are forbidden unless interacting with legacy error boundaries.
* **Clean dependency arrays:** Do not include objects, functions, or arrays directly inside `useEffect` or `useMemo` hooks unless they are stabilized using state, deep comparison refs, or memoization.
* **Modular Extraction:** If a file grows beyond 1,500 lines, extract its nested sub-components into separate files in `/src/components/`.

### 3. Styling & Layouts
* **Tailwind Utility CSS:** Write all styling using utility classes. Custom CSS selectors are forbidden.
* **Flexible Sizing:** Never hardcode layout widths or heights in pixels. Use fluid viewport calculations (e.g., `calc(100vh - 280px)`) and relative spacing (`p-6`, `gap-6`).

## Implementation Example
```tsx
// ✅ GOOD: Stable dependencies and named imports
import React, { useState, useEffect, useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { PurchaseOrder } from "../types";

export const POSummaryCard: React.FC<{ order: PurchaseOrder }> = ({ order }) => {
  const isOverLimit = useMemo(() => order.totalAmount > 5000, [order.totalAmount]);

  return (
    <div id={`po-card-${order.id}`} className="p-6 bg-white border border-gray-100 rounded-xl">
      <h3 className="font-sans font-medium text-gray-900 flex items-center">
        {order.poNumber} <ChevronRight className="w-4 h-4 ml-2" />
      </h3>
      {isOverLimit && <span className="text-xs text-amber-600">Requires Executive Signature</span>}
    </div>
  );
};
```

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Update when major typescript compiler settings (`tsconfig.json`) or ESLint configurations are updated.
