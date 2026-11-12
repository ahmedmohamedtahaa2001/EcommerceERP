import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DataTable, type Column } from "./DataTable";
import type { QueryState } from "./DataTable";

interface Row {
  id: string;
  name: string;
}

const columns: Column<Row>[] = [
  { key: "name", header: "الاسم", sortable: true },
];

const rows: Row[] = [
  { id: "r1", name: "طلب رقم 10231" },
  { id: "r2", name: "طلب رقم 10232" },
];

const okState: QueryState = {
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
};
const loadingState: QueryState = { ...okState, isLoading: true };
const errorState: QueryState = {
  ...okState,
  isError: true,
  error: { problem: { title: "Not Found", status: 404 } },
};

function renderTable(
  overrides: Partial<Parameters<typeof DataTable<Row>>[0]> = {},
) {
  return render(
    <DataTable<Row>
      columns={columns}
      rows={rows}
      state={okState}
      getRowKey={(row) => row.id}
      ariaLabel="الطلبات"
      {...overrides}
    />,
  );
}

describe("DataTable", () => {
  it("renders skeleton rows with busy semantics while loading", () => {
    renderTable({ state: loadingState, rows: [] });
    expect(screen.getByRole("table", { name: "الطلبات" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders rows when data is present", () => {
    renderTable();
    expect(screen.getByText("طلب رقم 10231")).toBeInTheDocument();
    expect(screen.getByText("طلب رقم 10232")).toBeInTheDocument();
  });

  it("shows the empty state when there are no rows", () => {
    renderTable({ rows: [] });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows an Arabic error, never the English server title, and a retry that refetches", async () => {
    const refetch = vi.fn();
    renderTable({ state: { ...errorState, refetch } });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("حدث خطأ غير متوقع")).toBeInTheDocument();
    expect(screen.queryByText("Not Found")).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("cycles sort asc → desc → none", async () => {
    const onSortChange = vi.fn();
    const user = userEvent.setup();

    const first = renderTable({ onSortChange });
    await user.click(screen.getByRole("button", { name: "الاسم" }));
    expect(onSortChange).toHaveBeenLastCalledWith({
      key: "name",
      direction: "asc",
    });
    first.unmount();

    const second = renderTable({
      onSortChange,
      sort: { key: "name", direction: "asc" },
    });
    await user.click(screen.getByRole("button", { name: /الاسم/ }));
    expect(onSortChange).toHaveBeenLastCalledWith({
      key: "name",
      direction: "desc",
    });
    second.unmount();

    const third = renderTable({
      onSortChange,
      sort: { key: "name", direction: "desc" },
    });
    await user.click(screen.getByRole("button", { name: /الاسم/ }));
    expect(onSortChange).toHaveBeenLastCalledWith(null);
    third.unmount();
  });
});
