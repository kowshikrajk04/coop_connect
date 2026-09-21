"use client";

import React, { useRef, useState, useEffect } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, X } from "lucide-react";

export interface DocumentUploadProps {
  id: string;
  label?: string;
  required?: boolean;
  hintText?: string;
  accept?: string;
  value?: File | null;
  onChange: (file: File | null) => void;
  error?: string;
  onErrorChange?: (error: string) => void;
  accentColor?: "indigo" | "emerald" | "blue";
  helperText?: string;
}

const DEFAULT_ACCEPTED = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
const ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"];
const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];

export default function DocumentUpload({
  id,
  label,
  required = false,
  hintText = "Click anywhere here to browse local files (PDF, JPG, JPEG, PNG)",
  accept = DEFAULT_ACCEPTED,
  value = null,
  onChange,
  error = "",
  onErrorChange,
  accentColor = "indigo",
  helperText,
}: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalError, setInternalError] = useState("");

  const displayError = error || internalError;

  const triggerFilePicker = (e: React.MouseEvent) => {
    e.preventDefault();
    if (inputRef.current) {
      // Clear value so the same file can be picked again if desired
      inputRef.current.value = "";
      inputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setInternalError("");
    if (onErrorChange) onErrorChange("");

    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const isExtValid = ALLOWED_EXTENSIONS.includes(ext);
    const isMimeValid = !file.type || ALLOWED_MIME_TYPES.includes(file.type.toLowerCase());

    if (!isExtValid || !isMimeValid) {
      const msg = "Unsupported file type. Please upload a valid PDF, JPG, JPEG, or PNG document.";
      setInternalError(msg);
      if (onErrorChange) onErrorChange(msg);
      onChange(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    onChange(file);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setInternalError("");
    if (onErrorChange) onErrorChange("");
    onChange(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  // Color schemes
  const colorThemes = {
    indigo: {
      borderHover: "hover:border-indigo-400 hover:bg-indigo-50/30",
      iconBg: "bg-indigo-50 text-indigo-600",
      activeBorder: "border-indigo-400 bg-indigo-50/40",
      btnFocus: "focus:ring-indigo-500",
    },
    emerald: {
      borderHover: "hover:border-emerald-400 hover:bg-emerald-50/30",
      iconBg: "bg-emerald-50 text-emerald-600",
      activeBorder: "border-emerald-400 bg-emerald-50/40",
      btnFocus: "focus:ring-emerald-500",
    },
    blue: {
      borderHover: "hover:border-blue-400 hover:bg-blue-50/30",
      iconBg: "bg-blue-50 text-blue-600",
      activeBorder: "border-blue-400 bg-blue-50/40",
      btnFocus: "focus:ring-blue-500",
    },
  };

  const theme = colorThemes[accentColor] || colorThemes.indigo;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-sm font-semibold text-gray-700 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Real HTML <input type="file"> */}
      <input
        ref={inputRef}
        type="file"
        id={id}
        name={id}
        accept={accept}
        className="sr-only"
        onChange={handleFileChange}
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Clickable upload area that opens File Explorer */}
      <div
        role="button"
        tabIndex={0}
        onClick={triggerFilePicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            triggerFilePicker(e as any);
          }
        }}
        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition select-none ${
          displayError
            ? "border-red-300 bg-red-50/40 hover:bg-red-50/70"
            : value
            ? "border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50"
            : `border-gray-300 ${theme.borderHover} hover:bg-gray-50/60`
        }`}
      >
        {value ? (
          <div className="flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2 max-w-full px-2">
              <FileText className="w-4 h-4 text-emerald-700 flex-shrink-0" />
              <span className="text-sm font-semibold text-gray-900 truncate max-w-xs sm:max-w-sm">
                {value.name}
              </span>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                ({(value.size / 1024).toFixed(1)} KB)
              </span>
              <button
                type="button"
                onClick={handleClear}
                title="Remove selected file"
                aria-label="Remove selected file"
                className="p-1 rounded-full text-gray-400 hover:text-red-600 hover:bg-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <span className="text-xs text-emerald-700 font-medium mt-1">
              Document attached ✓ — Click anywhere to change file
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div className={`w-10 h-10 rounded-xl ${theme.iconBg} flex items-center justify-center mb-2`}>
              <Upload className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-gray-700 block">
              {label ? `Select ${label}` : "Upload Document"}
            </span>
            <span className="text-xs text-gray-500 mt-0.5 block">{hintText}</span>
          </div>
        )}
      </div>

      {helperText && !displayError && (
        <p className="mt-1 text-xs text-gray-400">{helperText}</p>
      )}

      {displayError && (
        <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1 font-medium">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {displayError}
        </p>
      )}
    </div>
  );
}
