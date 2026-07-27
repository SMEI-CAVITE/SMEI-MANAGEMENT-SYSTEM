# Testing & Verification Guide

## Purpose
Explains how to verify code changes, perform integration testing, run the linter, compile the applet, and validate exports.

## Scope
Applies to frontend layout testing, backend route checks, and output document validation.

## Verification Checklist

### 1. Code Validation
* Run static analysis to check for typescript compile errors:
  ```bash
  npm run lint
  ```
* Perform a production-grade compilation to guarantee bundling success:
  ```bash
  npm run build
  ```

### 2. UI & Responsive Testing
* Check form field inputs under the side-by-side split view workspace (40/60 split).
* Verify that resizing the browser or collapsing the navigation sidebar recalculates the preview scaling automatically without overlapping.

### 3. Document Fidelity Checks
* Export an Excel sheet and a Word document. Open them in local editors to confirm that all placeholders were replaced successfully with no blank spaces.
* Ensure text alignment matches exactly what is displayed in the HTML preview.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Update when Vitest, Playwright, or new integration testing tools are added to the CI pipeline.
