import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  Card,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Skeleton,
  Table,
  TD,
  TH,
  THead,
  TR,
} from "../../components/ui";
import { getCompany } from "../../lib/api/company";
import { getDailyReport, listKpis } from "../../lib/api/reports";
import { useT } from "../../lib/i18n";
import { formatKpi, isoDay } from "./report-format";

export function ReportsPage() {
  const t = useT();
  const [day, setDay] = useState(() => isoDay(new Date()));
  const company = useQuery({ queryKey: ["company"], queryFn: getCompany });
  const report = useQuery({
    queryKey: ["reports", "daily", day],
    queryFn: () => getDailyReport(day),
    enabled: day !== "",
  });
  const kpis = useQuery({
    queryKey: ["reports", "kpis", day],
    queryFn: () => listKpis(day),
    enabled: day !== "",
  });
  const currency = company.data?.defaultCurrency ?? "EGP";

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4">
      <PageHeader
        title={t("reports.title")}
        description={t("reports.description")}
        actions={
          <div className="w-44">
            <Input
              label={t("reports.day")}
              type="date"
              value={day}
              onChange={(event) => setDay(event.target.value)}
              dir="ltr"
            />
          </div>
        }
      />

      {report.isLoading ? (
        <Skeleton className="h-32" />
      ) : report.isError ? (
        <ErrorState
          error={report.error}
          onRetry={() => void report.refetch()}
        />
      ) : report.data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Stat
            label={t("reports.ordersCreated")}
            value={String(report.data.ordersCreated)}
          />
          <Stat
            label={t("reports.shipments")}
            value={String(report.data.shipments)}
          />
          <Stat
            label={t("reports.openExceptions")}
            value={String(report.data.openExceptions)}
          />
          <Stat
            label={t("reports.codExpected")}
            value={formatKpi(report.data.codExpectedMinor, "minor", currency)}
          />
          <Stat
            label={t("reports.codCollected")}
            value={formatKpi(report.data.codCollectedMinor, "minor", currency)}
          />
        </div>
      ) : null}

      {report.data && Object.keys(report.data.ordersByStatus).length > 0 ? (
        <Card>
          <h2 className="text-subtitle1 font-bold text-ink-900">
            {t("reports.byStatus")}
          </h2>
          <div className="mt-3">
            <Table ariaLabel={t("reports.byStatus")} zebra>
              <THead>
                <tr>
                  <TH>{t("reports.status")}</TH>
                  <TH>{t("reports.count")}</TH>
                </tr>
              </THead>
              <tbody>
                {Object.entries(report.data.ordersByStatus).map(
                  ([status, count]) => (
                    <TR key={status}>
                      <TD>{t(`orderStatus.${status}`)}</TD>
                      <TD>{count}</TD>
                    </TR>
                  ),
                )}
              </tbody>
            </Table>
          </div>
        </Card>
      ) : null}

      <section aria-labelledby="kpi-title" className="flex flex-col gap-2">
        <h2 id="kpi-title" className="text-subtitle1 font-bold text-ink-900">
          {t("reports.kpis")}
        </h2>
        {kpis.isLoading ? (
          <Skeleton className="h-40" />
        ) : kpis.isError ? (
          <ErrorState error={kpis.error} onRetry={() => void kpis.refetch()} />
        ) : (kpis.data?.kpis ?? []).length === 0 ? (
          <EmptyState title={t("reports.kpis.empty")} />
        ) : (
          <div className="rounded-lg bg-surface shadow-sm">
            <Table ariaLabel={t("reports.kpis")} zebra>
              <THead>
                <tr>
                  <TH>{t("reports.kpi.col.name")}</TH>
                  <TH>{t("reports.kpi.col.value")}</TH>
                </tr>
              </THead>
              <tbody>
                {(kpis.data?.kpis ?? []).map((kpi) => (
                  <TR key={kpi.metric}>
                    <TD>{t(`kpi.${kpi.metric}`)}</TD>
                    <TD className="font-semibold" dir="ltr">
                      {formatKpi(kpi.value, kpi.unit, currency)}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-caption text-ink-600">{label}</p>
      <p className="mt-1 text-subtitle1 font-bold text-ink-900" dir="ltr">
        {value}
      </p>
    </Card>
  );
}
