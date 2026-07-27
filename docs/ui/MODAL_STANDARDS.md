# Modal Standards & Overlay Guidelines

## Purpose
Establishes standardized patterns for overlays, modal dialogue wrappers, animations, and dismissal rules.

## Scope
Applies to all creation/edit forms and informational overlay cards.

## Rules & Standards
* **Size Adaptability:** Standardize modal widths into logical classes:
  * Small Alerts: `max-w-md` (448px)
  * Standard Forms: `max-w-2xl` (720px)
  * Extensive Workspaces (e.g., Canvass Editor): `max-w-7xl` (1280px)
* **Smooth Entrance Animations:** Utilize `motion` layout cards that slide in vertically while scaling up slightly.
* **Dismissal Triggers:** All modals must close upon pressing the Escape key, clicking a visible "Close" icon button, or clicking the background overlay canvas (unless form is dirty).

## Code Blueprint
```tsx
import { motion, AnimatePresence } from "motion/react";

export const ModalWrapper: React.FC<{ isOpen: boolean, onClose: () => void, children: React.ReactNode }> = ({ isOpen, onClose, children }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-2xl overflow-hidden z-10"
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
```

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Revised if adding multi-stage checkout portals or custom sidebar drawers.
