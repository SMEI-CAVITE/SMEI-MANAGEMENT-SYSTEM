# Responsive Layout Guidelines

## Purpose
Defines standard breakpoints, fluid grid adaptations, and collapsible sidebars to keep screens stable on all sizes.

## Scope
Applies to client UI grids and relative component spacing.

## Breakpoint Adaptations (Tailwind Standard)

### 1. Small Viewports (`sm:` < 768px)
* Navigation sidebar is completely hidden; accessible only via a hamburger menu.
* List tables are locked within horizontal scroll wrappers (`overflow-x-auto`).
* Grid layouts stack vertically in single columns (`grid-cols-1`).

### 2. Large Desktop Viewports (`lg:` > 1024px)
* Main navigation sidebar is expanded or collapsed neatly to a narrow icon bar.
* Workspace displays split layouts (40% table, 60% document preview) side-by-side.
* Forms reveal extensive dual-column input rows to minimize vertical page scrolling.

## Responsive Ratio Standard
* **Directories:**
  * Left Table Column: `lg:col-span-5` (41.6% width)
  * Right Preview Column: `lg:col-span-7` (58.3% width)
* **Form Editors:**
  * Left Input Column: `lg:col-span-6`
  * Right Live Preview Column: `lg:col-span-6`

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Re-evaluate if adopting responsive CSS container queries.
