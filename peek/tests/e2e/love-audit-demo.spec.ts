/**
 * Love Audit (Demo) — same audit as love-audit.spec.ts but connects to a
 * real demo Elasticsearch cluster instead of mocks. Includes Profiling pages
 * to exercise real Universal Profiling data (base64url frame IDs, RLE frame
 * types, kernel frames, etc.).
 *
 * Credentials are loaded from the published demo.json endpoint at
 * https://elastic.github.io/ai-github-actions-playground/demo.json
 *
 * Usage:
 *   npx playwright test tests/e2e/love-audit-demo.spec.ts --reporter=list
 */
import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  COMMON_PAGES,
  PROFILING_PAGES,
  registerLoveAuditTests,
} from "./fixtures/love-audit-helpers";

// ---------------------------------------------------------------------------
// Demo credentials
// ---------------------------------------------------------------------------

const DEMO_JSON_URL = "https://elastic.github.io/ai-github-actions-playground/demo.json";

interface DemoCredentials {
  url: string;
  username: string;
  password: string;
}

let demoCreds: DemoCredentials | null = null;

async function loadDemoCredentials(): Promise<DemoCredentials> {
  if (demoCreds) return demoCreds;

  // Allow credential injection via environment variables as a fallback when
  // the HTTPS fetch is unavailable (e.g. TLS issues in CI sandboxes).
  const envUrl = process.env.DEMO_ES_URL;
  const envUser = process.env.DEMO_ES_USERNAME;
  const envPass = process.env.DEMO_ES_PASSWORD;
  if (envUrl && envUser && envPass) {
    demoCreds = { url: envUrl, username: envUser, password: envPass };
    return demoCreds;
  }

  try {
    const res = await fetch(DEMO_JSON_URL);
    if (!res.ok) throw new Error(`Failed to fetch demo credentials: ${res.status}`);
    demoCreds = (await res.json()) as DemoCredentials;
    return demoCreds;
  } catch (err) {
    throw new Error(
      `Failed to fetch demo credentials from ${DEMO_JSON_URL}: ${err instanceof Error ? err.message : err}. ` +
        "Set DEMO_ES_URL, DEMO_ES_USERNAME, and DEMO_ES_PASSWORD environment variables as a fallback.",
    );
  }
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

async function connectToDemoCluster(page: Page) {
  const creds = await loadDemoCredentials();

  await page.goto("");
  await page.getByRole("button", { name: "Connect to Elasticsearch" }).click();
  await page.getByRole("textbox", { name: "Elasticsearch URL" }).fill(creds.url);

  // Switch to Username / Password auth
  await page.getByRole("tab", { name: "Username / Password" }).click();
  await page.getByRole("textbox", { name: "Username" }).fill(creds.username);
  await page.getByLabel("Password").fill(creds.password);

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
