# Enterprise UI/UX & Design Standards

## 1. Design System & Styling Architecture

### 1.1 Tailwind CSS Utility Model
- All styling must be authored using Tailwind CSS utility classes.
- Do NOT create standalone `.css` files or use CSS-in-JS libraries.
- Maintain full compatibility with Light and Dark mode using Tailwind's `dark:` modifier variants (e.g., `bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100`).

### 1.2 Color Palette Principles
- Primary Brand Accent: SMEI Crimson (`text-smei-crimson`, `bg-smei-crimson`, `border-smei-crimson`).
- Sophisticated Neutrals: Use Slate/Gray scale (`bg-slate-50`, `bg-slate-900`, `border-slate-200`, `border-slate-800`) with subtle warmth/coolness. Avoid pure `#000000` or `#FFFFFF` stark contrasts.
- Semantic Status Colors:
  - **Success / Approved**: Emerald / Green (`emerald-600`, `emerald-500/10`)
  - **Warning / Pending**: Amber / Yellow (`amber-600`, `amber-500/10`)
  - **Danger / Error / Draft**: Red / Crimson (`red-600`, `red-500/10`)
  - **Info / Audit**: Indigo / Blue (`indigo-600`, `blue-600`)

---

## 2. Layout, Rhythm & Typography

### 2.1 Spatial Rhythm & Radius
- Outer container padding must equal or exceed inner element padding (minimum 16px padding on cards/panels).
- Border radius capped at 8px (`rounded-lg`) for inputs, buttons, and cards to maintain an enterprise engineering feel. High border-radius pills reserved only for status chips/badges.

### 2.2 Typographic Hierarchy
- Primary Font Stack: Inter / Plus Jakarta Sans for clean tabular readability.
- Monospace Stack: `font-mono` for all control numbers (Manifest, MRR, PIS, RFS, PO, RC numbers), quantities, monetary values, and dates.
- Single-line labels: Text inside buttons, tabs, chips, and badges must remain on ONE line without truncation or wrapping (`whitespace-nowrap`).

---

## 3. Accessibility & DOM Quality

### 3.1 Unique Element Identifiers
- Every interactive control (button, input, select, textarea, modal dialog) MUST include a clear, unique `id` attribute (e.g., `id="waste-movement-rc-no"`, `id="btn-export-excel"`).

### 3.2 Touch & Click Targets
- Interactive buttons and inputs must maintain a minimum touch/click height of 36px–40px (`h-9` or `h-10`) with hover/focus states (`focus:ring-2 focus:ring-smei-crimson/20`).
- Disallowed UI: Never use `window.alert`, `window.confirm`, or `window.prompt` which block the iframe runtime. Use in-app toast notifications or custom modal dialogs.
