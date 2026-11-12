import { useId } from "react";
import type { SelectHTMLAttributes } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "children"
> {
  label: string;
  options: readonly SelectOption[];
  hideLabel?: boolean;
}

export function Select({
  label,
  options,
  hideLabel = false,
  className = "",
  id,
  ...rest
}: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;

  return (
    <div className="flex w-full flex-col gap-1">
      <label
        htmlFor={selectId}
        className={`text-body2 font-semibold text-ink-800 ${hideLabel ? "sr-only" : ""}`}
      >
        {label}
      </label>
      <select
        id={selectId}
        className={`h-11 rounded-sm border border-ink-300 bg-surface px-3 text-body1 text-ink-900 focus:border-primary disabled:cursor-not-allowed disabled:bg-ink-100 ${className}`}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
