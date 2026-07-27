<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# SMEI Procurement Management System

Welcome to the SMEI Procurement Management System codebase. This repository contains the full-stack system supporting end-to-end supply requisitions (RFS), quotations comparisons, Purchase Orders (PO) generation, and Payment Instruction Slips (PIS).

---

## 📚 Central Documentation Portal
To maintain professional high-fidelity and allow AI coding engines to work perfectly in this repository, we have established a complete modular documentation system. 

### 1. [Core Documentation](./docs/core/)
High-level system parameters, standards, and histories.
* [Project Overview](./docs/core/PROJECT_OVERVIEW.md) — Main business objectives and core processes.
* [AI Context Guide](./docs/core/AI_CONTEXT.md) — Sandbox environment constraints and port guidelines.
* [System Architecture](./docs/core/ARCHITECTURE.md) — Client-Server proxy architecture.
* [Tech Stack](./docs/core/TECH_STACK.md) — Approved languages, libraries, and frameworks.
* [Folder Structure](./docs/core/FOLDER_STRUCTURE.md) — standard repository directories and rules.
* [Coding Standards](./docs/core/CODING_STANDARDS.md) — TypeScript type safety and React patterns.
* [Naming Conventions](./docs/core/NAMING_CONVENTIONS.md) — Variable, file, and database field standards.
* [Error Handling](./docs/core/ERROR_HANDLING.md) — Client toasts, inline alerts, and Server error routers.
* [Logging Guidelines](./docs/core/LOGGING.md) — Server trace schemas and security rules.
* [Security Protocol](./docs/core/SECURITY.md) — Auth credentials, secret variables, and database locks.
* [Testing & Verification](./docs/core/TESTING.md) — Build checking, linter tests, and output verification.
* [Deployment Guide](./docs/core/DEPLOYMENT.md) — Production esbuild compiling and container triggers.
* [System Changelog](./docs/core/CHANGELOG.md) — Complete release history.

### 2. [Database Documentation](./docs/database/)
Firestore storage, model, and safety setups.
* [Database Context](./docs/database/DATABASE_CONTEXT.md) — Firestore philosophy and indexing rules.
* [Database Schema](./docs/database/DATABASE_SCHEMA.md) — Complete fields, types, and defaults map.
* [Entity Relationships](./docs/database/TABLE_RELATIONSHIPS.md) — Logical cascade rules and link paths.
* [Schema Migrations](./docs/database/MIGRATIONS.md) — Database seeding and custom index compiling.
* [Firestore Security Rules](./docs/database/DATABASE_RULES.md) — Write locks and security rule blueprints.

### 3. [API Documentation](./docs/api/)
Backend server routing and data specifications.
* [API Context](./docs/api/API_CONTEXT.md) — Server port parameters and client gateway middlewares.
* [API Coding Standards](./docs/api/API_STANDARDS.md) — REST method mappings and HTTP status codes.
* [Endpoint Design](./docs/api/ENDPOINT_GUIDELINES.md) — Development pipeline for creating new endpoints.
* [Request-Response Formats](./docs/api/REQUEST_RESPONSE_FORMAT.md) — Schema payloads, filters, and paginations.
* [Route Authentication](./docs/api/AUTHENTICATION.md) — JWT verify hooks and role authorization checks.

### 4. [UI & Design Documentation](./docs/ui/)
Design elements, interactive panels, and responsive grids.
* [UI Context](./docs/ui/UI_CONTEXT.md) — Split directory interfaces and sidebar triggers.
* [Design System Spec](./docs/ui/DESIGN_SYSTEM.md) — Spacing matrix, corners, borders, and shadows.
* [Component Library](./docs/ui/COMPONENT_LIBRARY.md) — Shared document rendering canvas specs.
* [Layout Blueprints](./docs/ui/LAYOUT_GUIDELINES.md) — CSS grids and side-by-side forms.
* [Form Standards](./docs/ui/FORM_STANDARDS.md) — Two-column layouts and field validations.
* [Table Standards](./docs/ui/TABLE_STANDARDS.md) — Sticky list headers and responsive rows.
* [Modal Standards](./docs/ui/MODAL_STANDARDS.md) — Overlay sizing, transitions, and dismissals.
* [Color System](./docs/ui/COLOR_SYSTEM.md) — Neutral canvas shades and role status colors.
* [Typography Guidelines](./docs/ui/TYPOGRAPHY.md) — Approved fonts, weights, and display scales.
* [Responsive Breakpoints](./docs/ui/RESPONSIVE_GUIDELINES.md) — Breakpoint configurations and responsive ratios.
* [Accessibility Standards](./docs/ui/ACCESSIBILITY.md) — WCAG contrast limits and focus guidelines.

### 5. [Business Logic Documentation](./docs/business/)
Corporate procurement regulations and document lifecycles.
* [Procurement Business Rules](./docs/business/BUSINESS_RULES.md) — Multi-supplier canvassing rules.
* [Lifecycle Workflows](./docs/business/WORKFLOWS.md) — End-to-end sequential procurement pipelines.
* [User Roles](./docs/business/USER_ROLES.md) — Employee responsibilities matrix.
* [Permission Mapping](./docs/business/PERMISSIONS.md) — Role access keys.
* [Input Verifications](./docs/business/VALIDATION_RULES.md) — Numeric field bounds and price limits.
* [Document Status Flow](./docs/business/STATUS_FLOW.md) — Lifecycles for POs and RFS requests.

### 6. [Application Modules Specification](./docs/modules/)
Detailed specs for active screens and files.
* [Purchase Orders (PO)](./docs/modules/PO.md) — PO split directories and Word exporters.
* [Payment Instructions (PIS)](./docs/modules/PIS.md) — Finance disbursements.
* [Request For Supply (RFS)](./docs/modules/RFS.md) — Department requisitions and approvals.
* [Supplier Directory](./docs/modules/SUPPLIER.md) — Vendor profiles and bank registries.
* [Canvass Sheets](./docs/modules/CANVASS.md) — Bidding comparative sheets.
* [Reports & Analytics](./docs/modules/REPORTS.md) — Recharts spending analytics.
* [System Settings](./docs/modules/SETTINGS.md) — App settings and template uploading.
* [Users Administration](./docs/modules/USERS.md) — Employee registers and auth profiles.
* [Main Portal Dashboard](./docs/modules/DASHBOARD.md) — Action logs and user metrics bento.

### 7. [AI & Prompting Documentation](./docs/ai/)
Guides and templates designed to streamline AI programming tasks.
* [AI Prompting Guide](./docs/ai/PROMPTING_GUIDE.md) — Optimizing prompts.
* [AI Coding Rules](./docs/ai/AI_RULES.md) — System guardrails and directives.
* [Limitations & Workarounds](./docs/ai/AI_LIMITATIONS.md) — Visual and file-length workarounds.
* [AI Workflow Blueprint](./docs/ai/AI_WORKFLOW.md) — Sequential ticket pipeline.
* [General Task Template](./docs/ai/TASK_TEMPLATE.md) — Structured feature issues.
* [Bug Report Template](./docs/ai/BUG_REPORT_TEMPLATE.md) — Clean bug reports.
* [Feature Request Template](./docs/ai/FEATURE_REQUEST_TEMPLATE.md) — Feature expansion specs.

---

## 🚀 Run Locally

### Prerequisites
* [Node.js](https://nodejs.org/) (Version 20+)

### Setup Instructions
1. **Install required dependencies:**
   ```bash
   npm install
   ```
2. **Configure local environment parameters:**
   Set the `GEMINI_API_KEY` inside `.env.local` to active API credentials.
3. **Launch the development workspace:**
   ```bash
   npm run dev
   ```
