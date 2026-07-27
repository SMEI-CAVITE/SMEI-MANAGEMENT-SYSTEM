# Accessibility Standards (a11y)

## Purpose
Establishes guidelines for high contrast, keyboard focus, screen-reader tagging, and form labeling to make the system accessible to all users.

## Scope
Applies to client-side input templates and page render structures.

## Standards Checklist

### 1. Contrast Ratios (WCAG AA Compliant)
* Text overlays must meet a minimum contrast of **4.5:1** against underlying backgrounds.
* Focus borders must use distinct colored outlines (like slate-400 or amber-500) rather than subtle off-white shades.

### 2. Interactive Input Focus
* All interactive fields must declare clean `:focus` styles:
  ```tsx
  className="focus:ring-2 focus:ring-slate-400 focus:outline-none"
  ```
* Ensure users can easily navigate through form elements using sequential Tab inputs in a logical top-to-bottom, left-to-right flow.

### 3. Assistive ARIA Markups
* Use semantic buttons (`<button>`) rather than binding `onClick` listeners directly to neutral labels or div elements.
* Group table structures using proper structural headers (`<thead>`, `<th>`) and body rows (`<tbody>`).

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Revise when audit tests require full WCAG AAA certification.
