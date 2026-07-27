# User Administration Module Spec

## Purpose
Allows system administrators to manage employee accounts, assign roles, and audit login histories.

## Scope
Tracks roles, permissions, department allocations, and authentication state.

## User Flow
1. **Auditing:** Administrator navigates to User Management directory.
2. **Add Employee:** Clicks "Register User", fills in credentials, and selects a role from `USER_ROLES.md`.
3. **Edit Status:** Deactivates user or changes department group when appropriate.

## Business & Validation Rules
* Every user must contain a unique registered email address.
* Users cannot modify their own active roles to prevent security lockouts.

## Database Usage
* Creates and updates documents in collection `users`.
* Leverages Firebase Authentication user nodes.

## UI Requirements
* Sticky headers on employee lists.
* Clear visual badges highlighting active roles (e.g. green for Admin, blue for Buyer).

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Update if integrating single-sign-on (SSO) directories.
