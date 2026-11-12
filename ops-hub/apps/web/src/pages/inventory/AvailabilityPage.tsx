import { useState } from "react";

import { useQuery } from "@tanstack/react-query";

import {
  getAvailability,
  listBalances,
  listLocations,
} from "../../lib/api/inventory";
import type { Availability, Location } from "../../lib/api/inventory";
import { useLocale, useT } from "../../lib/i18n";
import { summarizeBalances } from "./stock-overview";
import { formatNumber } from "../../lib/format";
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

function availabilityTone(value: number): "success" | "warning" | "alert" {
  if (value > 0) {
    return "success";
  }
  if (value === 0) {
    return "warning";
  }
  return "alert";
}

function BucketCell({ value }: { value: number }) {
  return (
    <Tag tone={value > 0 ? "neutral" : "warning"}>
      <span className="font-mono">{formatNumber(value)}</span>
    </Tag>
  );
}

function AvailabilitySkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="rounded-lg bg-surface shadow-sm"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b border-ink-200 px-4 py-4"
        >
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="ms-auto h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Every item with stock, so the page is useful before anyone types a SKU. */
function StockOverview({
  locationId,
  onPick,
}: {
  locationId: string;
  onPick: (sku: string) => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const balancesQuery = useQuery({
    queryKey: ["balances", "overview"],
    queryFn: () => listBalances({}),
  });

  if (balancesQuery.isLoading) return <AvailabilitySkeleton />;
  if (balancesQuery.isError) {
    return (
      <ErrorState
        error={balancesQuery.error}
        onRetry={balancesQuery.refetch}
        className="rounded-lg bg-surface shadow-sm"
      />
    );
  }
  const rows = summarizeBalances(
    balancesQuery.data?.balances ?? [],
    locationId,
  );
  if (rows.length === 0) {
    return (
      <EmptyState
        title={t("availability.overviewEmpty")}
        description={t("availability.explainerHint")}
      />
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-caption text-ink-600">
        {t("availability.overviewHint")}
      </p>
      <div className="overflow-x-auto rounded-lg bg-surface shadow-sm">
        <Table ariaLabel={t("availability.overviewTitle")} zebra>
          <THead>
            <tr>
              <TH>{t("availability.col.item")}</TH>
              <TH>SKU</TH>
              <TH>{t("bucket.on_hand")}</TH>
              <TH>{t("bucket.reserved")}</TH>
              <TH>{t("bucket.availableToPromise")}</TH>
            </tr>
          </THead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.variantId}
                className="cursor-pointer border-b border-ink-200 hover:bg-primary-light/40"
                onClick={() => onPick(row.sku)}
              >
                <TD className="font-semibold text-ink-900">
                  {(locale === "ar" ? row.nameAr : row.nameEn) ||
                    row.nameAr ||
                    row.nameEn}
                </TD>
                <TD>
                  <button
                    type="button"
                    className="font-mono text-info hover:underline"
                    onClick={(event) => {
                      event.stopPropagation();
                      onPick(row.sku);
                    }}
                  >
                    {row.sku}
                  </button>
                </TD>
                <TD>
                  <BucketCell value={row.onHand} />
                </TD>
                <TD>
                  <span className="font-mono">
                    {formatNumber(row.reserved)}
                  </span>
                </TD>
                <TD>
                  <Tag tone={availabilityTone(row.available)}>
                    <span className="font-mono">
                      {formatNumber(row.available)}
                    </span>
                  </Tag>
                </TD>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

export function AvailabilityPage() {
  const t = useT();
  const [skuInput, setSkuInput] = useState("");
  const [submittedSku, setSubmittedSku] = useState("");
  const [locationFilter, setLocationFilter] = useState("");

  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: listLocations,
  });
  const locations = locationsQuery.data?.locations ?? [];
  const locationName = (id: string): string =>
    locations.find((location) => location.id === id)?.name ?? id;

  const availabilityQuery = useQuery({
    queryKey: ["availability", submittedSku, locationFilter],
    queryFn: () => {
      if (locationFilter === "") {
        return getAvailability({ sku: submittedSku });
      }
      return getAvailability({ sku: submittedSku, location: locationFilter });
    },
    enabled: submittedSku.trim() !== "",
  });

  const data: Availability | undefined = availabilityQuery.data;
  const submit = (): void => setSubmittedSku(skuInput.trim());

  const locationOptions = [
    { value: "", label: t("availability.allLocations") },
    ...locations.map((location: Location) => ({
      value: location.id,
      label: location.name,
    })),
  ];

  const total = data?.total;

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4">
      <PageHeader
        title={t("availability.title")}
        description={t("availability.description")}
      />
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            label={t("availability.searchLabel")}
            value={skuInput}
            onChange={(event) => setSkuInput(event.target.value)}
            placeholder={t("availability.searchPlaceholder")}
            className="font-mono"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                submit();
              }
            }}
          />
          <Select
            label={t("availability.location")}
            options={locationOptions}
            value={locationFilter}
            onChange={(event) => setLocationFilter(event.target.value)}
          />
          <Button onClick={submit} disabled={skuInput.trim() === ""}>
            {t("availability.search")}
          </Button>
          {submittedSku !== "" ? (
            <Button
              variant="outlined"
              onClick={() => {
                setSkuInput("");
                setSubmittedSku("");
              }}
            >
              {t("availability.showAll")}
            </Button>
          ) : null}
        </div>
      </Card>

      {submittedSku.trim() === "" ? (
        <StockOverview
          locationId={locationFilter}
          onPick={(sku) => {
            setSkuInput(sku);
            setSubmittedSku(sku);
          }}
        />
      ) : availabilityQuery.isLoading ? (
        <AvailabilitySkeleton />
      ) : availabilityQuery.isError ? (
        <ErrorState
          error={availabilityQuery.error}
          onRetry={availabilityQuery.refetch}
          className="rounded-lg bg-surface shadow-sm"
        />
      ) : data === undefined || data.locations.length === 0 ? (
        <EmptyState
          title={t("availability.emptyTitle")}
          description={t("availability.emptyHint")}
        />
      ) : (
        <>
          <p className="text-caption text-ink-600">
            SKU{" "}
            <span className="font-mono font-semibold text-ink-900">
              {data.sku}
            </span>
          </p>
          <div className="rounded-lg bg-surface shadow-sm">
            <Table ariaLabel={t("availability.perLocation")} zebra>
              <THead>
                <tr>
                  <TH>{t("availability.col.location")}</TH>
                  <TH>{t("bucket.on_hand")}</TH>
                  <TH>{t("bucket.reserved")}</TH>
                  <TH>{t("bucket.quarantined")}</TH>
                  <TH>{t("bucket.damaged")}</TH>
                  <TH>{t("bucket.availableToPromise")}</TH>
                </tr>
              </THead>
              <tbody>
                {data.locations.map((location) => (
                  <tr
                    key={location.locationId}
                    className="border-b border-ink-200 odd:bg-ink-100/60"
                  >
                    <TD className="font-semibold text-ink-900">
                      {locationName(location.locationId)}
                    </TD>
                    <TD>
                      <BucketCell value={location.onHand} />
                    </TD>
                    <TD>
                      <BucketCell value={location.reserved} />
                    </TD>
                    <TD>
                      <BucketCell value={location.quarantined} />
                    </TD>
                    <TD>
                      <BucketCell value={location.damaged} />
                    </TD>
                    <TD>
                      <Tag tone={availabilityTone(location.availableToPromise)}>
                        <span className="font-mono">
                          {formatNumber(location.availableToPromise)}
                        </span>
                        {location.availableToPromise === 0 ? (
                          <span className="ms-1 text-caption">
                            · {t("availability.atpZero")}
                          </span>
                        ) : null}
                        {location.availableToPromise < 0 ? (
                          <span className="ms-1 text-caption">
                            · {t("availability.atpNegative")}
                          </span>
                        ) : null}
                      </Tag>
                    </TD>
                  </tr>
                ))}
                {total !== undefined ? (
                  <tr className="border-t-2 border-ink-300 bg-ink-100/80 font-bold">
                    <TD>{t("availability.totalTitle")}</TD>
                    <TD>
                      <span className="font-mono">
                        {formatNumber(total.onHand)}
                      </span>
                    </TD>
                    <TD>
                      <span className="font-mono">
                        {formatNumber(total.reserved)}
                      </span>
                    </TD>
                    <TD>
                      <span className="font-mono">
                        {formatNumber(total.quarantined)}
                      </span>
                    </TD>
                    <TD>
                      <span className="font-mono">
                        {formatNumber(total.damaged)}
                      </span>
                    </TD>
                    <TD>
                      <Tag tone={availabilityTone(total.availableToPromise)}>
                        <span className="font-mono">
                          {formatNumber(total.availableToPromise)}
                        </span>
                      </Tag>
                    </TD>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
