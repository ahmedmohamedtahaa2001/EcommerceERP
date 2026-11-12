import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { buildOpenApiDocument, ROUTE_REGISTRY } from "@ops-hub/contracts";
import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app";

const SRC_DIR = new URL("../src", import.meta.url).pathname;

/**
 * Roadmap P0-S2-T11 acceptance: "every route in `packages/contracts` appears
 * in the spec; a CI check fails if a route is missing from the spec."
 *
 * This test walks the route source files directly (no service wiring needed)
 * so it can never be satisfied by a route that only exists in the registry.
 */
function collectRouteFiles(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      collectRouteFiles(path, files);
    } else if (name.endsWith(".ts")) {
      files.push(path);
    }
  }
  return files;
}

function sourceRoutes(): Set<string> {
  const found = new Set<string>();
  for (const file of collectRouteFiles(SRC_DIR)) {
    const source = readFileSync(file, "utf8");
    const matches = source.matchAll(
      /app\.(get|post|put|patch|delete)\(\s*\n?\s*"([^"]+)"/g,
    );
    for (const match of matches) {
      found.add(`${match[1]!.toUpperCase()} ${match[2]!}`);
    }
  }
  return found;
}

describe("OpenAPI spec coverage", () => {
  it("serves the document at /v1/openapi.json", async () => {
    const app = buildApp({ logger: false });
    const response = await app.inject({
      method: "GET",
      url: "/v1/openapi.json",
    });
    expect(response.statusCode).toBe(200);
    const doc = response.json<{
      openapi: string;
      paths: Record<string, unknown>;
    }>();
    expect(doc.openapi).toBe("3.1.0");
    expect(Object.keys(doc.paths).length).toBeGreaterThan(0);
    await app.close();
  });

  it("serves a docs page at /docs", async () => {
    const app = buildApp({ logger: false });
    const response = await app.inject({ method: "GET", url: "/docs" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    await app.close();
  });

  it("includes every route the app registers in the spec", () => {
    const doc = buildOpenApiDocument();
    const specRoutes = new Set<string>();
    for (const [path, item] of Object.entries(doc.paths)) {
      for (const method of Object.keys(item)) {
        specRoutes.add(`${method.toUpperCase()} ${path}`);
      }
    }

    const missing = [...sourceRoutes()].filter((r) => !specRoutes.has(r));
    expect(missing).toEqual([]);
  });

  it("has no spec entry without a matching route", () => {
    const actual = sourceRoutes();
    const orphans = ROUTE_REGISTRY.filter(
      (r) => !actual.has(`${r.method.toUpperCase()} ${r.path}`),
    ).map((r) => `${r.method.toUpperCase()} ${r.path}`);
    expect(orphans).toEqual([]);
  });

  it("declares every non-public route with a required scope", () => {
    const unscoped = ROUTE_REGISTRY.filter((r) => !r.public && !r.scope).map(
      (r) => `${r.method.toUpperCase()} ${r.path}`,
    );
    expect(unscoped).toEqual([]);
  });
});
