import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createVariant,
  getProduct,
  listVariants,
  updateProduct,
} from "../../lib/api/products";
import type { Product, ProductStatus, Variant } from "../../lib/api/products";
import { getAvailability } from "../../lib/api/inventory";
import { useT } from "../../lib/i18n";
import { formatDate } from "../../lib/format";
import {
  Breadcrumbs,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Skeleton,
  Table,
  Tag,
  THead,
  TH,
  TD,
  useToast,
} from "../../components/ui";
import { AvailabilityBuckets, InfoIcon } from "./AvailabilityBuckets";
import {
  formatMinorAsMajor,
  parseMajorToMinor,
  parseTags,
} from "./product-attributes";

/** On-demand availability panel for one variant SKU. */
function VariantAvailability({ sku }: { sku: string }) {
  const t = useT();
  const query = useQuery({
    queryKey: ["availability", sku, null],
    queryFn: () => getAvailability({ sku }),
    enabled: true,
    staleTime: 15_000,
  });

  return (
    <div
      className="border-b border-ink-200 bg-primary-lightest/40 px-4 py-3"
      role="region"
    >
      <p className="mb-2 text-caption font-bold text-ink-700">
        {t("availability.popoverTitle")}
      </p>
      {query.isLoading ? (
        <Skeleton className="h-8 w-64" />
      ) : query.isError ? (
        <ErrorState
          error={query.error}
          onRetry={query.refetch}
          className="py-4"
        />
      ) : (
        <AvailabilityBuckets
          buckets={query.data?.total ?? null}
          ariaLabel={t("availability.popoverTitle")}
        />
      )}
    </div>
  );
}

/** Key-value chips for variant attributes. */
function AttributeChips({
  attributes,
}: {
  attributes: Record<string, string>;
}) {
  const t = useT();
  const entries = Object.entries(attributes);
  if (entries.length === 0) {
    return (
      <span className="text-caption text-ink-500">
        {t("detail.noAttributes")}
      </span>
    );
  }
  return (
    <span className="flex flex-wrap gap-1">
      {entries.map(([key, value]) => (
        <Tag key={key} tone="primary">
          {key}: {value}
        </Tag>
      ))}
    </span>
  );
}

function VariantsSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="rounded-lg bg-surface shadow-sm"
    >
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b border-ink-200 px-4 py-4"
        >
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-52" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="ms-auto h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

/** Info card for the product itself + inline edit modal trigger. */
function ProductInfoCard({
  product,
  onEdit,
}: {
  product: Product;
  onEdit: () => void;
}) {
  const t = useT();
  return (
    <section
      aria-labelledby="product-info-title"
      className="rounded-lg bg-surface p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="product-info-title"
            className="text-subtitle1 font-bold text-ink-900"
          >
            {t("detail.infoTitle")}
          </h2>
          <p className="mt-1 text-body2 text-ink-600">
            {product.descriptionAr ?? ""}
          </p>
          <p className="text-body2 text-ink-600" dir="ltr">
            {product.descriptionEn ?? ""}
          </p>
        </div>
        <Button variant="outlined" size="sm" onClick={onEdit}>
          {t("detail.edit")}
        </Button>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-body2 sm:grid-cols-3">
        <div>
          <dt className="text-caption text-ink-500">
            {t("products.col.kind")}
          </dt>
          <dd className="mt-1">
            <Tag tone={product.kind === "bundle" ? "secondary" : "neutral"}>
              {t(`kind.${product.kind}`)}
            </Tag>
          </dd>
        </div>
        <div>
          <dt className="text-caption text-ink-500">
            {t("products.col.status")}
          </dt>
          <dd className="mt-1">
            <Tag
              tone={
                product.status === "active"
                  ? "success"
                  : product.status === "draft"
                    ? "warning"
                    : "neutral"
              }
            >
              {t(`productStatus.${product.status}`)}
            </Tag>
          </dd>
        </div>
        <div>
          <dt className="text-caption text-ink-500">
            {t("productForm.category")}
          </dt>
          <dd className="mt-1 font-semibold text-ink-800">
            {product.category ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-ink-500">
            {t("productForm.brand")}
          </dt>
          <dd className="mt-1 font-semibold text-ink-800">
            {product.brand ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-ink-500">{t("productForm.tags")}</dt>
          <dd className="mt-1 flex flex-wrap gap-1">
            {product.tags.length === 0
              ? "—"
              : product.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
          </dd>
        </div>
        {product.isHazardous ? (
          <div>
            <dt className="text-caption text-ink-500">
              {t("productForm.hazardous")}
            </dt>
            <dd className="mt-1">
              <Tag tone="warning">{t("productForm.hazardous")}</Tag>
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-caption text-ink-500">
            {t("products.col.created")}
          </dt>
          <dd className="mt-1 font-semibold text-ink-800">
            {formatDate(product.createdAt)}
          </dd>
        </div>
      </dl>
    </section>
  );
}

/** Inline product edit; `kind` is immutable on the API (PATCH has no kind). */
function EditProductModal({
  product,
  open,
  onClose,
}: {
  product: Product;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [nameAr, setNameAr] = useState(product.nameAr);
  const [nameEn, setNameEn] = useState(product.nameEn);
  const [descriptionAr, setDescriptionAr] = useState(
    product.descriptionAr ?? "",
  );
  const [descriptionEn, setDescriptionEn] = useState(
    product.descriptionEn ?? "",
  );
  const [category, setCategory] = useState(product.category ?? "");
  const [brand, setBrand] = useState(product.brand ?? "");
  const [tagsText, setTagsText] = useState(product.tags.join(", "));
  const [isHazardous, setIsHazardous] = useState(product.isHazardous);
  const [status, setStatus] = useState<ProductStatus>(product.status);

  const mutation = useMutation({
    mutationFn: () =>
      updateProduct(product.id, {
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim(),
        descriptionAr:
          descriptionAr.trim() === "" ? null : descriptionAr.trim(),
        descriptionEn:
          descriptionEn.trim() === "" ? null : descriptionEn.trim(),
        category: category.trim() === "" ? null : category.trim(),
        brand: brand.trim() === "" ? null : brand.trim(),
        tags: parseTags(tagsText),
        isHazardous,
        status,
      }),
    onSuccess: async () => {
      toast.showToast("success", t("products.created"));
      await queryClient.invalidateQueries({
        queryKey: ["product", product.id],
      });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      onClose();
    },
    onError: () => toast.showToast("error", t("products.createFailed")),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("productForm.editTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {t("action.save")}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => event.preventDefault()}
      >
        <Input
          label={t("productForm.nameAr")}
          value={nameAr}
          onChange={(event) => setNameAr(event.target.value)}
        />
        <Input
          label={t("productForm.nameEn")}
          value={nameEn}
          onChange={(event) => setNameEn(event.target.value)}
          dir="ltr"
        />
        <Input
          label={t("productForm.descriptionAr")}
          value={descriptionAr}
          onChange={(event) => setDescriptionAr(event.target.value)}
        />
        <Input
          label={t("productForm.descriptionEn")}
          value={descriptionEn}
          onChange={(event) => setDescriptionEn(event.target.value)}
          dir="ltr"
        />
        <Input
          label={t("productForm.category")}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        />
        <Input
          label={t("productForm.brand")}
          value={brand}
          onChange={(event) => setBrand(event.target.value)}
        />
        <Input
          label={t("productForm.tags")}
          value={tagsText}
          onChange={(event) => setTagsText(event.target.value)}
          hint={t("productForm.tagsHint")}
          dir="ltr"
        />
        <label className="flex items-center gap-2 text-body2 text-ink-800">
          <input
            type="checkbox"
            checked={isHazardous}
            onChange={(event) => setIsHazardous(event.target.checked)}
          />
          {t("productForm.hazardous")}
        </label>
        <select
          aria-label={t("productForm.status")}
          value={status}
          onChange={(event) => setStatus(event.target.value as ProductStatus)}
          className="h-11 rounded-sm border border-ink-300 bg-surface px-3 text-body1 text-ink-900 focus:border-primary"
        >
          {(["draft", "active", "archived"] as const).map((value) => (
            <option key={value} value={value}>
              {t(`productStatus.${value}`)}
            </option>
          ))}
        </select>
      </form>
    </Modal>
  );
}

/** Add-variant modal: SKU + key/value attributes + comma URLs. */
function AddVariantModal({
  productId,
  open,
  onClose,
}: {
  productId: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [sku, setSku] = useState("");
  const [pairs, setPairs] = useState<{ key: string; value: string }[]>([
    { key: "", value: "" },
  ]);
  const [images, setImages] = useState("");
  const [barcode, setBarcode] = useState("");
  const [weight, setWeight] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("EGP");
  const [touched, setTouched] = useState(false);

  const mutation = useMutation({
    mutationFn: () => {
      const attributes: Record<string, string> = {};
      for (const pair of pairs) {
        const key = pair.key.trim();
        if (key !== "") {
          attributes[key] = pair.value.trim();
        }
      }
      return createVariant({
        productId,
        sku: sku.trim(),
        barcode: barcode.trim() === "" ? null : barcode.trim(),
        weightGrams: weight.trim() === "" ? null : Number(weight),
        priceMinor: parseMajorToMinor(price),
        currency,
        attributes,
        images: images
          .split(",")
          .map((url) => url.trim())
          .filter((url) => url !== ""),
      });
    },
    onSuccess: async () => {
      toast.showToast("success", t("variantForm.created"));
      await queryClient.invalidateQueries({
        queryKey: ["variants", productId],
      });
      setSku("");
      setPairs([{ key: "", value: "" }]);
      setImages("");
      setBarcode("");
      setWeight("");
      setPrice("");
      setCurrency("EGP");
      setTouched(false);
      onClose();
    },
    onError: () => toast.showToast("error", t("variantForm.createFailed")),
  });

  const skuValid = /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(sku.trim());
  const skuError =
    touched && sku.trim() === ""
      ? t("productForm.required")
      : touched && !skuValid
        ? t("variantForm.skuHint")
        : null;

  const priceError = (() => {
    try {
      parseMajorToMinor(price);
      return null;
    } catch {
      return t("variantForm.priceInvalid");
    }
  })();
  const weightValid = /^\d*$/.test(weight.trim());
  const weightError = !weightValid ? t("variantForm.weightInvalid") : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("variantForm.createTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button
            loading={mutation.isPending}
            onClick={() => {
              setTouched(true);
              if (skuValid && !priceError && !weightError) {
                mutation.mutate();
              }
            }}
          >
            {t("action.save")}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => event.preventDefault()}
      >
        <Input
          label={t("variantForm.sku")}
          value={sku}
          onChange={(event) => setSku(event.target.value)}
          hint={t("variantForm.skuHint")}
          error={skuError}
          dir="ltr"
          className="font-mono"
          required
        />
        <p className="text-caption font-semibold text-ink-600">
          {t("detail.skuImmutableNote")}
        </p>
        <Input
          label={t("variantForm.barcode")}
          value={barcode}
          onChange={(event) => setBarcode(event.target.value)}
          dir="ltr"
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            label={t("variantForm.price")}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            error={priceError}
            inputMode="decimal"
            dir="ltr"
          />
          <select
            aria-label={t("variantForm.currency")}
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            className="h-11 self-end rounded-sm border border-ink-300 bg-surface px-3 text-body1 text-ink-900 focus:border-primary"
          >
            {["EGP", "USD", "EUR"].map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
        <Input
          label={t("variantForm.weight")}
          value={weight}
          onChange={(event) => setWeight(event.target.value)}
          error={weightError}
          inputMode="numeric"
          dir="ltr"
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="text-body2 font-semibold text-ink-800">
            {t("variantForm.attributes")}
          </legend>
          <p className="text-caption text-ink-600">
            {t("variantForm.attributesHint")}
          </p>
          {pairs.map((pair, index) => (
            <div key={index} className="flex items-end gap-2">
              <Input
                label={t("variantForm.attrKey")}
                hideLabel
                aria-label={`${t("variantForm.attrKey")} ${index + 1}`}
                value={pair.key}
                onChange={(event) =>
                  setPairs((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, key: event.target.value }
                        : item,
                    ),
                  )
                }
              />
              <Input
                label={t("variantForm.attrValue")}
                hideLabel
                aria-label={`${t("variantForm.attrValue")} ${index + 1}`}
                value={pair.value}
                onChange={(event) =>
                  setPairs((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, value: event.target.value }
                        : item,
                    ),
                  )
                }
              />
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("variantForm.removePair")}
                onClick={() =>
                  setPairs((current) => current.filter((_, i) => i !== index))
                }
              >
                <TrashIcon />
              </Button>
            </div>
          ))}
          <div>
            <Button
              variant="outlined"
              size="sm"
              onClick={() =>
                setPairs((current) => [...current, { key: "", value: "" }])
              }
            >
              <PlusIcon />
              {t("variantForm.addPair")}
            </Button>
          </div>
        </fieldset>
        <Input
          label={t("variantForm.images")}
          value={images}
          onChange={(event) => setImages(event.target.value)}
          hint={t("variantForm.imagesHint")}
          dir="ltr"
        />
      </form>
    </Modal>
  );
}

/** /products/:productId — product card + variants table with availability. */
export function ProductDetailPage() {
  const t = useT();
  const { productId = "" } = useParams();
  const [editOpen, setEditOpen] = useState(false);
  const [variantOpen, setVariantOpen] = useState(false);
  const [expandedSku, setExpandedSku] = useState<string | null>(null);

  const productQuery = useQuery({
    queryKey: ["product", productId],
    queryFn: () => getProduct(productId),
    enabled: productId !== "",
  });
  const variantsQuery = useQuery({
    queryKey: ["variants", productId],
    queryFn: () => listVariants(productId),
    enabled: productId !== "",
  });

  const product = productQuery.data;
  const variants = variantsQuery.data?.variants ?? [];

  if (productQuery.isLoading || variantsQuery.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-content flex-col gap-4">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }
  if (productQuery.isError) {
    return (
      <ErrorState
        error={productQuery.error}
        onRetry={productQuery.refetch}
        className="rounded-lg bg-surface shadow-sm"
      />
    );
  }
  if (product === undefined) {
    return (
      <EmptyState
        title={t("detail.notFoundTitle")}
        description={t("detail.notFoundHint")}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4">
      <Breadcrumbs
        items={[
          { label: t("breadcrumbs.home"), to: "/" },
          { label: t("nav.products"), to: "/products" },
          { label: t("detail.breadcrumbs") },
        ]}
      />
      <PageHeader
        title={product.nameAr}
        description={product.nameEn}
        actions={
          <Button onClick={() => setVariantOpen(true)} startIcon={<PlusIcon />}>
            {t("detail.addVariant")}
          </Button>
        }
      />
      {product.kind === "bundle" ? (
        <div
          role="note"
          className="flex items-start gap-2 rounded-lg border border-info bg-info-light p-3 text-body2 text-info"
        >
          <InfoIcon />
          {t("detail.bundleAlert")}
        </div>
      ) : null}
      <ProductInfoCard product={product} onEdit={() => setEditOpen(true)} />
      <section aria-labelledby="variants-title" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2
            id="variants-title"
            className="text-subtitle2 font-bold text-ink-900"
          >
            {t("detail.variantsTitle")}
          </h2>
          <span className="text-caption text-ink-600">
            {t("detail.variantsCount", { count: variants.length })}
          </span>
        </div>
        <VariantsPanel
          variants={variants}
          isLoading={variantsQuery.isLoading}
          isError={variantsQuery.isError}
          error={variantsQuery.error}
          refetch={variantsQuery.refetch}
          expandedSku={expandedSku}
          onToggle={(sku) =>
            setExpandedSku((current) => (current === sku ? null : sku))
          }
        />
      </section>
      <EditProductModal
        product={product}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
      <AddVariantModal
        productId={product.id}
        open={variantOpen}
        onClose={() => setVariantOpen(false)}
      />
      <p className="text-caption text-ink-500">
        <Link to="/products" className="text-info hover:underline">
          {t("nav.products")}
        </Link>
      </p>
    </div>
  );
}

/** Variants table; presentation only. */
function VariantsPanel({
  variants,
  isLoading,
  isError,
  error,
  refetch,
  expandedSku,
  onToggle,
}: {
  variants: Variant[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
  expandedSku: string | null;
  onToggle: (sku: string) => void;
}) {
  const t = useT();

  if (isLoading) {
    return <VariantsSkeleton />;
  }
  if (isError) {
    return (
      <ErrorState
        error={error}
        onRetry={refetch}
        className="rounded-lg bg-surface shadow-sm"
      />
    );
  }
  if (variants.length === 0) {
    return (
      <EmptyState
        title={t("detail.variantsEmptyTitle")}
        description={t("detail.variantsEmptyHint")}
      />
    );
  }

  return (
    <div className="rounded-lg bg-surface shadow-sm">
      <Table ariaLabel={t("detail.variantsAria")} zebra>
        <THead>
          <tr>
            <TH>{t("detail.col.sku")}</TH>
            <TH>{t("variantForm.barcode")}</TH>
            <TH>{t("variantForm.price")}</TH>
            <TH>{t("detail.col.attributes")}</TH>
            <TH>{t("detail.col.images")}</TH>
            <TH>{t("detail.col.created")}</TH>
            <TH>
              <span className="sr-only">{t("detail.availabilityBtn")}</span>
            </TH>
          </tr>
        </THead>
        <tbody>
          {variants.map((variant) => (
            <VariantRows
              key={variant.id}
              variant={variant}
              expanded={expandedSku === variant.sku}
              onToggle={() => onToggle(variant.sku)}
            />
          ))}
        </tbody>
      </Table>
    </div>
  );
}

function VariantRows({
  variant,
  expanded,
  onToggle,
}: {
  variant: Variant;
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  return (
    <>
      <tr className="border-b border-ink-200 odd:bg-ink-100/60">
        <TD className="font-mono text-ink-900" dir="ltr">
          {variant.sku}
        </TD>
        <TD className="font-mono" dir="ltr">
          {variant.barcode ?? "—"}
        </TD>
        <TD dir="ltr">
          {variant.priceMinor === null
            ? "—"
            : `${formatMinorAsMajor(variant.priceMinor)} ${variant.currency}`}
        </TD>
        <TD>
          <AttributeChips attributes={variant.attributes} />
        </TD>
        <TD>{t("detail.imagesCount", { count: variant.images.length })}</TD>
        <TD className="text-ink-600">{formatDate(variant.createdAt)}</TD>
        <TD>
          <Button
            variant="text"
            size="sm"
            aria-expanded={expanded}
            onClick={onToggle}
          >
            {expanded
              ? t("detail.hideAvailability")
              : t("detail.availabilityBtn")}
          </Button>
        </TD>
      </tr>
      {expanded ? (
        <tr>
          <td colSpan={5} className="p-0">
            <VariantAvailability sku={variant.sku} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
