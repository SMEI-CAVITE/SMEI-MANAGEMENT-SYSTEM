import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Sparkles, FolderPlus, Check } from "lucide-react";
import { createNewWorkflow } from "../utils/workflowManager";
import { WorkflowRecord } from "../types/workflow";

export interface NewWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (workflow: WorkflowRecord) => void;
}

export const NewWorkflowModal: React.FC<NewWorkflowModalProps> = ({
  isOpen,
  onClose,
  onCreated
}) => {
  if (!isOpen) return null;

  const handleCreate = () => {
    try {
      const newWf = createNewWorkflow();
      if (onCreated) {
        onCreated(newWf);
      }
      onClose();
    } catch (err: any) {
      console.error("Failed to create workflow:", err);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full max-w-md bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden my-8"
        >
          {/* HEADER */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-neutral-800 bg-linear-to-r from-smei-crimson/5 via-transparent to-transparent dark:from-red-950/20">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-smei-crimson/10 dark:bg-red-900/30 border border-smei-crimson/20 flex items-center justify-center text-smei-crimson dark:text-red-400">
                <FolderPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white font-display flex items-center gap-2">
                  <span>Create COA Workflow</span>
                  <span className="px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold bg-amber-600 text-white rounded-full">
                    Draft
                  </span>
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-neutral-400">
                  Container for standard compliance documents
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4 text-center">
            <div className="p-4 bg-slate-50 dark:bg-neutral-800/60 rounded-xl border border-slate-200 dark:border-neutral-700/80 space-y-2 text-xs text-left">
              <p className="font-semibold text-slate-700 dark:text-neutral-300">
                Initialize a new draft COA Workflow?
              </p>
              <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                An official sequential Workflow ID (e.g. WF-2026-XXXXXX) will be generated automatically as soon as you save the first document.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                className="px-4 py-2 bg-smei-crimson hover:bg-smei-darkred text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Start Draft Workflow</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default NewWorkflowModal;
