# Typography Standard

## Purpose
Defines approved font faces, tracking, size tables, and line weights to present numerical procurement and general text structures elegantly.

## Scope
Applies to all typography declarations inside global CSS and components.

## Typography Blueprint

### 1. Font Families
* **Primary Interface Font:** **Inter** (sans-serif) for high legibility, clean data labels, and general paragraphs.
* **Display Headings:** **Space Grotesk** or **Outfit** for tech-forward titles, module banners, and summary widgets.
* **Numerical / Technical Mono Font:** **JetBrains Mono** or **Fira Code** for serial digits, financial amounts, timestamps, and log lines.

### 2. Hierarchy Scale Classes
* **Primary Screen Title:** `font-sans text-2xl font-bold tracking-tight text-slate-900`.
* **Section Card Headers:** `font-sans text-base font-semibold text-slate-800`.
* **Table Column Header Label:** `font-sans text-xs font-bold uppercase tracking-wider text-slate-500`.
* **Data Cells / Amount Value:** `font-mono text-sm text-slate-700`.

## Implementation Example
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
@import "tailwindcss";

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
}
```

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Update if introducing alternative display fonts for multi-language localizations.
