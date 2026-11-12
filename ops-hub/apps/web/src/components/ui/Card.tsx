import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** Flora surface card: white, 8px radius, subtle resting shadow. */
export function Card({ className = "", children, ...rest }: CardProps) {
  return (
    <div className={`rounded-lg bg-surface shadow-sm ${className}`} {...rest}>
      {children}
    </div>
  );
}
