import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Skeleton,
  Table,
  TD,
  TH,
  THead,
  TR,
  Tag,
  useToast,
} from "../../components/ui";
import type { CustomerRecord } from "../../lib/api/customers";
import { updateCustomer } from "../../lib/api/customers";
import type { Order } from "../../lib/api/orders";
import { formatDate } from "../../lib/format";
import { useT } from "../../lib/i18n";
import {
  buildCustomerPayload,
  validateCustomerForm,
  type CustomerFormValues,
} from "./customer-form";
import { useCustomerOrdersQuery, useCustomerQuery } from "./hooks";

export function CustomerDetailPage() {
  const t = useT();
  const { customerId = "" } = useParams();
  const query = useCustomerQuery(customerId);
  const customer = query.data?.customer;
  const addresses = query.data?.addresses ?? [];
  const orders = useCustomerOrdersQuery(customer?.phone);
  const [editOpen, setEditOpen] = useState(false);

  if (query.isLoading) {
    return <Skeleton className="h-64" />;
  }
  if (query.isError || !customer) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        {query.isError ? (
          <ErrorState
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <EmptyState title={t("customers.notFound")} />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4">
      <BackLink />
      <PageHeader
        title={customer.fullName ?? t("customers.noName")}
        description={customer.phone}
        actions={
          <Button variant="ghost" onClick={() => setEditOpen(true)}>
            {t("customers.detail.edit")}
          </Button>
        }
      />

      <Card>
        <h2 className="text-subtitle1 font-bold text-ink-900">
          {t("customers.detail.profile")}
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-body2 sm:grid-cols-3">
          <Field
            label={t("customers.form.phone")}
            value={customer.phone}
            mono
          />
          <Field
            label={t("customers.form.email")}
            value={customer.email ?? "—"}
          />
          <Field
            label={t("customers.detail.created")}
            value={formatDate(customer.createdAt)}
          />
          <Field
            label={t("customers.detail.updated")}
            value={formatDate(customer.updatedAt)}
          />
        </dl>
      </Card>

      <section
        aria-labelledby="customer-addresses"
        className="flex flex-col gap-2"
      >
        <h2
          id="customer-addresses"
          className="text-subtitle1 font-bold text-ink-900"
        >
          {t("customers.detail.addresses")}
        </h2>
        {addresses.length === 0 ? (
          <p className="text-body2 text-ink-600">
            {t("customers.detail.noAddresses")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {addresses.map((address) => (
              <li
                key={address.id}
                className="rounded-lg bg-surface p-3 text-body2 shadow-sm"
              >
                {[
                  address.line1,
                  address.line2,
                  address.city,
                  address.rawGovernorate,
                ]
                  .filter(Boolean)
                  .join("، ")}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="customer-orders"
        className="flex flex-col gap-2"
      >
        <h2
          id="customer-orders"
          className="text-subtitle1 font-bold text-ink-900"
        >
          {t("customers.detail.orders")}
        </h2>
        {orders.isLoading ? (
          <Skeleton className="h-32" />
        ) : orders.isError ? (
          <ErrorState
            error={orders.error}
            onRetry={() => void orders.refetch()}
          />
        ) : (orders.data?.orders ?? []).length === 0 ? (
          <p className="text-body2 text-ink-600">
            {t("customers.detail.noOrders")}
          </p>
        ) : (
          <OrdersTable orders={orders.data?.orders ?? []} />
        )}
      </section>

      <EditCustomerModal
        customer={customer}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </div>
  );
}

function BackLink() {
  const t = useT();
  return (
    <nav aria-label="breadcrumb" className="text-caption text-ink-600">
      <Link to="/customers" className="hover:underline">
        {t("customers.detail.back")}
      </Link>
    </nav>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-caption text-ink-500">{label}</dt>
      <dd
        className={`mt-1 font-semibold text-ink-800 ${mono ? "font-mono" : ""}`}
        dir="ltr"
      >
        {value}
      </dd>
    </div>
  );
}

function OrdersTable({ orders }: { orders: Order[] }) {
  const t = useT();
  return (
    <div className="rounded-lg bg-surface shadow-sm">
      <Table ariaLabel={t("customers.detail.orders")} zebra>
        <THead>
          <tr>
            <TH>{t("customers.detail.orderNumber")}</TH>
            <TH>{t("customers.detail.status")}</TH>
            <TH>{t("customers.detail.date")}</TH>
          </tr>
        </THead>
        <tbody>
          {orders.map((order) => (
            <TR key={order.id}>
              <TD>
                <Link
                  to={`/orders/${order.id}`}
                  className="font-mono font-semibold text-primary hover:underline"
                  dir="ltr"
                >
                  {order.orderNumber}
                </Link>
              </TD>
              <TD>
                <Tag>{t(`orderStatus.${order.status}`)}</Tag>
              </TD>
              <TD className="text-ink-600">{formatDate(order.createdAt)}</TD>
            </TR>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

function EditCustomerModal({
  customer,
  open,
  onClose,
}: {
  customer: CustomerRecord;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<CustomerFormValues>({
    phone: customer.phone,
    fullName: customer.fullName ?? "",
    email: customer.email ?? "",
  });
  const [touched, setTouched] = useState(false);
  const errors = validateCustomerForm(values);

  const mutation = useMutation({
    mutationFn: () => updateCustomer(customer.id, buildCustomerPayload(values)),
    onSuccess: async () => {
      toast.showToast("success", t("customers.detail.saved"));
      await queryClient.invalidateQueries({
        queryKey: ["customer", customer.id],
      });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      setTouched(false);
      onClose();
    },
    onError: () => toast.showToast("error", t("customers.detail.saveFailed")),
  });

  const fieldError = (field: keyof CustomerFormValues) => {
    if (!touched) return null;
    const code = errors[field];
    if (code === "required") return t("customers.form.required");
    if (code === "invalid") return t("customers.form.invalidEmail");
    return null;
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("customers.detail.editTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button
            loading={mutation.isPending}
            onClick={() => {
              setTouched(true);
              if (Object.keys(errors).length === 0) mutation.mutate();
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
          label={t("customers.form.name")}
          value={values.fullName}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              fullName: event.target.value,
            }))
          }
        />
        <Input
          label={t("customers.form.phone")}
          value={values.phone}
          onChange={(event) =>
            setValues((current) => ({ ...current, phone: event.target.value }))
          }
          error={fieldError("phone")}
          dir="ltr"
          required
        />
        <Input
          label={t("customers.form.email")}
          value={values.email}
          onChange={(event) =>
            setValues((current) => ({ ...current, email: event.target.value }))
          }
          error={fieldError("email")}
          dir="ltr"
        />
      </form>
    </Modal>
  );
}
