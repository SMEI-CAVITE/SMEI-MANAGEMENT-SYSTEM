# Table Standards & Listing Guidelines

## Purpose
Standardizes listing grids, pagination trays, search actions, cell spacing, and sticky table header layouts.

## Scope
Applies to all list tables inside the directory view.

## Table Architecture Standards
To maintain clarity when lists exceed 50+ lines:
1. **Sticky Header Enforcement:** All table headers (`thead`) must contain sticky properties (`sticky top-0 bg-white z-10 shadow-sm`) so the user never loses column contexts while scrolling.
2. **Unified Actions Placement:** Actions (edit, view, delete, export) must always reside in the last right-aligned column.
3. **Responsive Scrolling:** Wrap the table tag inside an overflow container (`overflow-x-auto`) to protect narrow monitor resolutions.

## Code Blueprint
```tsx
<div className="overflow-x-auto flex-1 overflow-y-auto">
  <table className="w-full text-left border-collapse">
    <thead className="sticky top-0 bg-white z-10 shadow-sm">
      <tr className="border-b border-gray-100 text-xs font-bold uppercase tracking-wider text-gray-500">
        <th className="py-4 px-6">Doc ID</th>
        <th className="py-4 px-6 text-right">Actions</th>
      </tr>
    </thead>
    <tbody>
      {/* Dynamic Rows */}
    </tbody>
  </table>
</div>
```

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Update if implementing custom column drag-and-drop or advanced search aggregations.
