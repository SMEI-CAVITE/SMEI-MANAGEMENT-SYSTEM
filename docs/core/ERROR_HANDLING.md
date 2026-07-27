# Error Handling Strategy

## Purpose
Defines standard patterns for identifying, catching, reporting, and logging errors gracefully across the client and server.

## Scope
Covers user-facing client errors, form validation, and server-side backend request failures.

## Standards & Patterns

### 1. Client-Side Error Boundaries & UI Warnings
* **Interactive Forms:** Show user-friendly inline error states next to input boxes using clear Tailwind red colors (`text-rose-600 bg-rose-50`).
* **API Failures:** Utilize toast notifications or temporary alert bars to describe network outages without freezing or crashing the browser.

### 2. Server-Side Async Exception Handling
* **Standard Async/Await Try-Catch:** Every async Express route handler must be enclosed in a `try/catch` block.
* **Consolidated Error Payload:** All server errors returned to the client must use a standardized JSON structure:
  ```json
  {
    "error": "Short, human-readable error description",
    "details": "Detailed technical information (only available in development mode)"
  }
  ```

## Best Practices
* **No Quiet Swallowing:** Never leave a catch block completely empty (e.g. `catch(err) {}`). Always log the error or propagate it cleanly.
* **Graceful Degradation:** If the document preview engine fails, do not block the underlying form from being saved.

## Notes for AI Assistants
* In Express v5, route handlers automatically catch async errors, but for robustness, explicitly catch errors to return proper HTTP status codes (`400 Bad Request`, `401 Unauthorized`, `500 Internal Server Error`).

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Update if integrating a global error monitoring tool like Sentry.
