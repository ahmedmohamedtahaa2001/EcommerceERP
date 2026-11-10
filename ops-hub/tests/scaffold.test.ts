import { describe, expect, it } from "vitest";

import * as contracts from "@ops-hub/contracts";
import * as db from "@ops-hub/db";
import * as domain from "@ops-hub/domain";
import * as events from "@ops-hub/events";
import * as integrations from "@ops-hub/integrations";
import * as shared from "@ops-hub/shared";

describe("workspace packages", () => {
  it.each([
    ["@ops-hub/contracts", contracts],
    ["@ops-hub/db", db],
    ["@ops-hub/domain", domain],
    ["@ops-hub/events", events],
    ["@ops-hub/integrations", integrations],
    ["@ops-hub/shared", shared],
  ])("%s resolves through the workspace", (_name, module) => {
    expect(module).toBeTypeOf("object");
  });
});
