# General Feature Task Template (AI Optimized)

## Purpose
Provides a structured markdown layout for writing development tickets that are optimized for rapid, error-free consumption by AI coding models.

## Scope
Applies to project manager tickets and feature requests.

## Ticket Template Blueprint

```markdown
# TASK: [Title of Feature]

## 1. Goal & Context
[Explain what needs to be built, who will use it, and why it is being implemented.]

## 2. Technical Stack & Reference Files
* **Target Files to Read:** `/src/components/MyComponent.tsx`
* **Reference Pattern File:** `/src/components/POList.tsx`

## 3. UI & Layout Specifications
* **Viewport Split:** [e.g., 40/60 split]
* **Design Standards:** Follow `/docs/ui/FORM_STANDARDS.md` and `/docs/ui/COLOR_SYSTEM.md`.

## 4. Acceptance Criteria
* [ ] Criterion 1: Form live updates instant.
* [ ] Criterion 2: Lint and compile tests build without warning.
```

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Revise when adding custom regression verify checks.
