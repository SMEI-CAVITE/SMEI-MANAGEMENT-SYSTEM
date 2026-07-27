# Design System Specifications

## Purpose
Defines consistent styling rules, borders, padding classes, elevations, and shadow settings to enforce visual high fidelity.

## Scope
Applies to all client-side layout files and components.

## Specifications Matrix

### 1. Border Radii & Borders
* **Cards & Directories:** Use `rounded-2xl` (16px) or `rounded-xl` (12px) for general modules.
* **Buttons / Inputs:** Use `rounded-lg` (8px).
* **Borders:** Use subtle slate borders (`border-slate-200`) or gray slate tints (`border-gray-100`) to separate tables and panels neatly. Avoid dark solid outlines.

### 2. Spacing & Grid Gap Systems
* **Main Inner Spacing:** Standardize inner padding to `p-6` or `p-8` for container panels.
* **Grid Layouts:** Use a constant `gap-6` (24px) for split-screen grid layouts.

### 3. Transition & Micro-Animations
* **Shover states:** Buttons must show transitions (`transition duration-150 ease-in-out hover:opacity-85`).
* **Sidebar Toggle:** Toggle transition animations should execute smoothly inside of a 200ms window.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Update if migrating to custom third-party design primitives or theme frameworks.
