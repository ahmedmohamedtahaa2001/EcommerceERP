import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ToastProvider, useToast } from "./Toast";

function Trigger({
  variant,
  message,
}: {
  variant: "success" | "error";
  message: string;
}) {
  const { showToast } = useToast();
  return (
    <button type="button" onClick={() => showToast(variant, message)}>
      إظهار
    </button>
  );
}

describe("Toast", () => {
  it("shows a toast message when showToast is called", async () => {
    render(
      <ToastProvider>
        <Trigger variant="success" message="تم حفظ المنتج" />
      </ToastProvider>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "إظهار" }));

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("تم حفظ المنتج")).toBeInTheDocument();
  });
});
