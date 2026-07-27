# Color System Reference

## Purpose
Establishes approved color schemes, status shades, text classes, and background fills to maintain high-contrast legibility.

## Scope
Applies to all CSS classifications and Tailwind styles in our client views.

## Theme Color Matrix

### 1. Core Neutral Workspace
* **Main Canvas Background:** `bg-slate-50` (soft, light gray-blue background to minimize eye fatigue).
* **Card Panels / Forms:** `bg-white` (pure white to form clear container elevations).
* **Separators / Borders:** `border-slate-200` or `border-gray-100`.

### 2. Typographic Hierarchies
* **Primary Headers:** `text-slate-900` or `text-gray-900` (deep charcoal-slate, almost black).
* **Body / Content Labels:** `text-slate-600` or `text-gray-600`.
* **Secondary Metadata:** `text-slate-400` or `text-gray-400`.

### 3. State & Status Contexts
* **Draft / Unsubmitted:** Neutral gray (`bg-slate-100 text-slate-700`).
* **Pending Approval / In-Review:** Warn amber (`bg-amber-50 text-amber-700 border-amber-200`).
* **Approved / Paid / Completed:** Success green (`bg-emerald-50 text-emerald-700 border-emerald-200`).
* **Rejected / Failed / Over-Limit:** Alert red (`bg-rose-50 text-rose-700 border-rose-200`).

## Notes for AI Assistants
* Do not introduce arbitrary brand colors (e.g. royal purple or neon pink) unless explicitly requested. Maintain our cohesive slate-blue theme.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Must be updated if integrating customized dark theme classes (`dark:` prefix).
