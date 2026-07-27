# Changelog: SMEI Procurement System

## Purpose
Tracks all significant additions, layout modifications, and system refactoring executed on the Procurement Management System to help maintain a clear history for human and AI developers.

## Scope
Tracks major version milestones, UI/UX changes, database schema updates, and dependency adjustments.

## Version History

### [v1.2.0] - 2026-07-06
#### Added
* Implemented automatic event handlers (`smei-editor-opened` and `smei-editor-closed`) to dynamically collapse the navigation sidebar into icon-only mode when entering or leaving document forms, maximizing usable workspace.

#### Changed
* **Enterprise Live Preview Layout:** Completely refactored the layout structure of PO, PIS, RFS, and Canvass directories into professional split-screen workspaces (40% list table, 60% high-DPI live preview).
* **Auto-Scaling Canvas:** Integrated a container-based `ResizeObserver` inside `DocumentPreview.tsx` to automatically calculate the optimal scale zoom upon sidebar toggle or window resize events.
* **Sticky Table Headers:** Enabled sticky headers for all document list tables to prevent losing layout context when scrolling through extensive data records.

### [v1.1.0] - 2026-06-15
#### Added
* Initial setup of full-stack Express + Vite pipeline.
* Configured ExcelJS template engine for Canvass sheet and PO lists.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Update this file whenever a feature release, bug fix, or refactoring batch is compiled.
