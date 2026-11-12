import { useT } from "../../lib/i18n";
import { formatMoney } from "../../lib/format";
import type { OrderDetail } from "../../lib/api/orders";
import { Card, Table, TD, TH, THead, TR, Tag } from "../../components/ui";

export interface OrderDetailsCardProps {
  detail: OrderDetail;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-caption font-semibold text-ink-500">{label}</dt>
      <dd className="text-body2 text-ink-900">{children}</dd>
    </div>
  );
}

function AddressLine({ detail }: { detail: OrderDetail }) {
  const t = useT();
  const { address } = detail;
  if (address === null) {
    return <span className="text-ink-400">{t("orders.detail.noAddress")}</span>;
  }
  const parts = [address.line1, address.line2, address.city].filter(
    (part): part is string => part !== null && part !== "",
  );
  return <>{parts.join("، ")}</>;
}

function PaymentTag({ detail }: { detail: OrderDetail }) {
  const t = useT();
  const { method } = detail.payment;
  if (method === "cod" || method === "prepaid") {
    return (
      <Tag tone={method === "cod" ? "info" : "secondary"}>
        {t(`orders.payment.${method}`)}
      </Tag>
    );
  }
  return <Tag tone="neutral">{method}</Tag>;
}

/**
 * Two-thirds column of the detail page: customer/contact/address fields,
 * payment tag, the order lines table, and the order total — all money in
 * integer minor units via formatMoney.
 */
export function OrderDetailsCard({ detail }: OrderDetailsCardProps) {
  const t = useT();
  const { order, customer, address } = detail;

  const totalMinor = detail.lines.reduce(
    (sum, line) => sum + line.unitPriceMinor * line.quantity,
    0,
  );

  return (
    <Card className="p-6">
      <h2 className="text-subtitle2 font-bold text-ink-900">
        {t("orders.detail.detailsTitle")}
      </h2>

      <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t("orders.detail.customer")}>
          {customer.fullName ?? <span className="text-ink-400">—</span>}
        </Field>
        <Field label={t("orders.detail.phone")}>
          <span className="font-mono" dir="ltr">
            {customer.phone}
          </span>
        </Field>
        <Field label={t("orders.detail.governorate")}>
          {address?.rawGovernorate ?? address?.governorateCode ?? (
            <span className="text-ink-400">—</span>
          )}
        </Field>
        <Field label={t("orders.detail.address")}>
          <AddressLine detail={detail} />
        </Field>
        <Field label={t("orders.detail.channel")}>
          {order.channel === "" ? (
            <span className="text-ink-400">—</span>
          ) : (
            order.channel
          )}
        </Field>
        <Field label={t("orders.detail.payment")}>
          <PaymentTag detail={detail} />
        </Field>
      </dl>

      <h3 className="mt-6 text-body1 font-bold text-ink-900">
        {t("orders.detail.lines")}
      </h3>
      <div className="mt-2 rounded-lg border border-ink-200">
        <Table ariaLabel={t("orders.detail.lines")}>
          <THead>
            <tr>
              <TH>{t("orders.detail.sku")}</TH>
              <TH>{t("orders.detail.quantity")}</TH>
              <TH>{t("orders.detail.unitPrice")}</TH>
              <TH>{t("orders.detail.lineTotal")}</TH>
            </tr>
          </THead>
          <tbody>
            {detail.lines.map((line) => (
              <TR key={line.id}>
                <TD className="font-mono">{line.sku}</TD>
                <TD>{line.quantity}</TD>
                <TD>{formatMoney(line.unitPriceMinor, line.currency)}</TD>
                <TD className="font-semibold">
                  {formatMoney(
                    line.unitPriceMinor * line.quantity,
                    line.currency,
                  )}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </div>

      <div className="mt-4 flex items-center justify-between rounded bg-ink-100 px-4 py-3">
        <span className="text-body1 font-bold text-ink-800">
          {t("orders.detail.total")}
        </span>
        <span className="text-body1 font-bold text-ink-900">
          {formatMoney(totalMinor, order.currency)}
        </span>
      </div>
    </Card>
  );
}
