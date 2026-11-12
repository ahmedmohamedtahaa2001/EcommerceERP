import { describe, expect, it } from "vitest";

import { translate } from "../../lib/i18n";
import { movementReasonLabel } from "./MovementsPage";

const ar = (key: string) => translate("ar", key);

describe("movementReasonLabel", () => {
  it("translates transfer prefixes and keeps the typed note", () => {
    expect(movementReasonLabel("Transfer out: restock Maadi", ar)).toBe(
      "نقل صادر: restock Maadi",
    );
    expect(movementReasonLabel("Transfer in: restock Maadi", ar)).toBe(
      "نقل وارد: restock Maadi",
    );
  });

  it("translates known codes and leaves free text alone", () => {
    expect(movementReasonLabel("ORDER_SHIPPED", ar)).not.toBe("ORDER_SHIPPED");
    expect(movementReasonLabel("counted by Ali", ar)).toBe("counted by Ali");
  });
});
