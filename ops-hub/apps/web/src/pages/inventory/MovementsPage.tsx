import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useQuery } from "@tanstack/react-query";

import {
  getAvailability,
  listLocations,
  listMovements,
} from "../../lib/api/inventory";
import type { Location, StockMovement } from "../../lib/api/inventory";
import { useT } from "../../lib/i18n";
import { formatNumber, formatDate } from "../../lib/format";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Table,
  Tag,
  THead,
  TH,
  TD,
} from "../../components/ui";

function deltaTone(delta: number): "success" | "alert" | "neutral" {
  if (delta > 0) {
    return "success";
  }
  if (delta < 0) {
    return "alert";
  }
  return "neutral";
}

function MovementsSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="rounded-lg bg-surface shadow-sm"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b border-ink-200 px-4 py-4"
        >
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

function actorLabel(
  movement: StockMovement,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (movement.actorType === "system" || movement.actorId === null) {
    return t("movements.actor.system");
  }
  return t("movements.actor.user", { id: movement.actorId });
}

export function MovementsPage() {
  const t = useT();
  const [searchParams] = useSearchParams();
  const [skuInput, setSkuInput] = useState("");
  const [resolvedVariantId, setResolvedVariantId] = useState<string | null>(
    searchParams.get("variantId"),
  );
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [locationFilter, setLocationFilter] = useState("");

  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: listLocations,
  });
  const locations = locationsQuery.data?.locations ?? [];

  const movementsQuery = useQuery({
    queryKey: ["movements", resolvedVariantId, locationFilter],
    queryFn: () => {
      const params: { variantId?: string; locationId?: string } = {};
      if (resolvedVariantId !== null) {
        params.variantId = resolvedVariantId;
      }
      if (locationFilter !== "") {
        params.locationId = locationFilter;
      }
      return listMovements(params);
    },
  });

  const movements = movementsQuery.data?.movements ?? [];

  const locationName = (id: string | null): string => {
    if (id === null) {
      return t("movements.noLocation");
    }
    return (
      locations.find((location: Location) => location.id === id)?.name ?? id
    );
  };

  const verifySku = async (): Promise<void> => {
    const sku = skuInput.trim();
    if (sku === "") {
      setResolvedVariantId(null);
      setResolveError(null);
      return;
    }
    setResolving(true);
    setResolveError(null);
    try {
      const availability = await getAvailability({ sku });
      setResolvedVariantId(availability.variantId);
    } catch {
      setResolvedVariantId(null);
      setResolveError(t("movements.skuNotFound"));
    } finally {
      setResolving(false);
    }
  };

  const locationOptions = [
    { value: "", label: t("movements.allLocations") },
    ...locations.map((location: Location) => ({
      value: location.id,
      label: location.name,
    })),
  ];

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4">
      <PageHeader
        title={t("movements.title")}
        description={t("movements.description")}
      />
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            label={t("movements.skuFilter")}
            value={skuInput}
            onChange={(event) => setSkuInput(event.target.value)}
            placeholder={t("movements.skuFilterPlaceholder")}
            className="font-mono"
          />
          <Button
            variant="outlined"
            onClick={() => void verifySku()}
            loading={resolving}
            disabled={skuInput.trim() === ""}
          >
            {t("movements.verifySku")}
          </Button>
          <Select
            label={t("movements.locationFilter")}
            options={locationOptions}
            value={locationFilter}
            onChange={(event) => setLocationFilter(event.target.value)}
          />
        </div>
        {resolveError !== null ? (
          <p className="mt-2 text-caption font-semibold text-alert">
            {resolveError}
          </p>
        ) : resolving ? (
          <p className="mt-2 text-caption text-ink-600">
            {t("movements.skuResolving")}
          </p>
        ) : null}
      </Card>

      {movementsQuery.isLoading ? (
        <MovementsSkeleton />
      ) : movementsQuery.isError ? (
        <ErrorState
          error={movementsQuery.error}
          onRetry={movementsQuery.refetch}
          className="rounded-lg bg-surface shadow-sm"
        />
      ) : movements.length === 0 ? (
        <EmptyState
          title={t("movements.emptyTitle")}
          description={t("movements.emptyHint")}
        />
      ) : (
        <div className="rounded-lg bg-surface shadow-sm">
          <Table ariaLabel={t("movements.ariaTable")} zebra>
            <THead>
              <tr>
                <TH>{t("movements.col.time")}</TH>
                <TH>{t("movements.col.variant")}</TH>
                <TH>{t("movements.col.location")}</TH>
                <TH>{t("movements.col.bucket")}</TH>
                <TH>{t("movements.col.delta")}</TH>
                <TH>{t("movements.col.reason")}</TH>
                <TH>{t("movements.col.actor")}</TH>
              </tr>
            </THead>
            <tbody>
              {movements.map((movement: StockMovement) => {
                const delta = movement.delta;
                const sign = delta > 0 ? "+" : "";
                return (
                  <tr
                    key={movement.id}
                    className="border-b border-ink-200 odd:bg-ink-100/60"
                  >
                    <TD className="whitespace-nowrap text-ink-700">
                      {formatDate(movement.createdAt)}
                    </TD>
                    <TD className="font-mono text-caption text-ink-900">
                      {movement.variantId}
                    </TD>
                    <TD>{locationName(movement.locationId)}</TD>
                    <TD>
                      <Tag tone="neutral">{t(`bucket.${movement.bucket}`)}</Tag>
                    </TD>
                    <TD>
                      <span
                        className={`font-mono font-bold ${
                          deltaTone(delta) === "success"
                            ? "text-success"
                            : deltaTone(delta) === "alert"
                              ? "text-alert"
                              : "text-ink-700"
                        }`}
                        aria-label={t("movements.deltaAria", {
                          delta: `${sign}${delta}`,
                        })}
                      >
                        {sign}
                        {formatNumber(delta)}
                      </span>
                    </TD>
                    <TD>
                      <Tag tone="secondary">
                        {(() => {
                          const key = `reason.${movement.reason}`;
                          const label = t(key);
                          return label === key ? movement.reason : label;
                        })()}
                      </Tag>
                    </TD>
                    <TD className="text-caption text-ink-700">
                      {actorLabel(movement, t)}
                    </TD>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
