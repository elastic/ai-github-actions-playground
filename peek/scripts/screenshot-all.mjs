/**
 * screenshot-all.mjs
 *
 * Captures a full-page screenshot of every feature page in a single browser
 * session. Supports both mocked Elasticsearch (default) and a live ES cluster
 * via the Vite proxy (--live flag).
 *
 * Usage:
 *   node scripts/screenshot-all.mjs
 *   node scripts/screenshot-all.mjs --out-dir screenshots
 *   node scripts/screenshot-all.mjs --live                  # requires ES_URL + running Vite dev server
 *   node scripts/screenshot-all.mjs --live --es-proxy-url http://localhost:3000/_es
 */

import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_ES_URL, registerElasticsearchMocks } from "./elasticsearch-mocks.mjs";

// ---------------------------------------------------------------------------
// Page navigation map (same as screenshot-feature.mjs)
// ---------------------------------------------------------------------------

const PAGE_NAV_BUTTONS = {
  "cluster-overview": "Cluster Overview",
  "data-streams": "Data Streams",
  indices: "Indices",
  "ingest-pipelines": "Ingest Pipelines",
  "query-lab": "Query Lab",
  metrics: "Metrics",
  traces: "Traces",
  console: "Console",
  users: "Users",
  roles: "Roles",
  dashboards: "Dashboards",
  fleet: "Fleet",
};

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    url: process.env.SCREENSHOT_ALL_URL ?? "http://127.0.0.1:3000/ai-github-actions-playground/",
    outDir: "screenshots",
    live: false,
    esProxyUrl: "http://localhost:3000/_es",
    timeoutMs: 30_000,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--url" && argv[i + 1]) opts.url = argv[++i];
    else if (arg === "--out-dir" && argv[i + 1]) opts.outDir = argv[++i];
    else if (arg === "--live") opts.live = true;
    else if (arg === "--es-proxy-url" && argv[i + 1]) opts.esProxyUrl = argv[++i];
    else if (arg === "--timeout-ms" && argv[i + 1]) opts.timeoutMs = Number(argv[++i]) || 30_000;
  }

  return opts;
}

const IGNORABLE_CONSOLE_PATTERNS = [
  /fonts\.googleapis\.com/,
  /fonts\.gstatic\.com/,
  /ERR_NAME_NOT_RESOLVED/,
];

function isIgnorableConsoleError(text) {
  return IGNORABLE_CONSOLE_PATTERNS.some((re) => re.test(text));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  const opts = parseArgs(process.argv.slice(2));

  await fs.mkdir(opts.outDir, { recursive: true });

  const consoleErrors = [];
  const pageErrors = [];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    const esUrl = opts.live ? opts.esProxyUrl : DEFAULT_ES_URL;

    // Set up mocks if not in live mode
    if (!opts.live) {
      await registerElasticsearchMocks(page, {
        esUrl: DEFAULT_ES_URL,
        data: { clusterInfo: { cluster_name: "screenshot-cluster" } },
      });
    }

    // Load the app
    await page.goto(opts.url, { waitUntil: "networkidle", timeout: opts.timeoutMs });

    // Connect to Elasticsearch
    await page.getByRole("button", { name: "Connect to Elasticsearch" }).click();
    await page.getByRole("textbox", { name: "Elasticsearch URL" }).fill(esUrl);
    await page.getByRole("button", { name: "Connect", exact: true }).click();

    // Wait for sidebar (indicates successful connection)
    await page
      .getByRole("button", { name: "Metrics", exact: true })
      .waitFor({ timeout: opts.live ? 15_000 : opts.timeoutMs });

    console.log(`Capturing ${Object.keys(PAGE_NAV_BUTTONS).length} pages to ${opts.outDir}/...`);

    // Screenshot each page
    for (const [slug, navButton] of Object.entries(PAGE_NAV_BUTTONS)) {
      await page.getByRole("button", { name: navButton, exact: true }).click();
      await page.waitForTimeout(opts.live ? 2000 : 1500);

      const screenshotPath = path.join(opts.outDir, `screenshot-${slug}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`  ${slug}`);
    }
  } catch (error) {
    pageErrors.push(String(error));
    console.error("Error during screenshot capture:", error);
  } finally {
    await browser.close();
  }

  const significantErrors = consoleErrors.filter((e) => !isIgnorableConsoleError(e));
  if (significantErrors.length > 0 || pageErrors.length > 0) {
    console.error("\nErrors encountered during capture:");
    for (const e of significantErrors) console.error(`  console: ${e}`);
    for (const e of pageErrors) console.error(`  page: ${e}`);
    process.exit(1);
  }

  console.log("\nAll screenshots captured successfully.");
}

run().catch((error) => {
  console.error("screenshot-all crashed:", error);
  process.exit(1);
});
