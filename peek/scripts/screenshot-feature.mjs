/**
 * screenshot-feature.mjs
 *
 * Takes a screenshot of a specific feature page after connecting to a mocked
 * Elasticsearch cluster. This is the correct tool to use when you want to
 * capture what the app looks like after the user is authenticated and on a
 * real feature page — NOT the "Connect to Elasticsearch" landing page.
 *
 * Usage:
 *   node scripts/screenshot-feature.mjs \
 *     --url  http://127.0.0.1:3000/ai-github-actions-playground/ \
 *     --page metrics \
 *     --screenshot screenshot-metrics.png
 *
 * Supported --page values:
 *   cluster-overview | data-streams | indices | ingest-pipelines |
 *   query-lab | logs | metrics | traces | console | users | roles |
 *   dashboards | fleet | add-data | api-keys
 *
 * The script mocks all required Elasticsearch endpoints so no live cluster
 * is needed.
 */

import { chromium } from "playwright";
import fs from "node:fs/promises";
import { DEFAULT_ES_URL, registerElasticsearchMocks } from "./elasticsearch-mocks.mjs";
import { PAGE_NAV_BUTTONS } from "./page-nav-buttons.mjs";

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    url:
      process.env.SCREENSHOT_FEATURE_URL ?? "http://127.0.0.1:3000/ai-github-actions-playground/",
    page: process.env.SCREENSHOT_FEATURE_PAGE ?? "cluster-overview",
    screenshot: process.env.SCREENSHOT_FEATURE_IMAGE ?? "screenshot-feature.png",
    output: process.env.SCREENSHOT_FEATURE_OUTPUT ?? "screenshot-feature.json",
    timeoutMs: 30_000,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--url" && argv[i + 1]) opts.url = argv[++i];
    else if (arg === "--page" && argv[i + 1]) opts.page = argv[++i];
    else if (arg === "--screenshot" && argv[i + 1]) opts.screenshot = argv[++i];
    else if (arg === "--output" && argv[i + 1]) opts.output = argv[++i];
    else if (arg === "--timeout-ms" && argv[i + 1]) opts.timeoutMs = Number(argv[++i]) || 30_000;
  }

  return opts;
}

// ---------------------------------------------------------------------------
// Mock Elasticsearch responses
// ---------------------------------------------------------------------------

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
  const navButton = PAGE_NAV_BUTTONS[opts.page];

  if (!navButton) {
    console.error(
      `Unknown --page "${opts.page}". Valid values: ${Object.keys(PAGE_NAV_BUTTONS).join(", ")}`,
    );
    process.exit(1);
  }

  const diagnostics = {
    url: opts.url,
    page: opts.page,
    consoleErrors: [],
    pageErrors: [],
    capturedAt: new Date().toISOString(),
  };

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    page.on("console", (msg) => {
      if (msg.type() === "error") diagnostics.consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));

    try {
      // Set up mocks before navigating
      await registerElasticsearchMocks(page, {
        esUrl: DEFAULT_ES_URL,
        data: { clusterInfo: { cluster_name: "screenshot-cluster" } },
      });

      // Load the app
      await page.goto(opts.url, { waitUntil: "networkidle", timeout: opts.timeoutMs });

      // Connect to the mocked cluster
      await page.getByRole("button", { name: "Connect to Elasticsearch" }).click();
      await page.getByRole("textbox", { name: "Elasticsearch URL" }).fill(DEFAULT_ES_URL);
      await page.getByRole("button", { name: "Connect", exact: true }).click();

      // Wait for the app to be ready (sidebar visible)
      await page
        .getByRole("button", { name: "Metrics", exact: true })
        .waitFor({ timeout: opts.timeoutMs });

      // Navigate to the requested feature page
      await page.getByRole("button", { name: navButton, exact: true }).click();
      await page.waitForTimeout(1500);

      // Take the screenshot
      await page.screenshot({ path: opts.screenshot, fullPage: true });
      console.log(`Screenshot saved: ${opts.screenshot}`);
    } catch (error) {
      diagnostics.pageErrors.push(String(error));
      console.error("Error during screenshot capture:", error);
    } finally {
      await browser.close();
    }
  } catch (error) {
    diagnostics.pageErrors.push(String(error));
  }

  await fs.writeFile(opts.output, JSON.stringify(diagnostics, null, 2));

  const significantConsoleErrors = diagnostics.consoleErrors.filter(
    (e) => !isIgnorableConsoleError(e),
  );
  const hasErrors = significantConsoleErrors.length > 0 || diagnostics.pageErrors.length > 0;
  if (hasErrors) {
    console.error("Screenshot capture failed. See diagnostics:", opts.output);
    process.exit(1);
  }

  console.log("Feature screenshot captured successfully.");
}

run().catch((error) => {
  console.error("screenshot-feature crashed:", error);
  process.exit(1);
});
