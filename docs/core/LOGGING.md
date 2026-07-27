# Logging Guidelines

## Purpose
Defines standard logging levels, formatting, and destinations to guarantee high operational visibility while avoiding logs clutter and security leaks.

## Scope
Applies to standard console logging in the Express backend and client-side browser logs.

## Rules & Standards
* **Environments Separation:** 
  * In **Development**, print descriptive traces to help debug routing, variable states, and layout calculations.
  * In **Production**, suppress verbose debug logs. Only write structured logs for database mutations, audit logs, and critical errors.
* **No Sensitive Data Logging:** Never log user passwords, API keys, personal IDs, bank slip hashes, or session tokens to the console or log services.
* **Standard Server Tracing:** Include request method, endpoint, payload size, and duration.
  ```ts
  console.log(`[INFO] ${new Date().toISOString()} - GET /api/purchase-orders - 200 OK - 42ms`);
  ```

## Best Practices
* Use descriptive prefixes such as `[INFO]`, `[WARN]`, `[ERROR]`, or `[DEBUG]` to make logs easy to grep in server shells.

## Notes for AI Assistants
* Avoid adding console logs inside loops or hot rendering paths (such as the main canvas drawing or scale calculations) to prevent lag and console spam.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Update upon integrating structured JSON logging (Winston or Bunyan) for log analytics platforms.
