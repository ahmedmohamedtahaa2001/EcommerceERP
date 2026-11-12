import { describe, expect, it } from "vitest";

import { AuthService } from "../src/auth/service";
import { InvalidCredentialsError, UnauthorizedError } from "../src/auth/errors";
import { SESSION_TTL_SECONDS } from "../src/auth/types";
import type { UserRecord } from "../src/auth/types";
import {
  FakeClock,
  FakeDirectory,
  FakeHasher,
  FakeLoginLimiter,
  FakeSessions,
  ownerUser,
} from "./fakes";

const removedMember: UserRecord = {
  ...ownerUser,
  id: "00000000-0000-4000-8000-0000000000f1",
  email: "removed@example.com",
  tenantId: null,
  role: null,
};

function service(users: UserRecord[], clock: FakeClock) {
  return new AuthService({
    users: new FakeDirectory(users),
    passwords: new FakeHasher(),
    sessions: new FakeSessions(clock),
    limiter: new FakeLoginLimiter(clock),
    clock,
    sessionTtlSeconds: SESSION_TTL_SECONDS,
  });
}

describe("a user with no active membership", () => {
  it("cannot log in, even with the right password", async () => {
    const clock = new FakeClock();
    const auth = service(
      [{ ...removedMember, passwordHash: "fake-hash:correct-horse" }],
      clock,
    );
    await expect(
      auth.login("removed@example.com", "correct-horse"),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("is rejected on an existing session, so deactivation takes effect immediately", async () => {
    const clock = new FakeClock();
    const directory = [ownerUser];
    const auth = service(directory, clock);
    const { token } = await auth.login(ownerUser.email, "correct-horse");

    await expect(auth.authenticate(token)).resolves.toMatchObject({
      id: ownerUser.id,
    });

    // The membership is deactivated: the directory now returns no tenant or role.
    directory[0] = { ...ownerUser, tenantId: null, role: null };
    await expect(auth.authenticate(token)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });
});
