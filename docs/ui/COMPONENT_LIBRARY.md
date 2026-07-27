# Reusable UI Component Library

## Purpose
Catalog and standardize all reusable interface components used across different procurement pages.

## Scope
Applies to central shared component imports.

## Core Component Registry

### 1. DocumentPreview
The master document canvas that displays high-DPI mock sheets based on standard templates.
* **Props:**
  * `moduleName`: `'po' | 'pis' | 'rfs' | 'canvass'`
  * `format`: `'excel' | 'word'`
  * `data`: Dynamic document payload
* **Features:** Built-in `ResizeObserver` zoom scaling, responsive toolbar controls, page fit modes.

### 2. PageHeader
Unified header bar containing titles, tags, summaries, and action trays.
* **Props:**
  * `title`: string
  * `subtitle`: string
  * `actionButton`: ReactElement

## Best Practices
* **Keep Components Stateless:** Move data-fetching tasks to parent page layouts, leaving internal components focused strictly on rendering visual structures.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Update whenever a new reusable module is isolated and placed into `/src/components`.
