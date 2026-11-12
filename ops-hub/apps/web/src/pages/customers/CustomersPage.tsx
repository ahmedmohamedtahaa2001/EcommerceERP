import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  SearchBar,
  Skeleton,
  Table,
  TD,
  TH,
  THead,
  TR,
} from "../../components/ui";
import type { CustomerRecord } from "../../lib/api/customers";
import { formatDate } from "../../lib/format";
import { useT } from "../../lib/i18n";
import { useCustomersQuery } from "./hooks";

const SEARCH_DEBOUNCE_MS = 300;

export function CustomersPage() {
  const t = useT();
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState("");

  useEffect(() => {
    const timer = setTimeout(
      () => setSubmitted(search.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [search]);

  const query = useCustomersQuery(submitted);
  const customers = query.data?.pages.flatMap((page) => page.customers) ?? [];

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4">
      <PageHeader
        title={t("customers.title")}
        description={t("customers.description")}
        actions={
          <Link to="/customers/new">
            <Button>{t("customers.newCustomer")}</Button>
          </Link>
        }
      />
      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder={t("customers.search.placeholder")}
        className="max-w-md"
      />

      {query.isLoading ? (
        <Skeleton className="h-40" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : customers.length === 0 ? (
        <EmptyState
          title={t("customers.empty.title")}
          description={t("customers.empty.description")}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <CustomersTable customers={customers} />
          {query.hasNextPage ? (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                loading={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                {t("customers.loadMore")}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function CustomersTable({ customers }: { customers: CustomerRecord[] }) {
  const t = useT();
  return (
    <div className="rounded-lg bg-surface shadow-sm">
      <Table ariaLabel={t("customers.title")} zebra>
        <THead>
          <tr>
            <TH>{t("customers.col.name")}</TH>
            <TH>{t("customers.col.phone")}</TH>
            <TH>{t("customers.col.email")}</TH>
            <TH>{t("customers.col.created")}</TH>
          </tr>
        </THead>
        <tbody>
          {customers.map((customer) => (
            <TR key={customer.id}>
              <TD>
                <Link
                  to={`/customers/${customer.id}`}
                  className="font-semibold text-primary hover:underline"
                  aria-label={t("customers.openDetail")}
                >
                  {customer.fullName ?? t("customers.noName")}
                </Link>
              </TD>
              <TD className="font-mono" dir="ltr">
                {customer.phone}
              </TD>
              <TD dir="ltr">{customer.email ?? "—"}</TD>
              <TD className="text-ink-600">{formatDate(customer.createdAt)}</TD>
            </TR>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
