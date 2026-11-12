export interface AvatarProps {
  name: string;
  src?: string | undefined;
  size?: "sm" | "md";
  className?: string;
}

/** Initials avatar with a Flora primary tint; `src` overrides when given. */
export function Avatar({
  name,
  src,
  size = "md",
  className = "",
}: AvatarProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const dimension =
    size === "sm" ? "h-8 w-8 text-caption" : "h-10 w-10 text-body2";

  if (src !== undefined) {
    return (
      <img
        src={src}
        alt={name}
        className={`rounded-full object-cover ${dimension} ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-full bg-primary-lightest font-bold text-primary-dark ${dimension} ${className}`}
    >
      {initials || "?"}
    </span>
  );
}
