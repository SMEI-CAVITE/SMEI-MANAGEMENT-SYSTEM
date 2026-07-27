# Deployment & Compilation Guide

## Purpose
Explains the production build process, container start triggers, and server bundler settings.

## Scope
Covers compile scripts in `package.json`, environment configurations, and server distribution bundles.

## Production Build & Run Workflow

### 1. Build Phase (`npm run build`)
The production build compiles the frontend static files and packages the backend Express server into a compiled CommonJS output.
* **Client Build:** Vite processes TypeScript assets, builds the SPA bundle, and places static HTML/JS inside `/dist`.
* **Server Build:** esbuild compiles `server.ts` into a self-contained bundle at `/dist/server.cjs` with `--platform=node` and `--packages=external`. This prevents ESM path resolution bugs at container runtime.

### 2. Production Start Phase (`npm run start`)
* The hosting environment launches the compiled server directly:
  ```bash
  node dist/server.cjs
  ```
* Host is configured to `0.0.0.0` and port to `3000` to handle external proxy ingress routing.

## Notes for AI Assistants
* Never add customized build steps outside the standard `"build"` script inside `package.json`.
* Do not introduce assets outside `/src` that are required by the client, as they will be omitted from the static compiler dist output.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Update this document if the production container environment or port requirements change.
