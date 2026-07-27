# AI Prompting Guide: SMEI Enterprise AI Development Standard

============================================================
PURPOSE
============================================================

This document defines the official prompting standard for the SMEI
Procurement Management System.

Its purpose is to ensure every AI-generated solution follows the
existing architecture, coding standards, UI patterns, business rules,
database design, and document template system without introducing
regressions.

This guide applies to ChatGPT, Claude, Gemini, Cursor, GitHub Copilot,
and any future AI coding assistant.

============================================================
CORE PHILOSOPHY
============================================================

AI should NEVER immediately generate code.

AI must behave like a Senior Software Engineer first.

Every request should follow this order:

1. Audit
2. Analyze
3. Explain
4. Plan
5. Implement
6. Validate

The objective is to preserve existing functionality while producing
enterprise-grade solutions.

============================================================
MASTER PROMPT STRUCTURE
============================================================

Every major development request should follow this structure.

------------------------------------------------------------
ROLE
------------------------------------------------------------

Assign the AI a professional role.

Example:

You are acting as a:

• Senior Software Architect
• Senior UI/UX Designer
• Senior React + TypeScript Engineer
• Enterprise Backend Engineer
• Firebase Architect
• Database Engineer
• QA Engineer
• Security Engineer

------------------------------------------------------------
OBJECTIVE
------------------------------------------------------------

Clearly describe the goal.

Example:

Perform a COMPLETE PROFESSIONAL AUDIT of the existing implementation,
identify every issue, determine the root cause, and refactor the system
into an enterprise-grade solution while preserving all existing
functionality.

------------------------------------------------------------
CRITICAL INSTRUCTIONS
------------------------------------------------------------

Always instruct the AI to:

• Analyze before coding
• Never rewrite the entire project
• Never introduce regression bugs
• Preserve working functionality
• Preserve UI consistency
• Follow existing architecture
• Follow existing naming conventions
• Reuse existing components
• Minimize unnecessary changes
• Perform surgical edits whenever possible

------------------------------------------------------------
PHASE 1 — ENGINEERING AUDIT
------------------------------------------------------------

Before implementing anything, the AI should audit:

• Existing architecture
• Component hierarchy
• Existing business logic
• State management
• Database interactions
• API usage
• Existing UI patterns
• Template rendering
• Export logic
• Validation logic
• Security considerations

The AI should explain:

• Current implementation
• Strengths
• Weaknesses
• Bottlenecks
• Duplicated code
• Potential risks

------------------------------------------------------------
PHASE 2 — IDENTIFY ISSUES
------------------------------------------------------------

The AI should identify:

• Root cause
• UI problems
• Performance issues
• Responsiveness issues
• Accessibility issues
• Security issues
• Maintainability concerns

The AI should explain WHY each issue exists.

------------------------------------------------------------
PHASE 3 — IMPLEMENTATION PLAN
------------------------------------------------------------

Before writing code, the AI should describe:

• Files to modify
• Components affected
• Functions affected
• Data flow changes
• Risks
• Expected outcome

Large changes should be broken into multiple implementation steps.

------------------------------------------------------------
PHASE 4 — IMPLEMENTATION
------------------------------------------------------------

When generating code:

Prefer surgical edits.

Avoid replacing entire files.

Reuse existing components.

Follow project conventions.

Avoid duplicate logic.

Maintain compatibility with existing modules.

------------------------------------------------------------
PHASE 5 — VALIDATION
------------------------------------------------------------

Before considering the task complete, verify:

✓ No existing feature is broken.

✓ Existing exports still work.

✓ CRUD operations still work.

✓ Validation still works.

✓ Authentication still works.

✓ Role permissions remain unchanged.

✓ UI consistency is preserved.

✓ No TypeScript errors.

✓ No console errors.

✓ No regression bugs.

============================================================
CONTEXT FIRST
============================================================

Every prompt should provide project context before asking for changes.

Example:

We are working on the SMEI Procurement Management System.

Technology Stack:

• React 18
• TypeScript
• Vite
• Firebase
• Tailwind CSS
• React Hook Form
• Enterprise Template Export System

The requested feature should integrate into the existing architecture.

============================================================
REFERENCE EXISTING IMPLEMENTATIONS
============================================================

Always tell the AI to reuse existing patterns.

Example:

Use the Purchase Order module as the reference implementation.

Reuse:

• Layout
• Form validation
• Live Preview
• Export workflow
• Styling
• Component structure

Do not invent new patterns unless necessary.

============================================================
SURGICAL MODIFICATIONS
============================================================

Never ask AI to regenerate an entire file unless absolutely necessary.

Instead request:

• Exact files to modify
• Exact functions to replace
• Exact JSX blocks
• Exact interfaces
• Exact hooks
• Exact imports

This reduces merge conflicts and preserves project stability.

============================================================
DEBUGGING STANDARD
============================================================

When debugging:

1. Explain the issue.

2. Identify the root cause.

3. Show where it occurs.

4. Recommend the best solution.

5. Generate only the required code.

Avoid guessing.

Base conclusions on the existing implementation.

============================================================
EXPECTED AI BEHAVIOR
============================================================

The AI should behave like an experienced senior engineer working on a
production enterprise application.

It should prioritize:

• Stability
• Maintainability
• Performance
• Scalability
• Security
• Code reuse
• Consistency
• Professional software architecture

Quick fixes, unnecessary rewrites, and speculative changes should be
avoided.

============================================================
LAST UPDATED
============================================================

July 2026

============================================================
MAINTAINER
============================================================

SMEI Procurement Management System Development Team
