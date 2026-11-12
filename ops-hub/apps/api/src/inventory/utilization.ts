/** Share of a location's capacity in use, to one decimal place. Null when unlimited. */
export function utilizationPercent(
  used: number,
  capacity: number | null,
): number | null {
  if (capacity === null) return null;
  return Math.round((used / capacity) * 1000) / 10;
}
