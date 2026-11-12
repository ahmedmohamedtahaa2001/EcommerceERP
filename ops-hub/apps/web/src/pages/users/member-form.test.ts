import { describe, expect, it } from "vitest";

import { validateInvite } from "./member-form";

const valid = {
  email: "mona@store.com",
  fullName: "Mona",
  role: "manager",
  password: "long-enough-pass",
};

describe("validateInvite", () => {
  it("accepts a complete invitation", () => {
    expect(validateInvite(valid)).toEqual({});
  });

  it("requires a valid email", () => {
    expect(validateInvite({ ...valid, email: "" })).toEqual({
      email: "required",
    });
    expect(validateInvite({ ...valid, email: "mona@" })).toEqual({
      email: "invalid",
    });
  });

  it("requires a password of at least twelve characters", () => {
    expect(validateInvite({ ...valid, password: "short" })).toEqual({
      password: "tooShort",
    });
  });

  it("requires a role", () => {
    expect(validateInvite({ ...valid, role: "" })).toEqual({
      role: "required",
    });
  });
});
