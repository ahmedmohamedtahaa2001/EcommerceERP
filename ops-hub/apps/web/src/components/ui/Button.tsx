import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "outlined" | "ghost" | "text";
type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks interaction. */
  loading?: boolean;
  /** Icon rendered before the label, respecting the inline direction. */
  startIcon?: ReactNode | undefined;
  endIcon?: ReactNode | undefined;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-dark focus-visible:outline-primary shadow-xs",
  secondary:
    "bg-secondary-darkest text-white hover:bg-secondary-dark focus-visible:outline-secondary-darkest shadow-xs",
  outlined:
    "border border-ink-300 bg-surface text-ink-800 hover:bg-ink-100 focus-visible:outline-primary",
  ghost:
    "bg-transparent text-ink-700 hover:bg-ink-100 focus-visible:outline-primary",
  text: "bg-transparent text-primary hover:text-primary-dark focus-visible:outline-primary",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 gap-1.5 text-body2",
  md: "h-11 px-4 gap-2 text-body1",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  startIcon,
  endIcon,
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex select-none items-center justify-center rounded font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="me-0 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        startIcon
      )}
      {children}
      {endIcon}
    </button>
  );
}
