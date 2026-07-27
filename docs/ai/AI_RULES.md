# AI Coding & System Rules

## Purpose
Establishes unbreakable rules and directives that AI coding models must follow when reading, modifying, or testing code in this repository.

## Scope
Enforces styling, architectural, and operational constraints.

## Unbreakable AI Directives

### 1. The Read-Before-Write Rule (MANDATORY)
* **Rule:** You are strictly forbidden from executing `edit_file` or `multi_edit_file` unless you have called `view_file` on the target code block during the current turn.
* **Why:** Prevents "target content not found" errors and minimizes generation hallucinations.

### 2. The No-Dummy-Value Rule
* **Rule:** Never generate mock or simulated data connections when a user asks to connect "my data" (e.g. "my spreadsheet", "my Gmail account"). You must implement the actual OAuth/API connection or explain the setup guide.

### 3. UI Structural Boundaries
* **Rule:** Simple feature requests (e.g., calculators, todo lists, calendars) must remain within a **single-view, single-screen structural layout**. Do not add unrequested drawers, navigation menus, or sidebars.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Review immediately upon updating ESLint rules or compiler directives.
