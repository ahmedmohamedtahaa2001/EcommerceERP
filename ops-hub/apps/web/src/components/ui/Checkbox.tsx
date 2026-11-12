import { useId } from "react";
import type { ChangeEvent, ReactNode } from "react";

export interface CheckboxProps {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Checkbox({
  label,
  checked,
  onChange,
  disabled = false,
}: CheckboxProps) {
  const id = useId();
  const handle = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange(event.target.checked);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={handle}
        disabled={disabled}
        className="h-5 w-5 shrink-0 rounded-sm border-ink-400 text-primary focus:ring-primary disabled:opacity-40"
      />
      <label htmlFor={id} className="text-body2 text-ink-800">
        {label}
      </label>
    </div>
  );
}
