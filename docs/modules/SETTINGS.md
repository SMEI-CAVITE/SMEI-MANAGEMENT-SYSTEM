# System Settings Module Spec

## Purpose
Enables administrators to adjust application configurations, default transaction rules, system currencies, and notification emails.

## Features
* **Threshold Adjuster:** Sliders and inputs to alter maximum buyer spending limits.
* **Template Manager:** Controls standard Word (.docx) and Excel (.xlsx) templates stored in the backend.
* **Notification Toggles:** Multi-switch toggles for active email alerts.

## User Flow
1. **Configuration:** Admins open Settings and toggle preferred transaction parameters.
2. **Template Upload:** Drag and drop new corporate Word sheets into the template mapper.
3. **Save System Options:** Save parameters globally to Firestore caches.

## Business & Validation Rules
* Only system administrators can read or write setting variables.
* Threshold limits must be positive non-zero figures.

## Database Usage
* Reads and writes to collection `appSettings`.

## UI Requirements
* Card components with clear Tailwind form standards.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Revised upon adding new multi-stage server hooks or notification templates.
