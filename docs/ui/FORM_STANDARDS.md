# Form Standards & Form-Editor Guidelines

## Purpose
Establishes clear rules for form elements, layouts, validation triggers, input grids, and responsive editing setups.

## Scope
Applies to all creation and modification forms (PO, PIS, RFS, Canvass).

## Rules & Standards
* **Two-Column Input Grid:** Align long form sheets using a balanced double-column layout (`grid grid-cols-1 md:grid-cols-2 gap-4`).
* **Active Input Feedback:** Highlight focus states on text inputs utilizing soft slate blue border outlines (`focus:border-slate-400 focus:ring-1 focus:ring-slate-400`).
* **Instant Validation Alerts:** Trigger error boundaries immediately when focus leaves a field (blur) to prevent submitting incomplete files.
* **Side-by-Side Presentation:** Form inputs must sit on the left (6-cols) and the live document preview on the right (6-cols). Placing the preview under the form is strictly forbidden.

## Code Blueprint
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <div>
    <label className="block text-xs font-medium text-gray-500 mb-1">Control Number</label>
    <input 
      type="text" 
      className="w-full rounded-lg border border-gray-200 p-2 text-sm focus:border-slate-400 focus:outline-none" 
      required 
    />
  </div>
</div>
```

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Update if adopting a specialized form handling library like React Hook Form.
