/**
 * screenshot-add-data.mjs
 *
 * Captures screenshots of every Add Data wizard flow — the landing page,
 * each experience's technology list, Step 2 (setup) for every technology,
 * and Step 3 (success) for one representative technology per guide type.
 *
 * Usage:
 *   node scripts/screenshot-add-data.mjs
 *   node scripts/screenshot-add-data.mjs --out-dir screenshots/add-data
 *   node scripts/screenshot-add-data.mjs --live
 */

import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_ES_URL, registerElasticsearchMocks } from "./elasticsearch-mocks.mjs";
import {
  ADD_DATA_EXPERIENCE_LABELS,
  ADD_DATA_PRIMARY_EXPERIENCES,
  ADD_DATA_TECHNOLOGY_ENTRIES,
} from "../src/services/addData/catalog.data.mjs";
import { captureAddDataScreenshots } from "./screenshot-add-data-helpers.mjs";

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    url: process.env.SCREENSHOT_ADD_DATA_URL ?? "http://127.0.0.1:3000/ai-github-actions-playground/",
    outDir: "screenshots/add-data",
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
  /status of 404/,
  /status of 400/,
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

    if (!opts.live) {
      await registerElasticsearchMocks(page, {
        esUrl: DEFAULT_ES_URL,
        data: { clusterInfo: { cluster_name: "screenshot-cluster" } },
      });
    }

    // Load app and connect
    await page.goto(opts.url, { waitUntil: "networkidle", timeout: opts.timeoutMs });
    await page.getByRole("button", { name: "Connect to Elasticsearch" }).click();
    await page.getByRole("textbox", { name: "Elasticsearch URL" }).fill(esUrl);
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await page
      .getByRole("button", { name: "Metrics", exact: true })
      .waitFor({ timeout: opts.live ? 15_000 : opts.timeoutMs });

    const settleMs = opts.live ? 2000 : 1500;
    const captured = await captureAddDataScreenshots(page, opts.outDir, settleMs);

    console.log(`\nCaptured ${captured} screenshots to ${opts.outDir}/`);
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

  console.log("All add-data screenshots captured successfully.");
}

run().catch((error) => {
  console.error("screenshot-add-data crashed:", error);
  process.exit(1);
});
