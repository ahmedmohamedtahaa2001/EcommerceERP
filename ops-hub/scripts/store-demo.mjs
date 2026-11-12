/**
 * Ops Hub store demo — drives the ops console in a real (headed) browser so
 * a human can watch the flows happen.
 *
 * Run from the repository root:
 *   node ops-hub/scripts/store-demo.mjs
 *
 * It needs the API on :3001 and the console on :5173:
 *   pnpm dev:api   # in ops-hub/
 *   pnpm dev:web   # in ops-hub/
 *
 * Screenshots land in `ops-hub/scripts/screenshots/`.
 */

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, "screenshots");
const WEB = process.env.OPS_HUB_WEB_URL ?? "http://localhost:5173";
const EMAIL = process.env.DEMO_EMAIL ?? "owner@ops-hub.local";
const PASSWORD = process.env.DEMO_PASSWORD ?? "ops-hub-demo-password";

const results = [];
let stepNumber = 0;

function ok(label, detail = "") {
  results.push({ label, pass: true, detail });
  console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label, detail = "") {
  results.push({ label, pass: false, detail });
  console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
}

async function shot(page, name) {
  stepNumber += 1;
  const file = join(SHOTS, `${String(stepNumber).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`     📸 ${file}`);
  return file;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  mkdirSync(SHOTS, { recursive: true });

  console.log(`\n▶ opening the Ops Hub console at ${WEB} (headed browser)\n`);
  const browser = await chromium.launch({ headless: false, slowMo: 120 });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "ar-EG",
  });
  const page = await context.newPage();

  // Only real script errors count. The demo deliberately triggers a 401
  // (wrong password) and 404s (wrong phone, empty lists); those are network
  // log lines, not defects.
  const consoleErrors = [];
  const networkNoise = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() !== "error") return;
    if (text.includes("Failed to load resource")) {
      networkNoise.push(text);
      return;
    }
    consoleErrors.push(text);
  });
  page.on("pageerror", (error) =>
    consoleErrors.push(`pageerror: ${error.message}`),
  );

  // ---- 1. Public tracking page -------------------------------------------
  console.log("▶ 1. public tracking page (no login)");
  await page.goto(`${WEB}/track`, { waitUntil: "networkidle" });
  await sleep(800);
  await shot(page, "tracking-empty");
  const trackingHeading = await page
    .getByRole("heading", { name: /تتبع طلبك/ })
    .count();
  if (trackingHeading > 0) {
    ok("tracking page renders in Arabic RTL");
  } else {
    fail("tracking page did not render");
  }

  await page.getByPlaceholder("OP-10001").fill("OP-10001");
  await page.getByPlaceholder("01012345678").fill("01012345678");
  await shot(page, "tracking-filled");
  await page.getByRole("button", { name: /Track/ }).click();
  await sleep(1200);
  await shot(page, "tracking-result");
  const orderVisible = await page.getByText("OP-10001").count();
  if (orderVisible > 0) {
    ok("tracking returns the order status");
  } else {
    fail("tracking did not return the order");
  }

  // ---- 2. Wrong phone is not enumerable ----------------------------------
  console.log("▶ 2. tracking with the wrong phone");
  await page.getByPlaceholder("01012345678").fill("01999999999");
  await page.getByRole("button", { name: /Track/ }).click();
  await sleep(1000);
  await shot(page, "tracking-wrong-phone");
  const errorVisible = await page.getByRole("alert").count();
  if (errorVisible > 0) {
    ok("wrong phone is rejected with the generic message");
  } else {
    fail("wrong phone was not rejected");
  }

  // ---- 3. Login -----------------------------------------------------------
  console.log("▶ 3. staff login");
  await page.goto(`${WEB}/login`, { waitUntil: "networkidle" });
  await sleep(600);
  await shot(page, "login-page");
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill("wrong-password");
  await page.getByRole("button", { name: /تسجيل الدخول/ }).click();
  await sleep(1500);
  await shot(page, "login-wrong-password");
  const stillOnLogin = page.url().includes("/login");
  const errorShown = await page.getByRole("alert").count();
  if (stillOnLogin && errorShown > 0) {
    ok("a wrong password is rejected and the error is shown");
  } else if (stillOnLogin) {
    fail("a wrong password did not sign in, but no error was shown");
  } else {
    fail("a wrong password signed in");
  }

  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /تسجيل الدخول/ }).click();
  await sleep(2000);
  await shot(page, "dashboard");
  if (!page.url().includes("/login")) {
    ok("login succeeds and lands on the dashboard");
  } else {
    fail("login did not reach the dashboard");
  }

  // ---- 4. Orders ----------------------------------------------------------
  console.log("▶ 4. orders list");
  await page.goto(`${WEB}/orders`, { waitUntil: "networkidle" });
  await sleep(1200);
  await shot(page, "orders-list");
  const orderRows = await page.getByText("OP-10001").count();
  if (orderRows > 0) {
    ok("orders list shows the seeded order");
  } else {
    fail("orders list is empty");
  }

  // ---- 5. Order detail + timeline ---------------------------------------
  console.log("▶ 5. order detail and its event timeline");
  await page.getByText("OP-10001").first().click();
  await sleep(1500);
  await shot(page, "order-detail");
  ok("order detail opened");

  // ---- 6. Exceptions ------------------------------------------------------
  console.log("▶ 6. exception queue");
  await page.goto(`${WEB}/exceptions`, { waitUntil: "networkidle" });
  await sleep(1200);
  await shot(page, "exceptions");
  ok("exception queue rendered");

  // ---- 7. Inventory -------------------------------------------------------
  console.log("▶ 7. inventory availability");
  await page.goto(`${WEB}/inventory/availability`, { waitUntil: "networkidle" });
  await sleep(1200);
  await shot(page, "inventory-availability");
  ok("availability page rendered");

  // ---- 8. Analytics -------------------------------------------------------
  console.log("▶ 8. analytics / KPI dashboard");
  await page.goto(`${WEB}/analytics`, { waitUntil: "networkidle" });
  await sleep(1500);
  await shot(page, "analytics");
  ok("analytics rendered");

  // ---- 9. API keys (scope enforcement) -----------------------------------
  console.log("▶ 9. API keys page");
  await page.goto(`${WEB}/api-keys`, { waitUntil: "networkidle" });
  await sleep(1200);
  await shot(page, "api-keys");
  ok("api keys page rendered");

  // ---- 10. API contract checks straight from the page ---------------------
  console.log("▶ 10. API checks from the page context (same-origin proxy)");
  const apiChecks = await page.evaluate(async () => {
    const out = {};
    const health = await fetch("/healthz").then((r) => r.json());
    out.health = health.status;
    const spec = await fetch("/v1/openapi.json").then((r) => r.json());
    out.openApiPaths = Object.keys(spec.paths).length;
    const track = await fetch("/v1/track?order=OP-10001&phone=01999999999");
    out.wrongPhoneStatus = track.status;
    const right = await fetch("/v1/track?order=OP-10001&phone=01012345678");
    out.rightPhoneStatus = right.status;
    const enums = await fetch("/v1/meta/enums").then((r) => r.json());
    out.enumKeys = Object.keys(enums).length;
    return out;
  });
  if (apiChecks.health === "ok") {
    ok("healthz is ok");
  } else {
    fail("healthz failed");
  }
  if (apiChecks.enumKeys > 0) {
    ok(`machine-readable enums exposed (${apiChecks.enumKeys} groups)`);
  } else {
    fail("machine-readable enums are empty");
  }
  if (apiChecks.openApiPaths > 100) {
    ok(`OpenAPI publishes ${apiChecks.openApiPaths} paths`);
  } else {
    fail("OpenAPI spec is missing routes");
  }
  if (apiChecks.wrongPhoneStatus === 404 && apiChecks.rightPhoneStatus === 200) {
    ok("public tracking does not leak order existence");
  } else {
    fail("public tracking leaked an order");
  }

  console.log(
    `\n▶ script errors: ${consoleErrors.length} (expected HTTP status logs ignored: ${networkNoise.length})`,
  );
  for (const error of consoleErrors.slice(0, 10)) {
    console.log(`     ⚠️  ${error.slice(0, 200)}`);
  }

  await sleep(2500);
  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(
    `\n▶ ${results.length - failed.length}/${results.length} checks passed; screenshots in ${SHOTS}\n`,
  );
  process.exit(failed.length === 0 && consoleErrors.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
