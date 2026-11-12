import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required — icon-only buttons must announce themselves. */
  "aria-label": string;
  children: ReactNode;
}

/** Square icon-only button; touch target ≥44px. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { className = "", children, type = "button", ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={`inline-flex h-11 w-11 items-center justify-center rounded text-ink-700 transition-colors hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
