import type { FastifyInstance, FastifyRequest } from "fastify";

import { UnauthorizedError, ValidationError } from "./errors";
import type { AuthService } from "./service";

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (typeof header !== "string") {
    return null;
  }
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

export function registerAuthRoutes(
  app: FastifyInstance,
  service: AuthService,
): void {
  app.post("/v1/auth/login", async (request, reply) => {
    const body = request.body;
    if (typeof body !== "object" || body === null) {
      throw new ValidationError("email and password are required.");
    }

    const { email, password } = body as {
      email?: unknown;
      password?: unknown;
    };
    if (
      typeof email !== "string" ||
      email.trim() === "" ||
      typeof password !== "string" ||
      password === ""
    ) {
      throw new ValidationError("email and password are required.");
    }

    const result = await service.login(email, password);
    reply.header("cache-control", "no-store");
    return {
      token: result.token,
      expiresAt: result.expiresAt.toISOString(),
      user: result.user,
    };
  });

  app.post("/v1/auth/logout", async (request, reply) => {
    const token = bearerToken(request);
    if (token) {
      await service.logout(token);
    }
    reply.status(204);
  });

  app.get("/v1/auth/me", async (request, reply) => {
    const token = bearerToken(request);
    if (!token) {
      throw new UnauthorizedError();
    }

    const user = await service.authenticate(token);
    reply.header("cache-control", "no-store");
    return { user };
  });
}
