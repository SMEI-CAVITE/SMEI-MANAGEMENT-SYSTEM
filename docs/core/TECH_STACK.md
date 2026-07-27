# Tech Stack Blueprint

## Purpose
This document catalogs the approved languages, frameworks, libraries, and utilities that form the technology foundation of the Procurement Management System.

## Scope
Applies to both production dependencies and development tools. No unlisted core libraries may be added without prior approval.

## Technology Breakdown

### Client-Side Stack
| Dependency | Version | Purpose |
| :--- | :--- | :--- |
| **React** | 18+ | Progressive user interface library |
| **Vite** | 5+ | Fast frontend toolchain and dev server |
| **Tailwind CSS** | 4+ | Main CSS framework for rapid UI styling |
| **Lucide React** | Latest | Unified iconography set |
| **Recharts** | Latest | Lightweight D3-based charting and reports |
| **Motion** | Latest | Staggered entrance, zoom, and sidebar animations |

### Server-Side Stack
| Dependency | Version | Purpose |
| :--- | :--- | :--- |
| **Node.js** | 20+ | Backend javascript runtime environment |
| **Express** | 5+ | Micro-framework for server routers and middlewares |
| **@google/genai** | Latest | Next-gen official SDK for server-side Gemini integration |
| **ExcelJS** | Latest | Direct generation and streaming of XLSX workbooks |
| **docxtemplater** | Latest | High-fidelity Word document generation |

### Persistence & Auth
| Service | Purpose |
| :--- | :--- |
| **Firebase Auth** | Multi-role user authentication and session management |
| **Cloud Firestore** | NoSQL document storage for procurement items and logs |

## Rules & Standards
* **No Unsolicited SDKs:** Do not import third-party styling libraries, bootstrap, material-ui, or client-side Google SDKs. Stick exclusively to Tailwind and Lucide icons.
* **Native Type Stripping:** Utilize Node's native typescript execution in dev mode; compile production bundles to CJS format using esbuild.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Must be updated whenever a dependency is upgraded, deprecated, or added to `package.json`.
