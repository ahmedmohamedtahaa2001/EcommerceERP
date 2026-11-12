import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button, Input, Modal, useToast } from "../../components/ui";
import { ApiError } from "../../lib/api/client";
import {
  getPutawaySuggestion,
  putawayIntoBin,
  type Bin,
  type Location,
} from "../../lib/api/inventory";
import { listProducts, listVariants } from "../../lib/api/products";
import { useT } from "../../lib/i18n";
import { validatePutaway } from "./putaway-form";

const EMPTY = { productId: "", variantId: "", binId: "", quantity: "" };

export function PutawayModal({
  open,
  location,
  bins,
  onClose,
}: {
  open: boolean;
  location: Location;
  bins: readonly Bin[];
  onClose: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [values, setValues] = useState(EMPTY);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const products = useQuery({
    queryKey: ["products"],
    queryFn: listProducts,
    enabled: open,
  });
  const variants = useQuery({
    queryKey: ["variants", values.productId],
    queryFn: () => listVariants(values.productId),
    enabled: values.productId !== "",
  });
  const suggestion = useQuery({
    queryKey: ["putaway-suggestion", values.variantId, location.id],
    queryFn: () =>
      getPutawaySuggestion({
        variantId: values.variantId,
        locationId: location.id,
      }),
    enabled: values.variantId !== "",
    retry: false,
  });

  // Start from the suggested bin; the user can still choose another one.
  useEffect(() => {
    if (suggestion.data && values.binId === "") {
      setValues((current) => ({ ...current, binId: suggestion.data.binId }));
    }
  }, [suggestion.data, values.binId]);

  const mutation = useMutation({
    mutationFn: () =>
      putawayIntoBin(values.binId, {
        variantId: values.variantId,
        quantity: Number(values.quantity),
      }),
    onSuccess: async () => {
      toast.showToast("success", t("putaway.done"));
      await queryClient.invalidateQueries({ queryKey: ["bins", location.id] });
      await queryClient.invalidateQueries({ queryKey: ["bin-contents"] });
      setValues(EMPTY);
      setTouched(false);
      setServerError(null);
      onClose();
    },
    onError: (error) => {
      const detail =
        error instanceof ApiError ? error.problem.detail : undefined;
      setServerError(detail ?? t("putaway.failed"));
      toast.showToast("error", t("putaway.failed"));
    },
  });

  const errors = validatePutaway({
    variantId: values.variantId,
    binId: values.binId,
    quantity: values.quantity,
  });
  const selectedVariant = variants.data?.variants.find(
    (item) => item.id === values.variantId,
  );

  const submit = () => {
    setTouched(true);
    setServerError(null);
    if (Object.keys(errors).length === 0) mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("putaway.title")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button loading={mutation.isPending} onClick={submit}>
            {t("putaway.submit")}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => event.preventDefault()}
      >
        <p className="text-body2 text-ink-700">
          {t("putaway.explain", { location: location.name })}
        </p>

        <label className="flex flex-col gap-1 text-body2 text-ink-800">
          {t("putaway.product")}
          <select
            value={values.productId}
            onChange={(event) =>
              setValues({ ...EMPTY, productId: event.target.value })
            }
            className="h-11 rounded-sm border border-ink-300 bg-surface px-3 text-body1"
          >
            <option value="">{t("newOrder.chooseProduct")}</option>
            {(products.data?.products ?? []).map((product) => (
              <option key={product.id} value={product.id}>
                {product.nameEn}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-body2 text-ink-800">
          {t("putaway.variant")}
          <select
            value={values.variantId}
            disabled={values.productId === ""}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                variantId: event.target.value,
                binId: "",
              }))
            }
            className="h-11 rounded-sm border border-ink-300 bg-surface px-3 text-body1 disabled:opacity-50"
          >
            <option value="">{t("newOrder.chooseVariant")}</option>
            {(variants.data?.variants ?? []).map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.sku}
              </option>
            ))}
          </select>
        </label>

        {values.variantId !== "" ? (
          <p
            className="rounded-sm bg-ink-100 px-3 py-2 text-body2 text-ink-800"
            role="status"
          >
            {suggestion.isLoading
              ? t("putaway.suggesting")
              : suggestion.data
                ? t("putaway.suggestion", {
                    code: suggestion.data.binCode,
                    reason: suggestion.data.reason,
                  })
                : t("putaway.noSuggestion")}
          </p>
        ) : null}

        <label className="flex flex-col gap-1 text-body2 text-ink-800">
          {t("putaway.bin")}
          <select
            value={values.binId}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                binId: event.target.value,
              }))
            }
            className="h-11 rounded-sm border border-ink-300 bg-surface px-3 text-body1"
          >
            <option value="">{t("putaway.chooseBin")}</option>
            {bins.map((bin) => (
              <option key={bin.id} value={bin.id}>
                {bin.code}
                {bin.capacity === null
                  ? ""
                  : ` — ${bin.used ?? 0}/${bin.capacity}`}
              </option>
            ))}
          </select>
          {touched && errors.binId ? (
            <span className="text-caption text-danger">
              {t("customers.form.required")}
            </span>
          ) : null}
        </label>

        <Input
          label={t("putaway.quantity")}
          value={values.quantity}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              quantity: event.target.value,
            }))
          }
          error={
            touched && errors.quantity ? t("putaway.quantityInvalid") : null
          }
          hint={selectedVariant ? t("putaway.quantityHint") : undefined}
          inputMode="numeric"
          dir="ltr"
        />

        {serverError ? (
          <p role="alert" className="text-body2 text-danger">
            {serverError}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
