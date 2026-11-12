import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./Button";

describe("Button", () => {
  it("renders its label and fires onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>حفظ</Button>);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "حفظ" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("blocks interaction while loading and announces busy state", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        حفظ
      </Button>,
    );

    const button = screen.getByRole("button", { name: "حفظ" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();

    const user = userEvent.setup();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
