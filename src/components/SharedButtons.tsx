import React from "react";
import { FileSpreadsheet, Plus, FileText, Printer } from "lucide-react";

interface ButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function ExportExcelButton({ 
  onClick, 
  disabled 
}: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-sm font-semibold h-[38px] px-4 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all whitespace-nowrap flex-shrink-0 w-full sm:w-auto ${
        disabled
          ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
          : "bg-emerald-600 hover:bg-emerald-700 text-white hover:scale-[1.02] active:scale-95 cursor-pointer shadow-[0_2px_8px_rgba(16,185,129,0.15)]"
      }`}
    >
      <FileSpreadsheet className="w-4 h-4" />
      <span>Export Excel</span>
    </button>
  );
}

export function ExportWordButton({ 
  onClick, 
  disabled, 
  label = "Export Word"
}: ButtonProps & { label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-sm font-semibold h-[38px] px-4 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all whitespace-nowrap flex-shrink-0 w-full sm:w-auto ${
        disabled
          ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
          : "bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-[1.02] active:scale-95 cursor-pointer shadow-[0_2px_8px_rgba(79,70,229,0.15)]"
      }`}
    >
      <FileText className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}

export function CreateButton({ 
  onClick, 
  label 
}: { 
  onClick: () => void; 
  label: string; 
}) {
  return (
    <button
      onClick={onClick}
      className="bg-smei-crimson hover:bg-smei-darkred text-white text-sm font-semibold h-[38px] px-4 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all hover:scale-[1.02] active:scale-95 whitespace-nowrap flex-shrink-0 w-full sm:w-auto cursor-pointer"
    >
      <Plus className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}

export function ExportPdfButton({ 
  onClick, 
  disabled 
}: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-sm font-semibold h-[38px] px-4 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all whitespace-nowrap flex-shrink-0 w-full sm:w-auto ${
        disabled
          ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
          : "bg-red-600 hover:bg-red-700 text-white hover:scale-[1.02] active:scale-95 cursor-pointer shadow-[0_2px_8px_rgba(220,38,38,0.15)]"
      }`}
    >
      <Printer className="w-4 h-4" />
      <span>Print / PDF</span>
    </button>
  );
}
