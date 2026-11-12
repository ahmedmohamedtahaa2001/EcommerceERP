import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getAvailability,
  listBalances,
  listLocations,
} from "../../lib/api/inventory";
import type { Location } from "../../lib/api/inventory";
import { createTransfer } from "../../lib/api/transfers";
import { problemMessage } from "../../lib/api/problem-message";
import { useT } from "../../lib/i18n";
import { formatNumber } from "../../lib/format";
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

/** Moves on-hand stock between two locations (both movements recorded together). */
export function TransfersPage() {
  const t = useT();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [skuInput, setSkuInput] = useState("");
  const [variantId, setVariantId] = useState<string | null>(null);
  const [verifiedSku, setVerifiedSku] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [done, setDone] = useState(false);

  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: listLocations,
  });
  const locations = locationsQuery.data?.locations ?? [];

  const fromBalanceQuery = useQuery({
    queryKey: ["balances", variantId, fromId],
    queryFn: () =>
      listBalances({ variantId: variantId as string, locationId: fromId }),
    enabled: variantId !== null && fromId !== "",
  });
  const available = (fromBalanceQuery.data?.balances ?? [])
    .filter((balance) => balance.bucket === "on_hand")
    .reduce((sum, balance) => sum + balance.quantity, 0);

  const verify = async (): Promise<void> => {
    const sku = skuInput.trim();
    if (sku === "") return;
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
      createTransfer({
        variantId: variantId as string,
        fromLocationId: fromId,
        toLocationId: toId,
        quantity,
        reason: reason.trim(),
      }),
    onSuccess: async () => {
      toast.showToast("success", t("transfers.success"));
      setConfirmOpen(false);
      setDone(true);
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["balances"] });
      await queryClient.invalidateQueries({ queryKey: ["movements"] });
    },
    onError: (error) => {
      toast.showToast("error", problemMessage(error, t("transfers.failed")));
      setConfirmOpen(false);
    },
  });

  const nameOf = (id: string) =>
    locations.find((location: Location) => location.id === id)?.name ?? "";
  const locationOptions = [
    { value: "", label: t("transfers.chooseLocation") },
    ...locations.map((location: Location) => ({
      value: location.id,
      label: location.name,
    })),
  ];

  const sameLocation = fromId !== "" && fromId === toId;
  const tooMuch =
    variantId !== null && fromId !== "" && !fromBalanceQuery.isLoading
      ? quantity > available
      : false;
  const canSubmit =
    variantId !== null &&
    fromId !== "" &&
    toId !== "" &&
    !sameLocation &&
    Number.isInteger(quantity) &&
    quantity > 0 &&
    !tooMuch &&
    reason.trim() !== "" &&
    !mutation.isPending;

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4">
      <PageHeader
        title={t("transfers.title")}
        description={t("transfers.description")}
      />
      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Input
              label={t("adjustments.sku")}
              value={skuInput}
              onChange={(event) => {
                setSkuInput(event.target.value);
                setDone(false);
              }}
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
              {t("transfers.skuVerified")}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={t("transfers.from")}
              options={locationOptions}
              value={fromId}
              onChange={(event) => setFromId(event.target.value)}
            />
            <Select
              label={t("transfers.to")}
              options={locationOptions}
              value={toId}
              onChange={(event) => setToId(event.target.value)}
            />
          </div>
          {sameLocation ? (
            <p className="text-caption font-semibold text-alert">
              {t("transfers.sameLocation")}
            </p>
          ) : null}

          {variantId !== null && fromId !== "" ? (
            fromBalanceQuery.isLoading ? (
              <Skeleton className="h-4 w-40" />
            ) : (
              <p className="text-body2 text-ink-700">
                {t("transfers.available", {
                  quantity: formatNumber(available),
                  location: nameOf(fromId),
                })}
              </p>
            )
          ) : null}

          <Input
            label={t("transfers.quantity")}
            type="number"
            min={1}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            className="w-32 font-mono"
          />
          {tooMuch ? (
            <p className="text-caption font-semibold text-alert">
              {t("transfers.tooMuch")}
            </p>
          ) : null}

          <Input
            label={t("transfers.reason")}
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("transfers.reasonPlaceholder")}
          />

          <div className="flex justify-end">
            <Button
              loading={mutation.isPending}
              disabled={!canSubmit}
              onClick={() => setConfirmOpen(true)}
            >
              {t("transfers.submit")}
            </Button>
          </div>

          {done && variantId !== null ? (
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
        title={t("transfers.confirmTitle")}
        body={t("transfers.confirmBody", {
          quantity: formatNumber(quantity),
          sku: verifiedSku,
          from: nameOf(fromId),
          to: nameOf(toId),
        })}
        confirmLabel={t("action.confirm")}
        loading={mutation.isPending}
      />
    </div>
  );
}
