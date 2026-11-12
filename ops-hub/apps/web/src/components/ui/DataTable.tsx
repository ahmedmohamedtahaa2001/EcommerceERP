import type { ReactNode } from "react";
import { useT } from "../../lib/i18n";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { Skeleton } from "./Skeleton";
import { Table, THead, TH, TR, TD } from "./Table";

export type SortDirection = "asc" | "desc";

export interface Column<T> {
  /** Stable key; also the default sort field. */
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  /** Adds a sortable header wired to `sort`/`onSortChange`. */
  sortable?: boolean;
  className?: string;
  /** Optional column width (e.g. "12rem"). */
  width?: string;
}

/** Minimal slice of a TanStack Query result the table needs. */
export interface QueryState {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

export interface DataTableProps<T> {
  columns: readonly Column<T>[];
  rows: readonly T[];
  /** Loading/error/refetch slice of the query driving this table. */
  state: QueryState;
  getRowKey: (row: T, index: number) => string;
  ariaLabel: string;
  emptyTitle?: string | undefined;
  emptyDescription?: string | undefined;
  emptyAction?: ReactNode | undefined;
  sort?: { key: string; direction: SortDirection } | null;
  onSortChange?: (
    sort: { key: string; direction: SortDirection } | null,
  ) => void;
  /** Rendered under the table (e.g. <Pagination />). */
  footer?: ReactNode | undefined;
  /** Number of skeleton rows while loading. */
  skeletonRows?: number;
}

/**
 * The one table wrapper every list page uses (UI_PLAN §5): loading skeleton →
 * error with retry → empty with guidance → data. Presentation only — the
 * container page owns the query and derived rows.
 */
export function DataTable<T>({
  columns,
  rows,
  state,
  getRowKey,
  ariaLabel,
  emptyTitle,
  emptyDescription,
  emptyAction,
  sort = null,
  onSortChange,
  footer,
  skeletonRows = 6,
}: DataTableProps<T>) {
  const t = useT();

  if (state.isLoading) {
    return (
      <div
        role="status"
        aria-busy="true"
        className="rounded-lg bg-surface p-0 shadow-sm"
      >
        <Table ariaLabel={ariaLabel}>
          <THead>
            <tr>
              {columns.map((column) => (
                <TH
                  key={column.key}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.header}
                </TH>
              ))}
            </tr>
          </THead>
          <tbody>
            {Array.from({ length: skeletonRows }, (_, index) => (
              <tr key={index} className="border-b border-ink-200">
                {columns.map((column) => (
                  <TD key={column.key}>
                    <Skeleton className="h-4 w-full min-w-16" />
                  </TD>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    );
  }

  if (state.isError) {
    return (
      <ErrorState
        error={state.error}
        onRetry={state.refetch}
        className="rounded-lg bg-surface shadow-sm"
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title={emptyTitle ?? t("state.empty")}
        description={emptyDescription ?? t("state.emptyHint")}
        action={emptyAction}
      />
    );
  }

  const toggleSort = (column: Column<T>): void => {
    if (onSortChange === undefined) {
      return;
    }
    if (sort !== null && sort.key === column.key) {
      onSortChange(
        sort.direction === "asc"
          ? { key: column.key, direction: "desc" }
          : null,
      );
    } else {
      onSortChange({ key: column.key, direction: "asc" });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg bg-surface shadow-sm">
        <Table ariaLabel={ariaLabel} zebra>
          <THead>
            <tr>
              {columns.map((column) =>
                column.sortable === true && onSortChange !== undefined ? (
                  <TH
                    key={column.key}
                    style={column.width ? { width: column.width } : undefined}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(column)}
                      className="inline-flex items-center gap-1 font-bold text-ink-600 hover:text-ink-900"
                      aria-sort={
                        sort?.key === column.key
                          ? sort.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                    >
                      {column.header}
                      <span aria-hidden="true" className="w-3 text-ink-400">
                        {sort?.key === column.key
                          ? sort.direction === "asc"
                            ? "▲"
                            : "▼"
                          : ""}
                      </span>
                    </button>
                  </TH>
                ) : (
                  <TH
                    key={column.key}
                    style={column.width ? { width: column.width } : undefined}
                  >
                    {column.header}
                  </TH>
                ),
              )}
            </tr>
          </THead>
          <tbody>
            {rows.map((row, index) => (
              <TR key={getRowKey(row, index)}>
                {columns.map((column) => (
                  <TD key={column.key} className={column.className}>
                    {column.render !== undefined
                      ? column.render(row)
                      : String(row[column.key as keyof T] as string)}
                  </TD>
                ))}
              </TR>
            ))}
          </tbody>
        </Table>
      </div>
      {footer !== undefined ? footer : null}
    </div>
  );
}
