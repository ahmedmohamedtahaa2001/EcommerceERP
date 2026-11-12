import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusPill } from "./StatusPill";

describe("StatusPill", () => {
  it("renders the Arabic label for a known order state", () => {
    render(<StatusPill kind={{ type: "order", status: "delivered" }} />);
    const pill = screen.getByText("تم التسليم");
    expect(pill).toBeInTheDocument();
    expect(pill.closest("[data-status]")).toHaveAttribute(
      "data-status",
      "delivered",
    );
  });

  it("renders the exception labels", () => {
    render(<StatusPill kind={{ type: "exception", status: "open" }} />);
    expect(screen.getByText("مفتوحة")).toBeInTheDocument();
  });

  it("degrades to a neutral pill for unknown values instead of crashing", () => {
    render(<StatusPill kind={{ type: "order", status: "mystery_state" }} />);
    expect(screen.getByText("حالة غير معروفة")).toBeInTheDocument();
    expect(
      screen.getByText("حالة غير معروفة").closest("[data-status]"),
    ).toHaveAttribute("data-status", "mystery_state");
  });
});
