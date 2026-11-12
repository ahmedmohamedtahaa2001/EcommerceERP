import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  Button,
  Card,
  Input,
  PageHeader,
  Skeleton,
  Table,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from "../../components/ui";
import { ApiError } from "../../lib/api/client";
import { listCustomers } from "../../lib/api/customers";
import { createOrder } from "../../lib/api/orders";
import type { CreateOrderRequest } from "../../lib/api/orders";
import { listProducts, listVariants } from "../../lib/api/products";
import { formatMinorAsMajor } from "../../lib/money";
import { useT } from "../../lib/i18n";
import {
  addLine,
  buildCreateOrderPayload,
  emptyDraft,
  lineErrorsOf,
  subtotalMinor,
  validateOrderDraft,
  type DraftLine,
  type OrderDraft,
} from "./order-draft";

const CUSTOMER_SEARCH_MIN_LENGTH = 3;

export function NewOrderPage() {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<OrderDraft>(emptyDraft);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const keyRef = useRef<{ body: string; key: string } | null>(null);

  const errors = useMemo(() => validateOrderDraft(draft), [draft]);
  const hasErrors = useMemo(
    () =>
      Boolean(
        errors.phone ||
        errors.line1 ||
        errors.governorate ||
        errors.lines === "empty" ||
        lineErrorsOf(errors).some((line) => line.quantity || line.unitPrice),
      ),
    [errors],
  );

  const mutation = useMutation({
    mutationFn: (payload: CreateOrderRequest) => {
      const body = JSON.stringify(payload);
      if (keyRef.current?.body !== body) {
        keyRef.current = { body, key: crypto.randomUUID() };
      }
      return createOrder(payload, keyRef.current.key);
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      if (result.duplicate) {
        toast.showToast("info", t("newOrder.duplicateNotice"));
      } else {
        toast.showToast("success", t("newOrder.created"));
      }
      navigate(`/orders/${result.order.id}`);
    },
    onError: (error) => {
      const detail =
        error instanceof ApiError ? error.problem.detail : undefined;
      setServerError(detail ?? t("newOrder.createFailed"));
      toast.showToast("error", t("newOrder.createFailed"));
    },
  });

  const update = (patch: Partial<OrderDraft>) => {
    setServerError(null);
    setDraft((current) => ({ ...current, ...patch }));
  };

  const submit = () => {
    setTouched(true);
    setServerError(null);
    if (!hasErrors && draft.lines.length > 0) {
      mutation.mutate(buildCreateOrderPayload(draft));
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4">
      <nav aria-label="breadcrumb" className="text-caption text-ink-600">
        <Link to="/orders" className="hover:underline">
          {t("newOrder.back")}
        </Link>
      </nav>
      <PageHeader
        title={t("newOrder.title")}
        description={t("newOrder.description")}
      />

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <CustomerSection
          draft={draft}
          update={update}
          touched={touched}
          errors={errors}
        />
        <AddressSection
          draft={draft}
          update={update}
          touched={touched}
          errors={errors}
        />
        <LinesSection
          draft={draft}
          update={update}
          setDraft={setDraft}
          touched={touched}
          errors={errors}
        />
        <PaymentSection draft={draft} update={update} />

        {serverError ? (
          <p role="alert" className="text-body2 text-danger">
            {serverError}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <p className="text-body1 font-semibold text-ink-900">
            {t("newOrder.subtotal")}: {formatMinorAsMajor(subtotalMinor(draft))}{" "}
            {draft.lines[0]?.currency ?? "EGP"}
          </p>
          <Button type="submit" loading={mutation.isPending}>
            {t("newOrder.submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}

type Errors = ReturnType<typeof validateOrderDraft>;
type Update = (patch: Partial<OrderDraft>) => void;

function fieldError(
  touched: boolean,
  code: "required" | undefined,
  t: ReturnType<typeof useT>,
): string | null {
  return touched && code === "required" ? t("customers.form.required") : null;
}

function CustomerSection({
  draft,
  update,
  touched,
  errors,
}: {
  draft: OrderDraft;
  update: Update;
  touched: boolean;
  errors: Errors;
}) {
  const t = useT();
  const [search, setSearch] = useState("");
  const matches = useQuery({
    queryKey: ["customer-picker", search],
    queryFn: () => listCustomers({ q: search }),
    enabled: search.trim().length >= CUSTOMER_SEARCH_MIN_LENGTH,
  });

  return (
    <Card>
      <h2 className="text-subtitle1 font-bold text-ink-900">
        {t("newOrder.customer")}
      </h2>
      <div className="mt-3 flex flex-col gap-3">
        <Input
          label={t("newOrder.searchCustomer")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          hint={t("newOrder.searchCustomerHint")}
        />
        {matches.data && matches.data.customers.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {matches.data.customers.slice(0, 5).map((customer) => (
              <li key={customer.id}>
                <button
                  type="button"
                  className="w-full rounded-sm px-3 py-2 text-start text-body2 hover:bg-ink-100"
                  onClick={() => {
                    update({
                      phone: customer.phone,
                      fullName: customer.fullName ?? "",
                    });
                    setSearch("");
                  }}
                >
                  <span className="font-semibold">
                    {customer.fullName ?? t("customers.noName")}
                  </span>{" "}
                  <bdi dir="ltr" className="font-mono text-ink-600">
                    {customer.phone}
                  </bdi>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <Input
          label={t("customers.form.phone")}
          value={draft.phone}
          onChange={(event) => update({ phone: event.target.value })}
          error={fieldError(touched, errors.phone, t)}
          hint={t("customers.form.phoneHint")}
          inputMode="tel"
          dir="ltr"
          required
        />
        <Input
          label={t("customers.form.name")}
          value={draft.fullName}
          onChange={(event) => update({ fullName: event.target.value })}
        />
      </div>
    </Card>
  );
}

function AddressSection({
  draft,
  update,
  touched,
  errors,
}: {
  draft: OrderDraft;
  update: Update;
  touched: boolean;
  errors: Errors;
}) {
  const t = useT();
  return (
    <Card>
      <h2 className="text-subtitle1 font-bold text-ink-900">
        {t("newOrder.address")}
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input
            label={t("newOrder.line1")}
            value={draft.line1}
            onChange={(event) => update({ line1: event.target.value })}
            error={fieldError(touched, errors.line1, t)}
            required
          />
        </div>
        <Input
          label={t("newOrder.line2")}
          value={draft.line2}
          onChange={(event) => update({ line2: event.target.value })}
        />
        <Input
          label={t("newOrder.city")}
          value={draft.city}
          onChange={(event) => update({ city: event.target.value })}
        />
        <Input
          label={t("newOrder.governorate")}
          value={draft.governorate}
          onChange={(event) => update({ governorate: event.target.value })}
          error={fieldError(touched, errors.governorate, t)}
          hint={t("newOrder.governorateHint")}
          required
        />
      </div>
    </Card>
  );
}

function LinesSection({
  draft,
  update,
  setDraft,
  touched,
  errors,
}: {
  draft: OrderDraft;
  update: Update;
  setDraft: (value: OrderDraft | ((current: OrderDraft) => OrderDraft)) => void;
  touched: boolean;
  errors: Errors;
}) {
  const t = useT();
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const products = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const variants = useQuery({
    queryKey: ["variants", productId],
    queryFn: () => listVariants(productId),
    enabled: productId !== "",
  });

  const addSelected = () => {
    const variant = variants.data?.variants.find(
      (item) => item.id === variantId,
    );
    const product = products.data?.products.find(
      (item) => item.id === productId,
    );
    if (!variant || !product) return;
    setDraft((current) =>
      addLine(current, {
        sku: variant.sku,
        productName: product.nameEn,
        priceMinor: variant.priceMinor,
        currency: variant.currency,
      }),
    );
    setVariantId("");
  };

  const setLine = (index: number, patch: Partial<DraftLine>) =>
    update({
      lines: draft.lines.map((line, i) =>
        i === index ? { ...line, ...patch } : line,
      ),
    });

  return (
    <Card>
      <h2 className="text-subtitle1 font-bold text-ink-900">
        {t("newOrder.lines")}
      </h2>
      <div className="mt-3 flex flex-col gap-3">
        {products.isLoading ? (
          <Skeleton className="h-10" />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <select
              aria-label={t("newOrder.product")}
              value={productId}
              onChange={(event) => {
                setProductId(event.target.value);
                setVariantId("");
              }}
              className="h-11 rounded-sm border border-ink-300 bg-surface px-3 text-body1"
            >
              <option value="">{t("newOrder.chooseProduct")}</option>
              {(products.data?.products ?? []).map((product) => (
                <option key={product.id} value={product.id}>
                  {product.nameEn}
                </option>
              ))}
            </select>
            <select
              aria-label={t("newOrder.variant")}
              value={variantId}
              disabled={productId === ""}
              onChange={(event) => setVariantId(event.target.value)}
              className="h-11 rounded-sm border border-ink-300 bg-surface px-3 text-body1 disabled:opacity-50"
            >
              <option value="">{t("newOrder.chooseVariant")}</option>
              {(variants.data?.variants ?? []).map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.sku}
                  {variant.priceMinor === null
                    ? ""
                    : ` — ${formatMinorAsMajor(variant.priceMinor)} ${variant.currency}`}
                </option>
              ))}
            </select>
            <Button
              variant="outlined"
              disabled={variantId === ""}
              onClick={addSelected}
            >
              {t("newOrder.addLine")}
            </Button>
          </div>
        )}

        {touched && errors.lines === "empty" ? (
          <p className="text-body2 text-danger">
            {t("newOrder.linesRequired")}
          </p>
        ) : null}

        {draft.lines.length > 0 ? (
          <div className="rounded-lg bg-surface shadow-sm">
            <Table ariaLabel={t("newOrder.lines")} zebra>
              <THead>
                <tr>
                  <TH>{t("newOrder.col.sku")}</TH>
                  <TH>{t("newOrder.col.quantity")}</TH>
                  <TH>{t("newOrder.col.unitPrice")}</TH>
                  <TH>{t("newOrder.col.total")}</TH>
                  <TH>
                    <span className="sr-only">{t("newOrder.remove")}</span>
                  </TH>
                </tr>
              </THead>
              <tbody>
                {draft.lines.map((line, index) => {
                  const lineErrors = lineErrorsOf(errors)[index];
                  return (
                    <TR key={`${line.sku}-${index}`}>
                      <TD className="font-mono" dir="ltr">
                        {line.sku}
                      </TD>
                      <TD>
                        <Input
                          label={t("newOrder.col.quantity")}
                          hideLabel
                          value={line.quantity}
                          onChange={(event) =>
                            setLine(index, { quantity: event.target.value })
                          }
                          error={
                            touched && lineErrors?.quantity
                              ? t("newOrder.quantityInvalid")
                              : null
                          }
                          inputMode="numeric"
                          dir="ltr"
                        />
                      </TD>
                      <TD>
                        <Input
                          label={t("newOrder.col.unitPrice")}
                          hideLabel
                          value={line.unitPrice}
                          onChange={(event) =>
                            setLine(index, { unitPrice: event.target.value })
                          }
                          error={
                            touched && lineErrors?.unitPrice
                              ? t(
                                  lineErrors.unitPrice === "required"
                                    ? "variantForm.price"
                                    : "variantForm.priceInvalid",
                                )
                              : null
                          }
                          inputMode="decimal"
                          dir="ltr"
                        />
                      </TD>
                      <TD dir="ltr">
                        {(() => {
                          const total = subtotalMinor({
                            ...draft,
                            lines: [line],
                          });
                          return total === 0 ? "—" : formatMinorAsMajor(total);
                        })()}
                      </TD>
                      <TD>
                        <Button
                          variant="text"
                          size="sm"
                          onClick={() =>
                            update({
                              lines: draft.lines.filter((_, i) => i !== index),
                            })
                          }
                        >
                          {t("newOrder.remove")}
                        </Button>
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function PaymentSection({
  draft,
  update,
}: {
  draft: OrderDraft;
  update: Update;
}) {
  const t = useT();
  return (
    <Card>
      <h2 className="text-subtitle1 font-bold text-ink-900">
        {t("newOrder.payment")}
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-body2 text-ink-800">
          {t("newOrder.paymentMethod")}
          <select
            value={draft.paymentMethod}
            onChange={(event) =>
              update({ paymentMethod: event.target.value as "cod" | "prepaid" })
            }
            className="h-11 rounded-sm border border-ink-300 bg-surface px-3 text-body1"
          >
            <option value="cod">{t("newOrder.payment.cod")}</option>
            <option value="prepaid">{t("newOrder.payment.prepaid")}</option>
          </select>
        </label>
        <Input
          label={t("newOrder.channel")}
          value={draft.channel}
          onChange={(event) => update({ channel: event.target.value })}
          dir="ltr"
        />
        <Input
          label={t("newOrder.externalOrderId")}
          value={draft.externalOrderId}
          onChange={(event) => update({ externalOrderId: event.target.value })}
          hint={t("newOrder.externalOrderIdHint")}
          dir="ltr"
        />
      </div>
    </Card>
  );
}
