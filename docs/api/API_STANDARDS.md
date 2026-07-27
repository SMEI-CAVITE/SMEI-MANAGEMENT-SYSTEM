# REST API Coding Standards

## Purpose
Establishes rigid coding rules, method selections, and response guidelines for our web API to ensure uniform patterns.

## Scope
Applies to all backend route handler files and HTTP controller endpoints.

## Standards & HTTP Methods

### 1. HTTP Method Mappings
* **GET:** Read-only requests. Must never cause side-effects or alter collection data.
* **POST:** Create records or execute complex procedures (e.g. compiling export documents).
* **PUT:** Complete overwrite updates of existing entities.
* **PATCH:** Targeted field-level partial edits.
* **DELETE:** Remove records or toggle active status fields to false (logical delete).

### 2. Standard HTTP Status Codes
* `200 OK` - Success with returned JSON data.
* `201 Created` - Resource created successfully.
* `400 Bad Request` - Client-side validation failure.
* `401 Unauthorized` - Missing or expired session tokens.
* `403 Forbidden` - User role has insufficient access.
* `500 Internal Error` - Backend exception or database failure.

## Best Practices
* **No Raw SQL or Direct Db Exposure:** Always map, filter, or clean database entities before sending them as API payloads to protect internal fields.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Re-evaluate if migrating from standard REST to GraphQL.
