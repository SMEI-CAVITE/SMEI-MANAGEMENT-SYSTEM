# AI Context & Environment Guide

## Purpose
This document provides AI coding assistants with explicit context regarding the runtime environment, sandboxing limits, and developer tools of the SMEI Procurement workspace. Reading this file prevents AI models from making incorrect architectural assumptions, generating incompatible code, or trying to install unauthorized packages.

## Scope
Applies to all AI-driven file modifications, system refactoring, dependency updates, and feature integrations within this repository.

## Runtime & Sandbox Specifications
* **Port Limitation:** Port `3000` is the **only** externally accessible port. All dev servers must be configured here.
* **Server-Side Focus:** All API-key integrations (e.g., Gemini API, Firebase credentials) must remain strictly server-side (node/Express). Never expose keys to client-side bundles or `import.meta.env`.
* **Hot Module Replacement (HMR):** Disabled (`DISABLE_HMR=true`) to avoid intermediate build flickering during iterative multi-file edits.
* **Database Platform:** Firebase Firestore by default, unless SQL/PostgreSQL is explicitly requested.

## Guidelines for AI Coding Assistants
1. **Understand Intent First:** Do not build unsolicited tabs, sidebars, background queues, or database modules to "enrich" a simple layout request.
2. **Read-Modify-Write Rule:** Always call `view_file` to read the exact existing target code before applying an `edit_file` tool call.
3. **No Fake Placeholders:** When connecting to "my data" or user accounts, implement actual functional endpoints, OAuth setups, or live APIs.
4. **Desktop-First Precision with Responsive Code:** Ensure layouts do not break on small viewports but utilize fluid grid spacing (`w-full max-w-7xl mx-auto`) for wide desktop monitors.

## Best Practices
* **Surgical Edits:** Prefer small, targeted file edits over massive file rewrites to minimize merge conflicts and save tokens.
* **Linting Validation:** Run `npm run lint` or `tsc --noEmit` immediately after edits to catch unresolved type imports or syntax errors.

## Notes for AI Assistants
* You are operating on a real full-stack container running on Cloud Run.
* Do not attempt to run interactive commands that expect terminal prompts; always run non-interactive, synchronous commands.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Update this document whenever there is a major change in the runtime engine (e.g., switching Node versions or container specifications).
