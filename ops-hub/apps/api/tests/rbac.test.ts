import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import {
  requirePermission,
  type Authenticator,
} from "../src/auth/context";
import { UnauthorizedError } from "../src/auth/errors";
import type { AuthUser } from "../src/auth/types";

const viewer: AuthUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "viewer@example.com",
  fullName: "Viewer",
  tenantId: "22222222-2222-4222-8222-222222222222",
  role: "viewer",
};

const salesAgent: AuthUser = {
  ...viewer,
  id: "33333333-3333-4333-8333-333333333333",
  email: "sales@example.com",
  role: "sales_agent",
};

class FakeAuthenticator implements Authenticator {
  constructor(private readonly users: Record<string, AuthUser>) {}

  async authenticate(token: string): Promise<AuthUser> {
    const user = this.users[token];
    if (!user) {
      throw new UnauthorizedError();
    }
    return user;
  }
}

const authenticator = new FakeAuthenticator({
  "viewer-token": viewer,
  "sales-token": salesAgent,
});

let app: FastifyInstance;

function buildGuardedApp(): FastifyInstance {
  app = buildApp({ logger: false });
  app.get(
    "/orders",
    { preHandler: requirePermission(authenticator, "orders:read") },
    async (request) => ({ email: request.currentUser?.email }),
  );
  app.post(
    "/orders",
    { preHandler: requirePermission(authenticator, "orders:write") },
    async () => ({ created: true }),
  );
  return app;
}

afterEach(async () => {
  await app.close();
});

describe("requirePermission", () => {
  it("allows a role that holds the permission", async () => {
    const response = await buildGuardedApp().inject({
      method: "GET",
      url: "/orders",
      headers: { authorization: "Bearer viewer-token" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ email: viewer.email });
  });

  it("allows a write when the role has the write permission", async () => {
    const response = await buildGuardedApp().inject({
      method: "POST",
      url: "/orders",
      headers: { authorization: "Bearer sales-token" },
    });

    expect(response.statusCode).toBe(200);
  });

  it("returns 403 when the role lacks the permission", async () => {
    const response = await buildGuardedApp().inject({
      method: "POST",
      url: "/orders",
      headers: { authorization: "Bearer viewer-token" },
    });
    const body = response.json<{ status: number; detail: string }>();

    expect(response.statusCode).toBe(403);
    expect(body.status).toBe(403);
    expect(body.detail).toBe("Missing permission: orders:write");
  });

  it("returns 401 without a session and for unknown sessions", async () => {
    const instance = buildGuardedApp();
    const missing = await instance.inject({ method: "GET", url: "/orders" });
    const unknown = await instance.inject({
      method: "GET",
      url: "/orders",
      headers: { authorization: "Bearer nope" },
    });

    expect(missing.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
  });
});
