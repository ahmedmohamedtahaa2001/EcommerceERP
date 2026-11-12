import type { ReactNode } from "react";

import { useT } from "../../lib/i18n";

/** The 12-state order state machine (UI_PLAN §4). */
export const ORDER_STATUSES = [
  "pending",
  "validated",
  "confirmed",
  "allocated",
  "on_hold",
  "picking",
  "label_created",
  "carrier_accepted",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const ORDER_VISUALS: Record<
  string,
  { tone: string; icon: string; labelKey: string }
> = {
  pending: {
    tone: "bg-ink-100 text-ink-700",
    icon: "clock",
    labelKey: "orderStatus.pending",
  },
  validated: {
    tone: "bg-info-light text-info",
    icon: "check",
    labelKey: "orderStatus.validated",
  },
  confirmed: {
    tone: "bg-info-light text-info",
    icon: "check",
    labelKey: "orderStatus.confirmed",
  },
  allocated: {
    tone: "bg-primary-lightest text-primary-dark",
    icon: "check",
    labelKey: "orderStatus.allocated",
  },
  on_hold: {
    tone: "bg-warning-light text-warning",
    icon: "pause",
    labelKey: "orderStatus.on_hold",
  },
  picking: {
    tone: "bg-primary-lightest text-primary-dark",
    icon: "progress",
    labelKey: "orderStatus.picking",
  },
  label_created: {
    tone: "bg-primary-lightest text-primary-dark",
    icon: "tag",
    labelKey: "orderStatus.label_created",
  },
  carrier_accepted: {
    tone: "bg-primary-lightest text-primary-dark",
    icon: "truck",
    labelKey: "orderStatus.carrier_accepted",
  },
  shipped: {
    tone: "bg-info-light text-info",
    icon: "truck",
    labelKey: "orderStatus.shipped",
  },
  delivered: {
    tone: "bg-success-light text-success",
    icon: "check",
    labelKey: "orderStatus.delivered",
  },
  cancelled: {
    tone: "bg-alert-light text-alert",
    icon: "x",
    labelKey: "orderStatus.cancelled",
  },
  returned: {
    tone: "bg-alert-light text-alert",
    icon: "return",
    labelKey: "orderStatus.returned",
  },
};

const EXCEPTION_VISUALS: Record<
  string,
  { tone: string; icon: string; labelKey: string }
> = {
  open: {
    tone: "bg-warning-light text-warning",
    icon: "alert",
    labelKey: "exceptionStatus.open",
  },
  resolved: {
    tone: "bg-success-light text-success",
    icon: "check",
    labelKey: "exceptionStatus.resolved",
  },
};

const NEUTRAL_VISUAL: { tone: string; icon: string; labelKey: string } = {
  tone: "bg-ink-100 text-ink-600",
  icon: "help",
  labelKey: "orderStatus.unknown",
};

function Icon({ name, className = "" }: { name: string; className: string }) {
  const paths: Record<string, ReactNode> = {
    clock: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </>
    ),
    check: <path d="m5 13 4 4L19 7" />,
    pause: (
      <>
        <rect x="7" y="6" width="3" height="12" rx="1" />
        <rect x="14" y="6" width="3" height="12" rx="1" />
      </>
    ),
    progress: <path d="M21 12a9 9 0 1 1-9-9" />,
    tag: (
      <>
        <path d="M12 2H2v10l9.3 9.3a1 1 0 0 0 1.4 0l8.6-8.6a1 1 0 0 0 0-1.4Z" />
        <circle cx="7" cy="7" r="1" />
      </>
    ),
    truck: (
      <>
        <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
        <path d="M15 8h4l3 4v6a1 1 0 0 1-1 1h-2" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="17" cy="18" r="2" />
      </>
    ),
    x: <path d="M18 6 6 18M6 6l12 12" />,
    return: (
      <>
        <path d="M3 10h13a5 5 0 0 1 0 10h-4" />
        <path d="m7 6-4 4 4 4" />
      </>
    ),
    alert: (
      <>
        <path d="m10.3 3.9-8.5 14.2A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export type StatusPillKind =
  { type: "order"; status: string } | { type: "exception"; status: string };

/**
 * Status pill for order states and exception statuses. Status is never
 * conveyed by color alone — each pill carries an icon, a label, and a tone.
 * Unknown values degrade to a neutral pill; they never crash.
 */
export function StatusPill({ kind }: { kind: StatusPillKind }) {
  const t = useT();
  const visual =
    kind.type === "order"
      ? (ORDER_VISUALS[kind.status] ?? {
          ...NEUTRAL_VISUAL,
          labelKey: "orderStatus.unknown",
        })
      : (EXCEPTION_VISUALS[kind.status] ?? {
          tone: NEUTRAL_VISUAL.tone,
          icon: "help",
          labelKey: "exceptionStatus.unknown",
        });

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-2.5 py-1 text-caption font-bold ${visual.tone}`}
      data-status={kind.status}
    >
      <Icon name={visual.icon} className="h-3.5 w-3.5" />
      {t(visual.labelKey)}
    </span>
  );
}
