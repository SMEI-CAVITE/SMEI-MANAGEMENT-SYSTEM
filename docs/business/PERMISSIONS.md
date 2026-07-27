# Permission Mappings Table

## Purpose
Maps individual system actions, database collections, and views to specific user roles to ensure authorization integrity.

## Scope
Applies to both client router guards and server route middleware filters.

## Access Rights Matrix

| Action / Collection | Requestor | Buyer | Approver | Disburser | Admin |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **RFS Collection** | Create / Edit (Own) | Read | Create / Approve | Read | Full Access |
| **Canvass Sheet Collection** | No Access | Create / Edit | Read | No Access | Full Access |
| **PO Collection** | No Access | Create / Edit | Approve | Read | Full Access |
| **PIS Collection** | No Access | Read | Read | Create / Disburse | Full Access |
| **Users / Settings** | No Access | No Access | No Access | No Access | Full Access |

## Implementation Guidelines
* **Client-Side:** Protect navigation links using a high-level authorization router check.
* **Server-Side:** Block unauthorized request payloads with role-matching filters (see `/docs/api/AUTHENTICATION.md`).

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** This table must be modified immediately if permission levels are updated.
