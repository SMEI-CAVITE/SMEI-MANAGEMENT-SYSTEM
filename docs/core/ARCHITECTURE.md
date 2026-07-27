# Architecture Document: Procurement Management System

## Purpose
This document defines the high-level system architecture, data flow patterns, and deployment boundaries of the Procurement Management System, establishing a shared blueprint for engineers and AI developers.

## Scope
Covers the full-stack architecture of the application, including client-side views, backend express servers, external AI proxies, and document generation modules.

## Architecture Model
The system uses a **Full-Stack Single Page Application (SPA)** with a lightweight backend proxy.

```
       +---------------------------------------------+
       |                  CLIENT                     |
       |  React 18 + Vite SPA (Lucide, Tailwind)     |
       |  Interactive Forms & Dynamic Live Previews  |
       +---------------------------------------------+
                              |
                     HTTPS REST Requests
                              v
       +---------------------------------------------+
       |                  BACKEND                    |
       |  Express Router Node.js (hosted on CJS)     |
       |  Endpoints: API, AI Proxy, Export Generation|
       +---------------------------------------------+
            |                    |                |
            v                    v                v
     +------------+        +-----------+    +-------------+
     | Firebase   |        | Gemini API|    | ExcelJS /   |
     | Firestore  |        | Proxy     |    | docxtemplar |
     | (Storage)  |        | (AI-Logic)|    | (Templates) |
     +------------+        +-----------+    +-------------+
```

## Architectural Decoupling Rules
1. **Client-Side Autonomy:** The client handles form state, live dynamic calculations, interactive spreadsheet rendering, and scale calculations.
2. **Server API Proxies:** No direct client connection to external APIs (e.g. Gemini, Mailgun). The Express server acts as the secure gatekeeper.
3. **Stateless Template Generation:** All exports (Word/Excel) are generated on-the-fly based on request payloads. The server does not store files locally on Disk; it streams them back as buffers.

## Best Practices
* **Keep API Layers Thin:** Move business logic into reusable service files (`/src/utils/` and `/src/services/`) instead of bundling it inside Express route files or React components.
* **Resilient Connection Handling:** Use connection pools, lazy SDK clients, and auto-retry policies with exponential backoff for cloud APIs.

## Notes for AI Assistants
* Do not bypass the `/api/*` middleware routes. Every request needing external tokens must route through the Express app server.
* Ensure type structures in `src/types.ts` correspond exactly to database fields and schema mappings.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** This document should be updated upon introducing a message broker, real-time WebSockets, or a relational SQL database.
