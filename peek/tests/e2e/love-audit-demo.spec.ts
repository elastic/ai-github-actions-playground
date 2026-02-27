/**
 * Love Audit (Demo) — same audit as love-audit.spec.ts but connects to a
 * real demo Elasticsearch cluster instead of mocks. Includes Profiling pages
 * to exercise real Universal Profiling data (base64url frame IDs, RLE frame
 * types, kernel frames, etc.).
 *
 * Credentials are read from environment variables:
 *   DEMO_ES_URL, DEMO_ES_USERNAME, DEMO_ES_PASSWORD
 *
 * Usage:
 *   DEMO_ES_URL=https://… DEMO_ES_USERNAME=demo DEMO_ES_PASSWORD=readonlyuser \
 *     npx playwright test tests/e2e/love-audit-demo.spec.ts --reporter=list
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  COMMON_PAGES,
  PROFILING_PAGES,
  registerLoveAuditTests,
} from "./fixtures/love-audit-helpers";

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const DEMO_URL = process.env.DEMO_ES_URL ?? "";
const DEMO_USER = process.env.DEMO_ES_USERNAME ?? "";
const DEMO_PASS = process.env.DEMO_ES_PASSWORD ?? "";

test.skip(
  !DEMO_URL || !DEMO_USER || !DEMO_PASS,
  "Skipped: set DEMO_ES_URL, DEMO_ES_USERNAME, DEMO_ES_PASSWORD to run",
);

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

async function connectToDemoCluster(page: Page) {
  await page.goto("");
  await page.getByRole("button", { name: "Connect to Elasticsearch" }).click();
  await page.getByRole("textbox", { name: "Elasticsearch URL" }).fill(DEMO_URL);

  // Switch to Username / Password auth
  await page.getByRole("tab", { name: "Username / Password" }).click();
  await page.getByRole("textbox", { name: "Username" }).fill(DEMO_USER);
  await page.getByLabel("Password").fill(DEMO_PASS);

  await page.getByRole("button", { name: "Connect", exact: true }).click();

  // Wait for the sidebar to appear — indicates a successful connection
  await expect(page.getByRole("button", { name: "Cluster Overview", exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Register tests — common pages + profiling pages
// ---------------------------------------------------------------------------

registerLoveAuditTests(
  "love audit (demo) — live cluster quality check",
  connectToDemoCluster,
  [...COMMON_PAGES, ...PROFILING_PAGES],
  "love-audit-demo",
);
