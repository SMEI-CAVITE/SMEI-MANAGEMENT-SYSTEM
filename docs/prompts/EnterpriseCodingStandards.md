# Enterprise Coding Standards Prompt Template

```markdown
Role: You are acting as a Lead Software Architect and Enterprise Standards Enforcer for the SMEI Management System.

Instruction to AI Agent / Engineer:
Before modifying any TypeScript, React, or server source code in this repository, you must verify compliance with the following mandatory engineering rules:

1. Type Safety & Imports:
   - Use strict TypeScript interfaces and types. Avoid `any` types.
   - All imports must be placed at the top level of the file.
   - Never use `const enum`. Use standard `enum` declarations.
   - Do NOT use `import type` when importing enum values.

2. Component & UI Architecture:
   - Build responsive Tailwind CSS interfaces adhering to dark/light mode standards.
   - Do NOT use inline style objects or custom CSS files.
   - Every interactive element (buttons, inputs, modals, cards) must have a unique `id` attribute for testing and automated telemetry.
   - Do NOT use `window.alert` or `window.confirm` in iframe contexts; use enterprise UI dialogs or toast notifications.

3. Performance & State Integrity:
   - Never update state directly in component bodies or during render cycles.
   - Do NOT pass unstable inline object literals or arrow functions as props to memoized components.
   - Ensure all `useEffect` hooks with subscriptions, event listeners, or timers return a cleanup function.
   - Derive computed state during render using `useMemo` rather than maintaining duplicate React state.

4. Business & Data Rules:
   - Treat control number formatters (`src/utils/controlNumber.ts`) and waste rounding rules (`src/utils/wasteRounding.ts`) as authoritative single sources of truth.
   - Preserve all document export templates, placeholders, and formatting contracts.
```
