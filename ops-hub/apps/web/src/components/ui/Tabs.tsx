import type { ReactNode } from "react";

export interface TabsProps {
  items: readonly { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  /** Panel content for the active tab. */
  children?: ReactNode;
  className?: string;
}

/** Controlled tabs (role=tablist). Panels render as `children`. */
export function Tabs({
  items,
  value,
  onChange,
  children,
  className = "",
}: TabsProps) {
  const active = items.find((item) => item.id === value) ?? items[0];

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={active?.label}
        className="flex gap-1 overflow-x-auto border-b border-ink-200"
      >
        {items.map((item) => {
          const selected = item.id === value;
          return (
            <button
              key={item.id}
              role="tab"
              type="button"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.id)}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-body2 font-semibold transition-colors ${
                selected
                  ? "border-primary text-primary"
                  : "border-transparent text-ink-600 hover:text-ink-900"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="pt-4">
        {children}
      </div>
    </div>
  );
}
