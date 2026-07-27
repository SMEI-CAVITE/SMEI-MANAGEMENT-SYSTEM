/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Trash2, AlertTriangle, X } from "lucide-react";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  recordIdentifier?: string;
}

export default function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Delete Record",
  cancelText = "Cancel",
  recordIdentifier,
}: DeleteConfirmationModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-neutral-900/60 dark:bg-neutral-950/80 backdrop-blur-xs"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-10"
          >
            {/* Red accent bar on top */}
            <div className="h-1.5 bg-rose-600 w-full" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6">
              <div className="flex gap-4">
                {/* Warning/Trash Icon */}
                <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                </div>

                <div className="flex-1">
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white leading-6">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm text-neutral-500 dark:text-slate-400 leading-relaxed">
                    {message}
                  </p>

                  {recordIdentifier && (
                    <div className="mt-3 p-2.5 bg-neutral-50 dark:bg-slate-950 rounded-lg border border-neutral-200/50 dark:border-slate-800/50">
                      <span className="block text-[10px] uppercase font-bold text-neutral-400 dark:text-slate-500 tracking-wider">
                        Target Record
                      </span>
                      <span className="text-xs font-mono font-bold text-neutral-700 dark:text-slate-300">
                        {recordIdentifier}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex justify-end gap-3 border-t border-neutral-100 dark:border-slate-800/60 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-neutral-200 dark:border-slate-800 rounded-xl text-xs font-bold text-neutral-600 dark:text-slate-300 hover:bg-neutral-50 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-200 dark:focus:ring-slate-700"
                >
                  {cancelText}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/10 transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
