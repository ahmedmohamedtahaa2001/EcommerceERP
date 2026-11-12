import { describe, expect, it } from "vitest";

import { ApiError } from "./client";
import { describeProblem, problemCode } from "./problem-message";

const dictionary: Record<string, string> = {
  "problem.duplicate-phone": "يوجد عميل بهذا الرقم بالفعل",
  "problem.network": "تعذر الاتصال بالخادم",
};
const t = (key: string) => dictionary[key] ?? key;

function apiError(code: string, detail = "English detail", status = 409) {
  return new ApiError({
    type: `https://ops-hub.local/problems/${code}`,
    title: "x",
    status,
    detail,
  });
}

describe("describeProblem", () => {
  it("translates a known code in any language", () => {
    expect(describeProblem(apiError("duplicate-phone"), t, "ar")).toBe(
      "يوجد عميل بهذا الرقم بالفعل",
    );
  });

  it("never shows English server text to Arabic readers", () => {
    expect(
      describeProblem(apiError("some-unknown-code"), t, "ar"),
    ).toBeUndefined();
  });

  it("keeps the server detail for English readers when no translation exists", () => {
    expect(describeProblem(apiError("some-unknown-code"), t, "en")).toBe(
      "English detail",
    );
  });

  it("explains a network failure", () => {
    expect(
      describeProblem(
        new ApiError({ title: "Network error", status: 0 }),
        t,
        "ar",
      ),
    ).toBe("تعذر الاتصال بالخادم");
  });

  it("ignores errors that are not API errors", () => {
    expect(describeProblem(new Error("boom"), t, "ar")).toBeUndefined();
    expect(problemCode(new Error("boom"))).toBeNull();
  });
});
