"use client";

import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from "react";

const fieldBase = "focus-ring w-full rounded-md border border-border bg-card px-3 py-2 text-sm";

type FieldWrapperProps = {
  label: string;
  htmlFor?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
};

export function FieldWrapper({ label, htmlFor, error, required, children }: FieldWrapperProps) {
  return (
    <label className="block text-sm font-medium" htmlFor={htmlFor}>
      {label}
      {required && <span className="ml-1 text-danger">*</span>}
      <div className="mt-2">{children}</div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { error?: string }>(
  ({ className, error, ...props }, ref) => (
    <input ref={ref} className={cn(fieldBase, error && "border-danger", className)} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }>(
  ({ className, error, ...props }, ref) => (
    <textarea ref={ref} className={cn(fieldBase, "min-h-28", error && "border-danger", className)} {...props} />
  )
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { error?: string }>(
  ({ className, error, children, ...props }, ref) => (
    <select ref={ref} className={cn(fieldBase, error && "border-danger", className)} {...props}>
      {children}
    </select>
  )
);
Select.displayName = "Select";
