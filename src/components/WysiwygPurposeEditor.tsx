/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { computePurposeFit } from "../utils/purposeAutoFit";
import { Type, AlertTriangle, Sparkles, CheckCircle2, FileSpreadsheet } from "lucide-react";

interface WysiwygPurposeEditorProps {
  id: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  error?: string;
}

export const WysiwygPurposeEditor: React.FC<WysiwygPurposeEditorProps> = ({
  id,
  value,
  disabled = false,
  onChange,
  error
}) => {
  const fit = computePurposeFit(value);

  // Position for visual safe width guide line (at ~72% container width representing ~46 weighted units)
  const safeGuidePct = "72%";

  return (
    <div className="space-y-1.5 font-sans">
      <div className="flex items-center justify-between">
        <label htmlFor={`purpose_wysiwyg_${id}`} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-700 uppercase tracking-wider">
          <Type className="w-3.5 h-3.5 text-smei-crimson" />
          <span>Payment Purpose (WYSIWYG Auto-Fit Preview)</span>
        </label>
        <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-gray-500">
          <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
          <span>Excel Export Font: <strong className="text-gray-900 font-black">{fit.fontSize} pt</strong></span>
        </span>
      </div>

      {/* Editor Container with Live Safe Width Guide */}
      <div className="relative rounded-lg border border-gray-300 bg-slate-50/60 shadow-2xs focus-within:border-smei-crimson focus-within:ring-1 focus-within:ring-smei-crimson transition-all overflow-hidden">
        {/* Visual Safe Width Line Guide */}
        <div
          className="absolute top-0 bottom-0 pointer-events-none z-10 flex flex-col items-center"
          style={{ left: safeGuidePct }}
          title="Safe Width Guide at default 11pt font"
        >
          <div className="h-full border-r-2 border-dashed border-emerald-500/50" />
          <div className="absolute top-1 -translate-x-1/2 bg-emerald-600 text-white text-[8px] font-extrabold font-mono px-1 py-0.2 rounded-xs shadow-2xs uppercase tracking-tighter opacity-80 pointer-events-none">
            Safe Width
          </div>
        </div>

        {/* Textarea with Dynamic WYSIWYG Font Scaling */}
        <textarea
          id={`purpose_wysiwyg_${id}`}
          rows={2}
          disabled={disabled}
          placeholder="e.g. MATERIALS FOR CONSTRUCTING PLANT BOX"
          className={`w-full p-3 font-mono border-0 rounded-lg bg-transparent text-gray-900 outline-none resize-y leading-relaxed transition-all duration-200 ${
            error ? "bg-rose-50/30" : ""
          }`}
          style={{
            fontFamily: "Tahoma, Geneva, Verdana, sans-serif",
            fontSize: `${fit.fontSize * 1.15}px`, // Scaled font size in CSS matching Excel font size
            fontWeight: 500
          }}
          value={value}
          onChange={(e) => {
            onChange(e.target.value.toUpperCase());
          }}
        />
      </div>

      {/* Fit & Character Status Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <div className="flex items-center gap-1.5">
          {fit.state === "NORMAL" && (
            <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
              <span>{fit.statusText}</span>
            </div>
          )}

          {fit.state === "SCALED" && (
            <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/90 px-2 py-0.5 rounded-md">
              <Sparkles className="w-3 h-3 text-amber-600 shrink-0 animate-pulse" />
              <span>{fit.statusText}</span>
            </div>
          )}

          {fit.state === "OVERFLOW" && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-50 border border-rose-300 px-2 py-0.5 rounded-md">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 animate-bounce" />
              <span>{fit.statusText}</span>
            </div>
          )}
        </div>

        <span className="text-[10px] font-mono font-medium text-gray-400">
          Target Font: <strong className="text-gray-700">{fit.fontSize} pt Tahoma</strong>
        </span>
      </div>

      {error && <p className="text-[10px] text-rose-600 font-semibold">⚠ {error}</p>}
    </div>
  );
};

export default WysiwygPurposeEditor;
