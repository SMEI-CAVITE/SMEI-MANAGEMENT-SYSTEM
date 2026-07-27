# AI Engine Limitations & Guardrails

## Purpose
Documents known bottlenecks and limitations of AI models (such as context window cutoff, visual positioning math, and package installation patterns), offering reliable engineering workarounds.

## Scope
Applies to system-level planning and large-scale refactoring tasks.

## Limitations & Workarounds

### 1. Complex Canvas Layout Calculation
* **Limitation:** LLMs frequently fail at calculating absolute HTML canvas rendering sizes or PDF grid math, leading to clipped pages or layout overlaps.
* **Workaround:** Always utilize container-based auto-scaling logic (`ResizeObserver` or flexible CSS ratios like `h-[calc(100vh-280px)]`) instead of hardcoded calculations like `window.innerWidth - 300`.

### 2. Module Consolidating cutoff
* **Limitation:** Combining extensive logic into a single flat file (e.g., putting all forms and lists into `App.tsx`) triggers context limits and cut-off code blocks.
* **Workaround:** Strictly enforce modular folder trees. Separate types early (`src/types.ts`) and isolate sub-views immediately.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Re-evaluate as local context sizes and compiler capabilities expand.
