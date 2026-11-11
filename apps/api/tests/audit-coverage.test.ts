import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_DIR = new URL("../src", import.meta.url).pathname;

/**
 * Routes that mutate without an auditable tenant-scoped principal. Every
 * exemption must carry a justification:
 * - `POST /v1/auth/logout`: callable with an unknown or expired token by
 *   design, so there is no authenticated actor to attribute.
 */
const EXEMPT = new Set<string>(["auth/routes.ts:POST /v1/auth/logout"]);

function collectRouteFiles(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      collectRouteFiles(path, files);
    } else if (name === "routes.ts") {
      files.push(path);
    }
  }
  return files;
}

function matchAll(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)].map((match) => match[0]);
}

/**
 * Roadmap P0-S1-T10 acceptance: a test fails if a mutating route does not
 * call the audit writer. Every `app.post/put/patch/delete` registration in a
 * route module must be matched by a `recordAudit(...)` call in that module,
 * minus the explicit exemptions above.
 */
describe("audit coverage of mutating routes", () => {
  it("every mutating route calls the audit writer", () => {
    const failures: string[] = [];

    for (const file of collectRouteFiles(SRC_DIR)) {
      const moduleId = relative(SRC_DIR, file);
      const source = readFileSync(file, "utf8");

      const mutating = [...source.matchAll(
        /\bapp\.(post|put|patch|delete)\(\s*\n?\s*"([^"]+)"/g,
      )]
        .map((match) => ({
          method: match[1]?.toUpperCase() ?? "",
          url: match[2] ?? "",
        }))
        .filter(
          (route) => !EXEMPT.has(`${moduleId}:${route.method} ${route.url}`),
        );

      const auditCalls = matchAll(source, /\brecordAudit\s*\(/g).length;
      if (mutating.length > auditCalls) {
        failures.push(
          `${moduleId}: ${mutating
            .map((route) => `${route.method} ${route.url}`)
            .join(", ")} mutate without a recordAudit call`,
        );
      }
    }

    expect(failures).toEqual([]);
  });
});
