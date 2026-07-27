# AI Workflow Blueprint

## Purpose
Provides AI assistants with a step-by-step pipeline to handle feature tickets and bug fixes systematically without introducing regressions.

## Scope
Defines the standard workflow sequence for any code change task.

## The Standard Workflow Sequence

```
1. CONTEXT AUDIT
   |  - Run list_dir and grep to identify target files.
   |  - Use view_file to inspect the target code blocks.
   v
2. INTERPOLATION PLANNING
   |  - Map necessary typescript and layout changes.
   |  - Draft a targeted plan (max 3-bullet design outline).
   v
3. SURGICAL MODIFICATION
   |  - Execute edits using edit_file or multi_edit_file tools.
   |  - NEVER rewrite complete files if surgical edits suffice.
   v
4. VERIFICATION
   |  - Run linter (npm run lint / tsc --noEmit) to catch syntax errors.
   |  - Compile the applet to verify build success.
   v
5. SUMMARY & COMPLETION
   |  - Provide a concise design-focused description of changes.
   |  - Stop calling tools to end the turn.
```

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Adjust if adopting automated CI-CD test checking.
