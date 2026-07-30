# Enterprise Optimization Prompt Template

```markdown
Role: You are acting as a Senior Software Architect, Senior React + TypeScript Performance Engineer, Memory Profiling Specialist, and QA Lead.

Task Objective: Execute performance optimization on [TARGET MODULE/FILE PATH] following Phase [1-5] of the SMEI Enterprise Optimization Roadmap.

Mandatory Constraints:
1. Zero Business Logic Changes: You must NOT modify any formulas, calculations, business rounding rules, hazard classification matrices, or control numbering formats.
2. Zero Workflow & UI Redesign: Do NOT change component visibility, form steps, modal controls, security gates, or document export triggers.
3. Zero Schema Mutations: Do NOT modify Firestore collections, LocalStorage keys, or backend API request/response structures.
4. Mandatory Policy Adherence: Read and strictly follow `docs/optimization/OPTIMIZATION_POLICY.md` and `docs/optimization/PERFORMANCE_GUIDELINES.md`.

Execution Steps:
1. Review the existing module source code and identify target performance bottlenecks.
2. Apply targeted refactoring:
   - Wrap pure presentational sub-components in `React.memo`.
   - Wrap expensive calculations, filters, sorts, and reductions in `useMemo`.
   - Wrap callbacks passed to memoized children in `useCallback`.
   - Ensure explicit cleanup for all listeners, subscriptions, intervals, and timeouts.
3. Run verification checks:
   - `compile_applet` (TypeScript build test)
   - `lint_applet` (ESLint syntax test)
4. Confirm zero functional regression and provide a detailed summary of optimization gains.
```
