# Design System - SMEI Purchase Order Management System (POMS)

This document outlines the visual identity, typography, color palette, and layout principles used in the SMEI-POMS application.

## 1. Core Visual Identity

The design of SMEI-POMS is professional, high-contrast, and focused on clarity for enterprise operations. It utilizes a "Modern Industrial" aesthetic, pairing deep reds with clean grays and whites.

### Color Palette

| Category | Color Name | Hex Code | Usage |
| :--- | :--- | :--- | :--- |
| **Primary** | SMEI Dark Red | `#8B0000` | Sidebar headers, primary branding |
| **Primary** | SMEI Crimson | `#B22222` | Active states, buttons, primary accents |
| **Secondary** | SMEI Light Red | `#E57373` | Hover states, border accents |
| **Neutral** | Deep Charcoal | `#1a1a1a` | Sidebar background |
| **Neutral** | Slate Gray | `#333333` | Primary body text |
| **Neutral** | Off-White | `#fcfcfc` | Main background |
| **Status** | Success Green | `#22c55e` | "Approved" status, online indicators |
| **Status** | Alert Amber | `#f59e0b` | "Pending" states, warnings |

## 2. Typography

We use a combination of three distinct typefaces to establish hierarchy and technical feel.

*   **Primary (Sans): Inter**
    *   Used for general UI text, body content, and form labels.
    *   *Weight:* 400 (Regular), 500 (Medium), 600 (Semi-Bold).
*   **Display (Headings): Space Grotesk**
    *   Used for page titles, dashboard cards, and major section headers.
    *   Provides a tech-forward, modern enterprise aesthetic.
    *   *Tracking:* Slightly tight (`tracking-tight`) for a dense, professional look.
*   **Monospace: JetBrains Mono**
    *   Used for status indicators, PO numbers, dates, and system logs.
    *   Reinforces the "secure terminal" and "compliance" nature of the app.

## 3. Layout & Structure

The application follows a standard dashboard architecture designed for high-density information management.

*   **Left Sidebar (Navigation):**
    *   Fixed/Sticky position.
    *   Dark theme (`#1a1a1a`) to separate controls from content.
    *   Role-based menu items with clear visual feedback for active states.
*   **Header (Utility):**
    *   Contains the breadcrumbs/page title.
    *   Houses the global search (if applicable), notifications center, and user profile access.
*   **Main Content Area:**
    *   Utilizes a card-based layout (`bg-white shadow-sm border`).
    *   Generous padding (`p-6` to `p-10`) to prevent visual clutter.
    *   Responsive bento-grid patterns for dashboard statistics.

## 4. Component Standards

*   **Buttons:**
    *   Rounded corners (`rounded-xl` or `rounded-lg`).
    *   Clear hover transitions (opacity or slight color shift).
    *   Primary actions use SMEI Crimson; secondary actions use subtle gray outlines.
*   **Inputs & Forms:**
    *   Consistent focus states (`focus:ring-1.5 focus:ring-smei-crimson`).
    *   Background fill (`bg-gray-50`) to distinguish from the page background.
    *   Validation states (red borders for errors, green for success).
*   **Tables:**
    *   Clean, border-collapsed layout.
    *   Subtle row highlighting on hover.
    *   Sticky headers for long data sets (Registry, Audit Logs).

## 5. Motion & Animation

*   **Transitions:** Smooth fade-ins for route changes and modal entrances.
*   **Feedback:** Micro-interactions on button clicks and hover states using `motion/react`.
*   **Drawer:** Slide-out animations for the notification panel and mobile sidebar.

---
*Created: June 2026*
*Version: 1.0.0*
