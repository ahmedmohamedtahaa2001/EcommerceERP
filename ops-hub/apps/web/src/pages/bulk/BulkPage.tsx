import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  Button,
  Card,
  ConfirmDialog,
  Input,
  PageHeader,
  Skeleton,
  useToast,
} from "../../components/ui";
import { ApiError } from "../../lib/api/client";
import {
  changeProductsPrices,
  setProductsStatus,
  type BulkResult,
} from "../../lib/api/bulk";
import { listProducts, type Product } from "../../lib/api/products";
import { useT } from "../../lib/i18n";
import {
  buildPriceChange,
  validatePriceChange,
  type PriceMode,
} from "./bulk-form";

const STATUSES = ["active", "draft", "archived"] as const;

export function BulkPage() {
  const t = useT();
  const toast = useToast();
  const queryClient = useQueryClient();
  const products = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{
    title: string;
    data: BulkResult;
    names: Map<string, string>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("active");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [mode, setMode] = useState<PriceMode>("percent");
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);

  const list = products.data?.products ?? [];
  const names = new Map(list.map((product) => [product.id, product.nameEn]));
  const ids = [...selected];

  const finish = async (title: string, data: BulkResult) => {
    setResult({ title, data, names });
    setError(null);
    await queryClient.invalidateQueries({ queryKey: ["products"] });
  };
  const fail = (err: unknown) => {
    const detail = err instanceof ApiError ? err.problem.detail : undefined;
    setError(detail ?? t("bulk.failed"));
  };

  const statusMutation = useMutation({
    mutationFn: () => setProductsStatus(ids, status),
    onSuccess: (data) => {
      setConfirmArchive(false);
      toast.showToast("success", t("bulk.done"));
      void finish(t("bulk.status.title"), data);
    },
    onError: (err) => {
      setConfirmArchive(false);
      fail(err);
    },
  });

  const priceMutation = useMutation({
    mutationFn: () =>
      changeProductsPrices(ids, buildPriceChange({ mode, value })),
    onSuccess: (data) => {
      toast.showToast("success", t("bulk.done"));
      setValue("");
      setTouched(false);
      void finish(t("bulk.prices.title"), data);
    },
    onError: fail,
  });

  const priceErrors = validatePriceChange({ mode, value });
  const priceMessage =
    !touched || !priceErrors.value
      ? null
      : t(`bulk.prices.error.${priceErrors.value}`);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4">
      <PageHeader title={t("bulk.title")} description={t("bulk.description")} />

      <Card>
        <h2 className="text-subtitle1 font-bold text-ink-900">
          {t("bulk.select")}
        </h2>
        <p className="mt-1 text-body2 text-ink-700">
          {t("bulk.selectedCount", { count: selected.size })}
        </p>
        {products.isLoading ? (
          <Skeleton className="mt-3 h-32" />
        ) : (
          <div className="mt-3 flex max-h-72 flex-col gap-1 overflow-auto">
            <label className="flex items-center gap-2 text-body2 font-semibold text-ink-800">
              <input
                type="checkbox"
                checked={list.length > 0 && selected.size === list.length}
                onChange={(event) =>
                  setSelected(
                    event.target.checked
                      ? new Set(list.map((p: Product) => p.id))
                      : new Set(),
                  )
                }
              />
              {t("bulk.selectAll")}
            </label>
            {list.map((product) => (
              <label
                key={product.id}
                className="flex items-center gap-2 text-body2 text-ink-800"
              >
                <input
                  type="checkbox"
                  checked={selected.has(product.id)}
                  onChange={() => toggle(product.id)}
                />
                {product.nameEn}
                <span className="text-caption text-ink-500">
                  {t(`productStatus.${product.status}`)}
                </span>
              </label>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-subtitle1 font-bold text-ink-900">
            {t("bulk.status.title")}
          </h2>
          <p className="mt-1 text-body2 text-ink-700">
            {t("bulk.status.body")}
          </p>
          <div className="mt-3 flex items-end gap-2">
            <label className="flex flex-1 flex-col gap-1 text-body2 text-ink-800">
              {t("bulk.status.to")}
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as (typeof STATUSES)[number])
                }
                className="h-11 rounded-sm border border-ink-300 bg-surface px-3 text-body1"
              >
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {t(`productStatus.${value}`)}
                  </option>
                ))}
              </select>
            </label>
            <Button
              loading={statusMutation.isPending}
              disabled={ids.length === 0}
              onClick={() =>
                status === "archived"
                  ? setConfirmArchive(true)
                  : statusMutation.mutate()
              }
            >
              {t("bulk.apply")}
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-subtitle1 font-bold text-ink-900">
            {t("bulk.prices.title")}
          </h2>
          <p className="mt-1 text-body2 text-ink-700">
            {t("bulk.prices.body")}
          </p>
          <div className="mt-3 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-body2 text-ink-800">
              {t("bulk.prices.mode")}
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as PriceMode)}
                className="h-11 rounded-sm border border-ink-300 bg-surface px-3 text-body1"
              >
                <option value="percent">{t("bulk.prices.mode.percent")}</option>
                <option value="set">{t("bulk.prices.mode.set")}</option>
              </select>
            </label>
            <Input
              label={
                mode === "percent"
                  ? t("bulk.prices.percent")
                  : t("bulk.prices.fixed")
              }
              value={value}
              onChange={(event) => setValue(event.target.value)}
              error={priceMessage}
              inputMode="decimal"
              dir="ltr"
            />
            <div className="flex justify-end">
              <Button
                loading={priceMutation.isPending}
                disabled={ids.length === 0}
                onClick={() => {
                  setTouched(true);
                  if (!priceErrors.value) priceMutation.mutate();
                }}
              >
                {t("bulk.apply")}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {error ? (
        <p role="alert" className="text-body2 font-semibold text-danger">
          {error}
        </p>
      ) : null}

      {result ? (
        <Card>
          <h2 className="text-subtitle1 font-bold text-ink-900">
            {result.title}
          </h2>
          <p className="mt-2 text-body2 text-ink-800" role="status">
            {t("bulk.result", {
              total: result.data.total,
              succeeded: result.data.succeeded,
              skipped: result.data.skipped,
              failed: result.data.failed,
            })}
          </p>
          {result.data.items.some((item) => item.outcome !== "ok") ? (
            <ul className="mt-3 flex flex-col gap-1 text-body2 text-ink-700">
              {result.data.items
                .filter((item) => item.outcome !== "ok")
                .map((item) => (
                  <li key={item.id}>
                    {result.names.get(item.id) ?? item.id}:{" "}
                    {item.reason ?? t(`bulk.outcome.${item.outcome}`)}
                  </li>
                ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        onConfirm={() => statusMutation.mutate()}
        title={t("bulk.archive.title")}
        body={t("bulk.archive.body", { count: ids.length })}
        confirmLabel={t("bulk.archive.confirm")}
        loading={statusMutation.isPending}
      />
    </div>
  );
}
