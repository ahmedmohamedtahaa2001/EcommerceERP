import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createAdjustment,
  getAvailability,
  listBalances,
  listLocations,
} from "../../lib/api/inventory";
import type { Location, StockBucket } from "../../lib/api/inventory";
import { getEnums } from "../../lib/api/meta";
import { useT } from "../../lib/i18n";
import { formatNumber } from "../../lib/format";
import { problemMessage } from "../../lib/api/problem-message";
import {
  Button,
  Card,
  ConfirmDialog,
  Input,
  PageHeader,
  Select,
  Skeleton,
  useToast,
} from "../../components/ui";

const STOCK_BUCKETS: StockBucket[] = [
  "on_hand",
  "reserved",
  "quarantined",
  "damaged",
  "in_transit",
];

export function AdjustmentsPage() {
  const t = useT();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [skuInput, setSkuInput] = useState("");
  const [variantId, setVariantId] = useState<string | null>(null);
  const [verifiedSku, setVerifiedSku] = useState<string>("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const [locationId, setLocationId] = useState("");
  const [bucket, setBucket] = useState<StockBucket>("on_hand");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: listLocations,
  });
  const locations = locationsQuery.data?.locations ?? [];
  const enumsQuery = useQuery({
    queryKey: ["enums"],
    queryFn: getEnums,
    staleTime: Infinity,
  });

  const balancesQuery = useQuery({
    queryKey: ["balances", variantId, locationId],
    queryFn: () => {
      const params: { variantId?: string; locationId?: string } = {
        locationId,
      };
      if (variantId !== null) {
        params.variantId = variantId;
      }
      return listBalances(params);
    },
    enabled: variantId !== null && locationId !== "",
  });

  const currentBalance = (balancesQuery.data?.balances ?? [])
    .filter((balance) => balance.bucket === bucket)
    .reduce((sum, balance) => sum + balance.quantity, 0);

  const verify = async (): Promise<void> => {
    const sku = skuInput.trim();
    if (sku === "") {
      setVerifyError(t("adjustments.skuRequired"));
      return;
    }
    setVerifying(true);
    setVerifyError(null);
    try {
      const availability = await getAvailability({ sku });
      setVariantId(availability.variantId);
      setVerifiedSku(sku);
    } catch {
      setVariantId(null);
      setVerifiedSku("");
      setVerifyError(t("adjustments.skuNotFound"));
    } finally {
      setVerifying(false);
    }
  };

  const mutation = useMutation({
    mutationFn: () =>
      createAdjustment({
        variantId: variantId as string,
        locationId,
        bucket,
        delta: quantity,
        reason,
      }),
    onSuccess: async () => {
      toast.showToast("success", t("adjustments.success"));
      await queryClient.invalidateQueries({ queryKey: ["balances"] });
      await queryClient.invalidateQueries({ queryKey: ["movements"] });
      setConfirmOpen(false);
    },
    onError: (error) => {
      const message = problemMessage(error, t("adjustments.failed"));
      toast.showToast("error", message);
      setConfirmOpen(false);
    },
  });

  const locationName =
    locations.find((location: Location) => location.id === locationId)?.name ??
    locationId;
  const reasonOptions = (enumsQuery.data?.adjustmentReasons ?? []).map(
    (value) => ({
      value,
      label: t(`reason.${value}`),
    }),
  );
  const bucketOptions = (enumsQuery.data?.stockBuckets ?? STOCK_BUCKETS).map(
    (value) => ({
      value,
      label: t(`bucket.${value}`),
    }),
  );
  const locationOptions = locations.map((location: Location) => ({
    value: location.id,
    label: location.name,
  }));

  const canSubmit =
    variantId !== null &&
    locationId !== "" &&
    quantity !== 0 &&
    reason !== "" &&
    !mutation.isPending;

  const submit = (): void => {
    if (!canSubmit) {
      return;
    }
    setConfirmOpen(true);
  };

  const deltaLabel =
    quantity > 0 ? `+${formatNumber(quantity)}` : formatNumber(quantity);

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4">
      <PageHeader
        title={t("adjustments.title")}
        description={t("adjustments.description")}
      />
      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Input
              label={t("adjustments.sku")}
              value={skuInput}
              onChange={(event) => setSkuInput(event.target.value)}
              placeholder={t("adjustments.skuPlaceholder")}
              className="font-mono"
            />
            <Button
              variant="outlined"
              onClick={() => void verify()}
              loading={verifying}
              disabled={skuInput.trim() === ""}
            >
              {t("adjustments.verify")}
            </Button>
          </div>
          {verifyError !== null ? (
            <p className="text-caption font-semibold text-alert">
              {verifyError}
            </p>
          ) : variantId !== null ? (
            <p className="text-caption font-semibold text-success">
              {t("adjustments.skuVerified")}
            </p>
          ) : null}

          <Select
            label={t("adjustments.location")}
            options={locationOptions}
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
          />
          <Select
            label={t("adjustments.bucket")}
            options={bucketOptions}
            value={bucket}
            onChange={(event) => setBucket(event.target.value as StockBucket)}
          />
          <p className="text-caption text-ink-600">
            {t("adjustments.bucketHint")}
          </p>

          <div className="flex flex-col gap-2">
            <span className="text-body2 font-semibold text-ink-800">
              {t("adjustments.quantity")}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outlined"
                size="sm"
                aria-label={t("adjustments.decrease")}
                onClick={() => setQuantity((value) => value - 1)}
              >
                −
              </Button>
              <Input
                label={t("adjustments.quantity")}
                hideLabel
                type="number"
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value))}
                className="w-24 text-center font-mono"
              />
              <Button
                variant="outlined"
                size="sm"
                aria-label={t("adjustments.increase")}
                onClick={() => setQuantity((value) => value + 1)}
              >
                +
              </Button>
            </div>
            <p className="text-caption text-ink-600">
              {t("adjustments.quantityHint")}
            </p>
            {quantity === 0 ? (
              <p className="text-caption font-semibold text-alert">
                {t("adjustments.zeroQuantity")}
              </p>
            ) : null}
          </div>

          <Select
            label={t("adjustments.reason")}
            options={reasonOptions}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <p className="text-caption text-ink-600">
            {t("adjustments.reasonHint")}
          </p>

          <Card className="p-3">
            <p className="text-body2 font-bold text-ink-900">
              {t("adjustments.previewTitle")}
            </p>
            <p className="text-caption text-ink-600">
              {t("adjustments.previewHint")}
            </p>
            {variantId === null || locationId === "" ? (
              <p className="mt-2 text-caption text-ink-500">
                {t("adjustments.previewPending")}
              </p>
            ) : balancesQuery.isLoading ? (
              <Skeleton className="mt-2 h-4 w-40" />
            ) : (
              <div className="mt-2 flex flex-wrap gap-4 text-body2">
                <div>
                  <span className="text-caption text-ink-500">
                    {t("adjustments.previewCurrent")}:{" "}
                  </span>
                  <span className="font-mono font-bold text-ink-900">
                    {formatNumber(currentBalance)}
                  </span>
                </div>
                <div>
                  <span className="text-caption text-ink-500">
                    {t("adjustments.previewAfter")}:{" "}
                  </span>
                  <span className="font-mono font-bold text-ink-900">
                    {formatNumber(currentBalance + quantity)}
                  </span>
                </div>
              </div>
            )}
          </Card>

          <div className="flex justify-end gap-2">
            <Button
              loading={mutation.isPending}
              disabled={!canSubmit}
              onClick={submit}
            >
              {t("action.save")}
            </Button>
          </div>

          {mutation.isSuccess && variantId !== null ? (
            <Link
              to={`/inventory/movements?variantId=${encodeURIComponent(variantId)}`}
              className="text-caption text-info hover:underline"
            >
              {t("adjustments.linkMovements")}
            </Link>
          ) : null}
        </div>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => mutation.mutate()}
        title={t("adjustments.confirmTitle")}
        body={t("adjustments.confirmBody", {
          delta: deltaLabel,
          bucket: t(`bucket.${bucket}`),
          sku: verifiedSku,
          location: locationName,
        })}
        confirmLabel={t("action.confirm")}
        loading={mutation.isPending}
      />
    </div>
  );
}
