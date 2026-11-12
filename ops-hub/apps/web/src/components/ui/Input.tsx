import { useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Helper or validation text shown under the field. */
  hint?: ReactNode | undefined;
  error?: string | null;
  hideLabel?: boolean;
}

export function Input({
  label,
  hint,
  error,
  hideLabel = false,
  className = "",
  id,
  ...rest
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const describedBy =
    error !== undefined && error !== null ? hintId : hint ? hintId : undefined;

  return (
    <div className="flex w-full flex-col gap-1">
      <label
        htmlFor={inputId}
        className={`text-body2 font-semibold text-ink-800 ${hideLabel ? "sr-only" : ""}`}
      >
        {label}
      </label>
      <input
        id={inputId}
        aria-describedby={describedBy}
        aria-invalid={error !== undefined && error !== null ? true : undefined}
        className={`h-11 rounded-sm border bg-surface px-3 text-body1 text-ink-900 placeholder:text-ink-500 disabled:cursor-not-allowed disabled:bg-ink-100 ${
          error !== undefined && error !== null
            ? "border-alert"
            : "border-ink-300 focus:border-primary"
        } ${className}`}
        {...rest}
      />
      {error !== undefined && error !== null ? (
        <p id={hintId} className="text-caption font-semibold text-alert">
          {error}
        </p>
      ) : hint !== undefined ? (
        <p id={hintId} className="text-caption text-ink-600">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
