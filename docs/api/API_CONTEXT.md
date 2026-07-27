# API Context: Express REST Backend Gateway

## Purpose
Explains the structure of the backend application gateway, acting as a secure intermediary layer between our client application and external service SDKs (e.g., Gemini, Google Sheets, Firestore Admin).

## Scope
Applies to all HTTP middleware configurations, router modules, and request-routing pathways in `server.ts`.

## API Layer Architecture
All API requests must route through our Express server running on port `3000`. This fulfills critical design requirements:
1. **Secret Key Isolation:** API Keys are NEVER sent to the browser.
2. **Standardized Response Headers:** Directs CORS, content security policies, and rate-limiting rules globally.
3. **Logging & Monitoring:** Standardizes tracking of execution times and payload volumes.

## Rules & Standards
* **CORS Restrictions:** Only whitelist requests coming from our designated development or production app origins.
* **Timeout Protections:** Long-running document generation or PDF compiles must be handled asynchronously or set to fail-fast with a 30-second gateway timeout.

## Notes for AI Assistants
* Do not attempt to call external endpoints directly from client-side files (`/src`). Always write an API proxy endpoint inside `server.ts`.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Revised when upgrading Express versions or changing origin routing rules.
