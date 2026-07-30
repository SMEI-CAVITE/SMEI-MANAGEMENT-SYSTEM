import React from "react";
import { formatControlNumber, validateControlNumber } from "../utils/controlNumber";
import { AlertCircle } from "lucide-react";

export interface RcNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  helperText?: string;
  showError?: boolean;
  errorMessage?: string;
  className?: string;
  id?: string;
}

export const RcNumberInput: React.FC<RcNumberInputProps> = ({
  value,
  onChange,
  required = true,
  disabled = false,
  label = "Recycle Cert No.",
  placeholder = "e.g. R-123",
  helperText,
  showError,
  errorMessage,
  className = "",
  id = "rc-number-input"
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatControlNumber(e.target.value, "rcNumber");
    onChange(formatted);
  };

  const validation = value && value !== "N/A" ? validateControlNumber(value, "rcNumber") : { isValid: true, error: "" };
  const hasError = showError !== undefined ? showError : (!validation.isValid && value.length > 2);
  const displayError = errorMessage || validation.error || "Invalid Recycle Cert No. Expected format: R-123 (e.g., R-932, R-15402).";

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {label} {required && <span className="text-smei-crimson">*</span>}
        </label>
      )}
      <input
        id={id}
        type="text"
        required={required && !disabled}
        disabled={disabled}
        value={disabled ? "N/A" : value}
        onChange={handleChange}
        placeholder={disabled ? "N/A" : placeholder}
        className={`w-full h-9 bg-white dark:bg-slate-900 border rounded-lg text-xs px-3 focus:outline-none font-mono uppercase transition-all shadow-xs ${
          disabled
            ? "bg-gray-100 dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-gray-400 cursor-not-allowed select-none"
            : hasError
            ? "border-red-500 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-red-900 dark:text-red-200"
            : "border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-smei-crimson/20 focus:border-smei-crimson text-slate-800 dark:text-slate-100"
        } ${className}`}
      />
      {disabled && helperText && (
        <p className="text-[10px] text-gray-400 dark:text-slate-500 italic mt-1">{helperText}</p>
      )}
      {!disabled && hasError && (
        <p className="text-[10px] text-red-600 dark:text-red-400 font-semibold mt-1 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
          <span>{displayError}</span>
        </p>
      )}
      {!disabled && !hasError && helperText && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">{helperText}</p>
      )}
    </div>
  );
};

export default RcNumberInput;
