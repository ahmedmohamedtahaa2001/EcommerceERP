import { Writable } from "node:stream";

import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp, CENSOR, REDACT_PATHS } from "../src/app";

const CANARY = "sk_live_CANARY_123";
const PHONE = "+201012345678";
const EMAIL = "canary@example.com";

interface ProblemBody {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  requestId: string;
}

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

function appWithoutLogging(): FastifyInstance {
  app = buildApp({ logger: false });
  return app;
}

describe("health endpoints", () => {
  it("returns 200 from /healthz", async () => {
    const response = await appWithoutLogging().inject({
      method: "GET",
      url: "/healthz",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("returns 200 from /readyz", async () => {
    const response = await appWithoutLogging().inject({
      method: "GET",
      url: "/readyz",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok" });
  });
});

describe("request ids", () => {
  it("echoes a caller-supplied request id", async () => {
    const response = await appWithoutLogging().inject({
      method: "GET",
      url: "/healthz",
      headers: { "x-request-id": "req-123" },
    });

    expect(response.headers["x-request-id"]).toBe("req-123");
  });

  it("generates an id when the caller does not supply one", async () => {
    const response = await appWithoutLogging().inject({
      method: "GET",
      url: "/healthz",
    });

    expect(response.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});

describe("problem responses", () => {
  it("returns RFC 7807 JSON for unknown routes", async () => {
    const response = await appWithoutLogging().inject({
      method: "GET",
      url: "/nope",
    });
    const body = response.json<ProblemBody>();

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(body).toMatchObject({
      type: "https://ops-hub.local/problems/not-found",
      title: "Not Found",
      status: 404,
      instance: "/nope",
    });
    expect(body.requestId).toBeTruthy();
  });

  it("exposes client errors but hides server error details", async () => {
    const instance = appWithoutLogging();
    instance.get("/bad-request", async () => {
      throw Object.assign(new Error("quantity must be positive"), {
        statusCode: 400,
      });
    });
    instance.get("/crash", async () => {
      throw new Error("database password is hunter2");
    });

    const clientError = await instance.inject({
      method: "GET",
      url: "/bad-request",
    });
    const serverError = await instance.inject({ method: "GET", url: "/crash" });
    const serverBody = serverError.json<ProblemBody>();

    expect(clientError.statusCode).toBe(400);
    expect(clientError.json<ProblemBody>().detail).toBe(
      "quantity must be positive",
    );
    expect(serverError.statusCode).toBe(500);
    expect(serverBody.detail).toBe("An unexpected error occurred.");
    expect(serverBody.title).toBe("Internal Server Error");
  });
});

describe("log redaction", () => {
  it("never writes api keys, phones, or emails to the log", async () => {
    let output = "";
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });

    app = buildApp({
      logger: {
        level: "info",
        redact: { paths: REDACT_PATHS, censor: CENSOR },
        stream,
      },
    });
    app.post("/probe", async (request) => {
      request.log.info(
        {
          apiKey: CANARY,
          phone: PHONE,
          email: EMAIL,
          body: request.body,
          headers: request.headers,
        },
        "probe",
      );
      return { ok: true };
    });

    const response = await app.inject({
      method: "POST",
      url: "/probe",
      headers: {
        authorization: `Bearer ${CANARY}`,
        "x-api-key": CANARY,
      },
      payload: { phone: PHONE, email: EMAIL, password: CANARY },
    });

    expect(response.statusCode).toBe(200);
    expect(output).not.toContain(CANARY);
    expect(output).not.toContain(PHONE);
    expect(output).not.toContain(EMAIL);
    expect(output).toContain(CENSOR);
  });
});
