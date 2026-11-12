import { useId } from "react";
import type { FormEvent, ReactNode } from "react";

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: ((value: string) => void) | undefined;
  placeholder: string;
  /** Announced to screen readers; defaults to the placeholder. */
  label?: string;
  startSlot?: ReactNode | undefined;
  className?: string;
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  startSlot,
  className = "",
}: SearchBarProps) {
  const id = useId();
  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    onSubmit?.(value);
  };

  return (
    <form role="search" onSubmit={handleSubmit} className={className}>
      <div className="relative flex items-center">
        <span
          className="pointer-events-none absolute start-3 text-ink-500"
          aria-hidden="true"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </span>
        <input
          id={id}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={label ?? placeholder}
          className="h-10 w-full rounded-pill border border-ink-300 bg-surface ps-10 pe-4 text-body2 text-ink-900 placeholder:text-ink-500 focus:border-primary"
        />
        {startSlot}
      </div>
    </form>
  );
}
