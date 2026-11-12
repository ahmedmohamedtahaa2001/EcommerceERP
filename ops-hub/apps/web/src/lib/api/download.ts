/** Reads the filename from a `Content-Disposition: attachment; filename="…"` header. */
export function filenameFromDisposition(
  header: string | null,
  fallback: string,
): string {
  if (header === null) return fallback;
  const match = /filename="([^"]+)"/.exec(header);
  return match?.[1] ?? fallback;
}
