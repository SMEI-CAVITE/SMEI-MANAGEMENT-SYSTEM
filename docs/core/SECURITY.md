# Security Protocol

## Purpose
Documents the security architecture, data protection mechanisms, and authorization layers built to safeguard enterprise procurement data.

## Scope
Covers authentication, Firestore database security rules, transit protection, and server-side secret management.

## Security Controls

### 1. Database Rule Hardening (Firestore)
* **Principle of Least Privilege:** Users can only query documents belonging to their role group or department.
* **Read-Only Lock:** Approved Purchase Orders (`status === "Approved"`) are non-writable in Firestore. Only system admins can alter active logs.

### 2. Secret Protection (Server-Side Keys)
* **Zero Client Keys:** The Gemini API key and Firebase Admin credentials must remain server-side. No React bundle should ever contain a secret.
* **Vite Prefix Enforcement:** Only prefix safe public variables (like GA tracking IDs) with `VITE_`. All other keys remain plain env fields.

### 3. API Input Validation
* **XSS Protection:** Sanitize all text fields before converting form inputs into live preview HTML tables.
* **No eval() or raw scripts:** Executing arbitrary input script blocks inside templates is strictly forbidden.

## Notes for AI Assistants
* When generating database modification operations, verify if the current user profile has the required role permissions as documented in `USER_ROLES.md`.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** This document must be revised and re-certified whenever Firestore security rules (`firestore.rules`) are deployed.
