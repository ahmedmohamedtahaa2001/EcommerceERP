import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createProduct, listProducts } from "../../lib/api/products";
import type {
  Product,
  ProductKind,
  ProductStatus,
} from "../../lib/api/products";
import { useT, useLocale } from "../../lib/i18n";
import { formatDate } from "../../lib/format";
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  SearchBar,
  Select,
  Skeleton,
  Table,
  Tag,
  THead,
  TH,
  TD,
  useToast,
} from "../../components/ui";

const KIND_TONES: Record<ProductKind, "neutral" | "secondary"> = {
  simple: "neutral",
  bundle: "secondary",
};
const STATUS_TONES: Record<ProductStatus, "success" | "warning" | "neutral"> = {
  active: "success",
  draft: "warning",
  archived: "neutral",
};

/** Modal form for creating a product; presentation only. */
function ProductFormModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [kind, setKind] = useState<ProductKind>("simple");
  const [touched, setTouched] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      createProduct({
        kind,
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim(),
        descriptionAr:
          descriptionAr.trim() === "" ? null : descriptionAr.trim(),
        descriptionEn:
          descriptionEn.trim() === "" ? null : descriptionEn.trim(),
      }),
    onSuccess: async () => {
      toast.showToast("success", t("products.created"));
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      setNameAr("");
      setNameEn("");
      setDescriptionAr("");
      setDescriptionEn("");
      setTouched(false);
      onClose();
    },
    onError: () => toast.showToast("error", t("products.createFailed")),
  });

  const nameArError =
    touched && nameAr.trim() === "" ? t("productForm.required") : null;
  const nameEnError =
    touched && nameEn.trim() === "" ? t("productForm.required") : null;
  const valid = nameAr.trim() !== "" && nameEn.trim() !== "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("productForm.createTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button
            loading={mutation.isPending}
            onClick={() => {
              setTouched(true);
              if (valid) {
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
          label={t("productForm.nameAr")}
          value={nameAr}
          onChange={(event) => setNameAr(event.target.value)}
          error={nameArError}
          required
        />
        <Input
          label={t("productForm.nameEn")}
          value={nameEn}
          onChange={(event) => setNameEn(event.target.value)}
          error={nameEnError}
          dir="ltr"
          required
        />
        <Input
          label={t("productForm.descriptionAr")}
          value={descriptionAr}
          onChange={(event) => setDescriptionAr(event.target.value)}
          hint={t("productForm.descriptionHint")}
        />
        <Input
          label={t("productForm.descriptionEn")}
          value={descriptionEn}
          onChange={(event) => setDescriptionEn(event.target.value)}
          dir="ltr"
        />
        <Select
          label={t("productForm.kind")}
          options={[
            { value: "simple", label: t("kind.simple") },
            { value: "bundle", label: t("kind.bundle") },
          ]}
          value={kind}
          onChange={(event) => setKind(event.target.value as ProductKind)}
        />
        <p className="text-caption text-ink-600">{t("productForm.kindHint")}</p>
      </form>
    </Modal>
  );
}

function ProductsSkeleton() {
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
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="ms-auto h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

/**
 * Kit `TR` has no click surface, so row-click navigation uses a local row
 * with the same Flora classes; keyboard users keep the name link.
 */
function ClickableRow({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <tr
      className="cursor-pointer border-b border-ink-200 transition-colors odd:bg-ink-100/60 hover:bg-ink-100/80"
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

/** Products list table; presentation only — the container owns the query. */
function ProductsTable({
  products,
  isLoading,
  isError,
  error,
  refetch,
  search,
}: {
  products: Product[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
  search: string;
}) {
  const t = useT();
  const { locale } = useLocale();
  const navigate = useNavigate();
  const primaryName = (product: Product): string =>
    locale === "ar" ? product.nameAr : product.nameEn;
  const secondaryName = (product: Product): string =>
    locale === "ar" ? product.nameEn : product.nameAr;

  if (isLoading) {
    return <ProductsSkeleton />;
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
  if (products.length === 0) {
    return (
      <EmptyState
        title={
          search.trim() === "" ? t("products.emptyTitle") : t("state.empty")
        }
        description={
          search.trim() === "" ? t("products.emptyHint") : t("state.emptyHint")
        }
      />
    );
  }

  return (
    <div className="rounded-lg bg-surface shadow-sm">
      <Table ariaLabel={t("products.ariaTable")} zebra>
        <THead>
          <tr>
            <TH>{t("products.col.name")}</TH>
            <TH>{t("products.col.kind")}</TH>
            <TH>{t("products.col.status")}</TH>
            <TH>{t("products.col.created")}</TH>
          </tr>
        </THead>
        <tbody>
          {products.map((product) => (
            <ClickableRow
              key={product.id}
              onClick={() => navigate(`/products/${product.id}`)}
            >
              <TD>
                <Link
                  to={`/products/${product.id}`}
                  className="font-semibold text-info hover:underline"
                  aria-label={t("products.rowHint")}
                >
                  {primaryName(product)}
                </Link>
                <span
                  className="ms-2 text-caption text-ink-500"
                  dir={locale === "ar" ? "ltr" : "rtl"}
                >
                  {secondaryName(product)}
                </span>
              </TD>
              <TD>
                <Tag tone={KIND_TONES[product.kind]}>
                  {t(`kind.${product.kind}`)}
                </Tag>
              </TD>
              <TD>
                <Tag tone={STATUS_TONES[product.status]}>
                  {t(`productStatus.${product.status}`)}
                </Tag>
              </TD>
              <TD className="text-ink-600">{formatDate(product.createdAt)}</TD>
            </ClickableRow>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

/** /products — catalog list with search and create modal. */
export function ProductsPage() {
  const t = useT();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const query = useQuery({ queryKey: ["products"], queryFn: listProducts });

  const filtered = useMemo(() => {
    const products = query.data?.products ?? [];
    const needle = search.trim().toLowerCase();
    if (needle === "") {
      return products;
    }
    return products.filter(
      (product) =>
        product.nameAr.toLowerCase().includes(needle) ||
        product.nameEn.toLowerCase().includes(needle),
    );
  }, [query.data, search]);

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4">
      <PageHeader
        title={t("products.title")}
        description={t("products.description")}
        actions={
          <Button onClick={() => setCreateOpen(true)} startIcon={<PlusIcon />}>
            {t("products.newProduct")}
          </Button>
        }
      />
      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder={t("products.searchPlaceholder")}
        className="max-w-md"
      />
      <ProductsTable
        products={filtered}
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        refetch={query.refetch}
        search={search}
      />
      <ProductFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}

function PlusIcon() {
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
