import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useT } from "../../lib/i18n";
import { listLocations } from "../../lib/api/inventory";
import type { OrderValidationResult } from "../../lib/api/orders";
import { Button, Modal, Select, Skeleton } from "../../components/ui";

export interface ValidateOrderDialogProps {
  open: boolean;
  onClose: () => void;
  /** Runs the validate mutation; the container owns it. */
  onValidate: (locationId: string) => void;
  validating: boolean;
  /** Last validation result, rendered as an alert inside the dialog. */
  result: OrderValidationResult | null;
}

/**
 * Confirm-style dialog for `POST /v1/orders/:id/validate`: pick a location
 * (required — the API validates stock at that location), confirm, and see
 * the returned status/reasonCode inline.
 */
export function ValidateOrderDialog({
  open,
  onClose,
  onValidate,
  validating,
  result,
}: ValidateOrderDialogProps) {
  const t = useT();
  const [locationId, setLocationId] = useState("");

  const locations = useQuery({
    queryKey: ["locations", "list"],
    queryFn: listLocations,
    enabled: open,
  });
  const options = locations.data?.locations ?? [];

  // Preselect the first location once the list arrives, so the dialog is
  // confirm-ready; reset when reopened.
  useEffect(() => {
    if (open && locationId === "" && options.length > 0) {
      setLocationId(options[0]?.id ?? "");
    }
    if (!open && locationId !== "") {
      setLocationId("");
    }
  }, [open, locationId, options]);

  const canConfirm = locationId !== "" && !validating;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("orders.detail.validate.title")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button
            loading={validating}
            disabled={!canConfirm}
            onClick={() => onValidate(locationId)}
          >
            {t("action.validate")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-body2 text-ink-700">
          {t("orders.detail.validate.hint")}
        </p>

        {locations.isLoading ? (
          <div role="status" aria-busy="true" className="flex flex-col gap-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : options.length === 0 ? (
          <p role="status" className="text-body2 font-semibold text-warning">
            {t("orders.detail.noLocations")}
          </p>
        ) : (
          <Select
            label={t("orders.detail.selectLocation")}
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
            options={options.map((location) => ({
              value: location.id,
              label:
                location.code !== null
                  ? `${location.name} (${location.code})`
                  : location.name,
            }))}
          />
        )}

        {result !== null ? <ValidationAlert result={result} /> : null}
      </div>
    </Modal>
  );
}

function ValidationAlert({ result }: { result: OrderValidationResult }) {
  const t = useT();

  if (result.status === "validated") {
    return (
      <div
        role="status"
        className="flex items-start gap-2 rounded border border-success bg-success-light p-3 text-body2 font-semibold text-success"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
          aria-hidden="true"
        >
          <path d="m5 13 4 4L19 7" />
        </svg>
        {t("orders.detail.result.validated")}
      </div>
    );
  }

  const reasonKey = `reason.${result.reasonCode ?? ""}`;
  const reasonLabel = result.reasonCode === null ? "" : t(reasonKey);

  return (
    <div
      role="alert"
      className="flex flex-col gap-1 rounded border border-warning bg-warning-light p-3 text-body2 text-ink-800"
    >
      <span className="flex items-center gap-2 font-semibold text-warning">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
          aria-hidden="true"
        >
          <path d="m10.3 3.9-8.5 14.2A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
        {t("orders.detail.result.onHold")}
      </span>
      {reasonLabel === "" ? null : (
        <span>
          {t("orders.detail.reasonLabel")}:{" "}
          {reasonLabel === reasonKey ? result.reasonCode : reasonLabel}
        </span>
      )}
    </div>
  );
}
