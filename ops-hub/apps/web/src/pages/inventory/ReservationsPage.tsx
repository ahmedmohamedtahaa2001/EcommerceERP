import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import {
  createReservation,
  listLocations,
  releaseReservation,
} from "../../lib/api/inventory";
import type { Location, StockReservation } from "../../lib/api/inventory";
import { useT } from "../../lib/i18n";
import { formatDate } from "../../lib/format";
import { problemMessage } from "../../lib/api/problem-message";
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Tag,
  useToast,
} from "../../components/ui";

function formatCountdown(ms: number): string {
  if (ms <= 0) {
    return "";
  }
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number): string => value.toString().padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

export function ReservationsPage() {
  const t = useT();
  const toast = useToast();

  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: listLocations,
  });
  const locations = locationsQuery.data?.locations ?? [];

  // Create form state
  const [variantId, setVariantId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [ttl, setTtl] = useState(3600);
  const [created, setCreated] = useState<StockReservation | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (created === null) {
      return;
    }
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [created]);

  const createMutation = useMutation({
    mutationFn: () =>
      createReservation({
        variantId: variantId.trim(),
        locationId,
        quantity,
        ttlSeconds: ttl,
      }),
    onSuccess: (reservation) => {
      setCreated(reservation);
      toast.showToast("success", t("reservations.created"));
    },
    onError: (error) => {
      const message = problemMessage(error, t("reservations.createFailed"));
      toast.showToast("error", message);
    },
  });

  // Release form state
  const [releaseId, setReleaseId] = useState("");
  const [releaseTarget, setReleaseTarget] = useState<string | null>(null);
  const [releaseQuantity, setReleaseQuantity] = useState<number | null>(null);

  const releaseMutation = useMutation({
    mutationFn: (id: string) => releaseReservation(id),
    onSuccess: () => {
      toast.showToast("success", t("reservations.released"));
      setReleaseId("");
      setReleaseTarget(null);
      setReleaseQuantity(null);
      if (created !== null && releaseTarget === created.id) {
        setCreated(null);
      }
    },
    onError: (error) => {
      const message = problemMessage(error, t("reservations.releaseFailed"));
      toast.showToast("error", message);
      setReleaseTarget(null);
    },
  });

  const locationOptions = locations.map((location: Location) => ({
    value: location.id,
    label: location.name,
  }));

  const expiresMs =
    created !== null ? new Date(created.expiresAt).getTime() - now : 0;
  const expired = created !== null && expiresMs <= 0;

  const submitCreate = (): void => {
    if (variantId.trim() === "" || locationId === "" || quantity <= 0) {
      return;
    }
    createMutation.mutate();
  };

  const requestRelease = (): void => {
    if (releaseId.trim() === "") {
      toast.showToast("error", t("reservations.releaseIdRequired"));
      return;
    }
    setReleaseQuantity(
      created !== null && created.id === releaseId.trim()
        ? created.quantity
        : null,
    );
    setReleaseTarget(releaseId.trim());
  };

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4">
      <PageHeader
        title={t("reservations.title")}
        description={t("reservations.description")}
      />
      <p className="rounded-sm bg-ink-100 px-3 py-2.5 text-caption text-ink-700">
        {t("reservations.listNote")}
      </p>

      <Card className="p-4">
        <h2 className="text-subtitle2 font-bold text-ink-900">
          {t("reservations.createTitle")}
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          <Input
            label={t("reservations.variantId")}
            value={variantId}
            onChange={(event) => setVariantId(event.target.value)}
            hint={t("reservations.variantIdHint")}
            className="font-mono"
            dir="ltr"
          />
          <Select
            label={t("reservations.location")}
            options={locationOptions}
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
          />
          <Input
            label={t("reservations.quantity")}
            type="number"
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            min={1}
          />
          <Input
            label={t("reservations.ttl")}
            type="number"
            value={ttl}
            onChange={(event) => setTtl(Number(event.target.value))}
            hint={t("reservations.ttlHint")}
            min={1}
          />
          <div className="flex justify-end">
            <Button loading={createMutation.isPending} onClick={submitCreate}>
              {t("reservations.create")}
            </Button>
          </div>
        </div>
      </Card>

      {created === null ? (
        <EmptyState
          title={t("reservations.emptyTitle")}
          description={t("reservations.emptyHint")}
        />
      ) : (
        <Card className="p-4">
          <h2 className="text-subtitle2 font-bold text-ink-900">
            {t("reservations.activeCardTitle")}
          </h2>
          <dl className="mt-3 grid grid-cols-1 gap-3 text-body2 sm:grid-cols-3">
            <div>
              <dt className="text-caption text-ink-500">
                {t("reservations.col.id")}
              </dt>
              <dd className="mt-1 font-mono text-ink-900">{created.id}</dd>
            </div>
            <div>
              <dt className="text-caption text-ink-500">
                {t("reservations.col.status")}
              </dt>
              <dd className="mt-1">
                <Tag
                  tone={
                    created.status === "active"
                      ? "success"
                      : created.status === "released"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {t(`reservationStatus.${created.status}`)}
                </Tag>
              </dd>
            </div>
            <div>
              <dt className="text-caption text-ink-500">
                {t("reservations.col.expiresAt")}
              </dt>
              <dd className="mt-1 text-ink-900">
                {formatDate(created.expiresAt)}
              </dd>
            </div>
          </dl>
          <p
            className="mt-3 text-body2 font-semibold text-ink-800"
            aria-live="polite"
          >
            {expired
              ? t("reservations.countdownOver")
              : t("reservations.countdown", {
                  time: formatCountdown(expiresMs),
                })}
          </p>
        </Card>
      )}

      <Card className="p-4">
        <h2 className="text-subtitle2 font-bold text-ink-900">
          {t("reservations.releaseTitle")}
        </h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            label={t("reservations.releaseId")}
            value={releaseId}
            onChange={(event) => setReleaseId(event.target.value)}
            className="font-mono"
            dir="ltr"
          />
          <Button
            variant="outlined"
            onClick={requestRelease}
            disabled={releaseId.trim() === ""}
          >
            {t("reservations.release")}
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={releaseTarget !== null}
        onClose={() => setReleaseTarget(null)}
        onConfirm={() =>
          releaseTarget !== null && releaseMutation.mutate(releaseTarget)
        }
        title={t("reservations.releaseConfirmTitle")}
        body={t("reservations.releaseConfirmBody", {
          id: releaseTarget ?? "",
          quantity: releaseQuantity ?? 0,
        })}
        confirmLabel={t("reservations.release")}
        loading={releaseMutation.isPending}
      />
    </div>
  );
}
