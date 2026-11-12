/**
 * Flat default SLA for every exception reason — not yet reason-specific or
 * tenant-configurable. P3-S11-T07 ("Priority and SLA queues") is where a
 * real per-type/per-tenant SLA table belongs; this is a placeholder so the
 * required `due_at` has a sane value until then.
 */
export const DEFAULT_EXCEPTION_SLA_HOURS = 24;

export function defaultDueAt(now: Date): Date {
  return new Date(now.getTime() + DEFAULT_EXCEPTION_SLA_HOURS * 60 * 60 * 1000);
}
