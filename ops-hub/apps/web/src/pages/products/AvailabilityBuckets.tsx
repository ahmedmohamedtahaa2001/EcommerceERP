import type { ReactNode } from "react";

import type { Availability } from "../../lib/api/inventory";
import { useT } from "../../lib/i18n";
import { Tag } from "../../components/ui";
import type { TagTone } from "../../components/ui";

type BucketTotals = Availability["total"];

interface BucketSpec {
  key: string;
  field: keyof BucketTotals;
}

/**
 * Bucket → Flora tone. Color never stands alone: every number is paired with
 * a labelled tag, and ATP gets an explicit state word when not positive.
 */
export const BUCKET_TONES: Record<string, TagTone> = {
  on_hand: "info",
  reserved: "warning",
  quarantined: "warning",
  damaged: "alert",
  availableToPromise: "success",
};

const BUCKET_SPECS: readonly BucketSpec[] = [
  { key: "on_hand", field: "onHand" },
  { key: "reserved", field: "reserved" },
  { key: "quarantined", field: "quarantined" },
  { key: "damaged", field: "damaged" },
];

function toneForAtp(atp: number): TagTone {
  if (atp > 0) {
    return "success";
  }
  return atp === 0 ? "warning" : "alert";
}

function BucketNumber({
  bucketKey,
  value,
  tone,
}: {
  bucketKey: string;
  value: number;
  tone: TagTone;
}) {
  const t = useT();
  const word =
    bucketKey === "availableToPromise"
      ? value > 0
        ? ""
        : value === 0
          ? ` · ${t("availability.atpZero")}`
          : ` · ${t("availability.atpNegative")}`
      : "";
  return (
    <Tag tone={tone}>
      {t(`bucket.${bucketKey}`)}: <strong className="font-mono">{value}</strong>
      {word !== "" ? <span className="font-bold">{word}</span> : null}
    </Tag>
  );
}

/**
 * Shared bucket display used by the product-detail availability popover and
 * the inventory availability page's total row. Renders nothing when there is
 * no data yet.
 */
export function AvailabilityBuckets({
  buckets,
  ariaLabel,
}: {
  buckets: BucketTotals | null;
  ariaLabel: string;
}) {
  if (buckets === null) {
    return null;
  }
  return (
    <ul aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {BUCKET_SPECS.map((spec) => (
        <li key={spec.key}>
          <BucketNumber
            bucketKey={spec.key}
            value={buckets[spec.field]}
            tone={BUCKET_TONES[spec.key]!}
          />
        </li>
      ))}
      <li>
        <BucketNumber
          bucketKey="availableToPromise"
          value={buckets.availableToPromise}
          tone={toneForAtp(buckets.availableToPromise)}
        />
      </li>
    </ul>
  );
}

export function InfoIcon({
  className = "",
}: {
  className?: string;
}): ReactNode {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8h.01M11 12h1v4h1" />
    </svg>
  );
}
