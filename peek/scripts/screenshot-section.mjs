/**
 * screenshot-section.mjs
 *
 * Captures screenshots of every page in a named section in both light and dark
 * mode, saving them under `<out-dir>/<section>/light/` and
 * `<out-dir>/<section>/dark/`. Designed to be run in CI explore workflows so
 * the agent has fresh screenshots to evaluate before interactive testing.
 *
 * Dark mode is enabled by pre-seeding the Zustand UI store's localStorage key
 * before the app initializes — no UI interaction required.
 *
 * Usage:
 *   node scripts/screenshot-section.mjs --section metrics
 *   node scripts/screenshot-section.mjs --section all --live
 *   node scripts/screenshot-section.mjs --section traces \
 *     --url http://127.0.0.1:3000/ai-github-actions-playground/ \
 *     --out-dir screenshots
 *
 * Supported --section values:
 *   cluster-overview | data-management | fleet | kubernetes | logs | metrics |
 *   profiling | query-lab | security | services | traces | dashboards |
 *   add-data | all
 *
 * Flags:
 *   --live           Connect to a real Elasticsearch at --es-url (default:
 *                    http://localhost:9200) instead of using mocked responses.
 *   --es-url <url>   Elasticsearch URL when running --live (default: http://localhost:9200)
 *   --url <url>      App base URL (default: http://127.0.0.1:3000/ai-github-actions-playground/)
 *   --out-dir <dir>  Output directory (default: screenshots)
 *   --timeout-ms <n> Per-page timeout in ms (default: 30000)
 */

import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_ES_URL, registerElasticsearchMocks } from "./elasticsearch-mocks.mjs";
import { isIgnorableConsoleError } from "./ignorable-console-errors.mjs";
import { PAGE_NAV_BUTTONS } from "./page-nav-buttons.mjs";
import { waitForSettle } from "./screenshot-add-data-helpers.mjs";

// ---------------------------------------------------------------------------
// Section → page slug mapping
// ---------------------------------------------------------------------------

/**
 * Optional heading text that confirms the correct page loaded after sidebar
 * navigation. When present, the capture loop waits for this text before
 * taking the screenshot, preventing race-condition mismatches (e.g. dark
 * mode context still showing Dashboards instead of Add Data).
 */
const PAGE_CONFIRMATION_HEADING = {
  "add-data": "What do you want to monitor?",
};

export const SECTION_PAGES = {
  "cluster-overview": ["cluster-overview"],
  "data-management": ["data-streams", "indices", "ingest-pipelines"],
  fleet: ["fleet"],
  kubernetes: ["kubernetes"],
  logs: ["logs"],
  metrics: ["metrics"],
  profiling: ["profiling"],
  "query-lab": ["query-lab"],
  security: ["users", "roles", "api-keys"],
  services: ["services"],
  traces: ["traces"],
  dashboards: ["dashboards"],
  "add-data": ["add-data"],
  all: Object.keys(PAGE_NAV_BUTTONS),
};

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    section: process.env.SCREENSHOT_SECTION ?? "all",
    url: process.env.SCREENSHOT_URL ?? "http://127.0.0.1:3000/ai-github-actions-playground/",
    outDir: process.env.SCREENSHOT_OUT_DIR ?? "screenshots",
    live: false,
    esUrl: "http://localhost:9200",
    timeoutMs: 30_000,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--section" && argv[i + 1]) opts.section = argv[++i];
    else if (arg === "--url" && argv[i + 1]) opts.url = argv[++i];
    else if (arg === "--out-dir" && argv[i + 1]) opts.outDir = argv[++i];
    else if (arg === "--live") opts.live = true;
    else if (arg === "--es-url" && argv[i + 1]) opts.esUrl = argv[++i];
    else if (arg === "--timeout-ms" && argv[i + 1]) opts.timeoutMs = Number(argv[++i]) || 30_000;
  }

  return opts;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Seed the Zustand UI store localStorage key so the app starts in the
 * requested theme mode without any UI interaction needed.
 */
function makeThemeInitScript(themeMode) {
  return `
    (function() {
      try {
        const key = "elastic-peek-theme";
        const existing = JSON.parse(localStorage.getItem(key) || "{}");
        existing.state = existing.state || {};
        existing.state.themeMode = "${themeMode}";
        localStorage.setItem(key, JSON.stringify(existing));
      } catch {}
    })();
  `;
}

/**
 * Connect the app to Elasticsearch (mocked or live) and wait for the sidebar.
 */
async function connectApp(page, opts) {
  const esUrl = opts.live ? opts.esUrl : DEFAULT_ES_URL;

  if (!opts.live) {
    await registerElasticsearchMocks(page, {
      esUrl: DEFAULT_ES_URL,
      data: { clusterInfo: { cluster_name: "screenshot-cluster" } },
    });
  }

  await page.goto(opts.url, { waitUntil: "networkidle", timeout: opts.timeoutMs });
  await page.getByRole("button", { name: "Connect to Elasticsearch" }).click();
  await page.getByRole("textbox", { name: "Elasticsearch URL" }).fill(esUrl);
  if (opts.live) {
    // For live no-auth Elasticsearch (xpack.security.enabled=false), select "No Auth"
    await page.getByRole("tab", { name: "No Auth" }).click();
  }
  await page.getByRole("button", { name: "Connect", exact: true }).click();

  // Wait for the sidebar to confirm connection
  await page
    .getByRole("button", { name: "Metrics", exact: true })
    .waitFor({ timeout: opts.live ? 15_000 : opts.timeoutMs });
}

/**
 * Capture screenshots of all pages in a section for one theme mode.
 * Returns list of { page, path } objects.
 */
async function captureThemeScreenshots(browser, opts, pages, themeMode, outDir) {
  const errors = [];
  const captured = [];

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  // Inject dark mode before the app loads so no UI toggle is needed
  await context.addInitScript(makeThemeInitScript(themeMode));

  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error" && !isIgnorableConsoleError(msg.text())) {
      errors.push({ type: "console", message: msg.text() });
    }
  });
  page.on("pageerror", (err) => {
    errors.push({ type: "page", message: err.message });
  });

  try {
    await connectApp(page, opts);

    for (const slug of pages) {
      const navButton = PAGE_NAV_BUTTONS[slug];
      if (!navButton) {
        console.warn(`  ⚠ Unknown page slug "${slug}", skipping`);
        continue;
      }

      await page.getByRole("button", { name: navButton, exact: true }).click();
      // Wait for client-side route change to take effect. Some pages (e.g.
      // profiling focus picker) don't trigger network requests, so networkidle
      // alone resolves instantly. A brief wait lets React render the new route
      // before we capture.
      await page.waitForTimeout(500);
      await waitForSettle(page, opts.timeoutMs);

      // If a confirmation heading is defined for this page, wait for it to
      // appear before capturing.  This prevents race conditions where a
      // parallel browser context hasn't finished its route transition.
      const heading = PAGE_CONFIRMATION_HEADING[slug];
      if (heading) {
        try {
          await page.getByRole("heading", { name: heading, exact: false }).waitFor({ timeout: 5_000 });
        } catch {
          errors.push({
            type: "navigation",
            message: `Confirmation heading "${heading}" not found for ${slug}`,
          });
          continue;
        }
      }

      const screenshotPath = path.join(outDir, `${slug}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      captured.push({ page: slug, path: screenshotPath });
      console.log(`  ✓ ${themeMode.padEnd(5)} ${slug}`);
    }
  } finally {
    await context.close();
  }

  return { captured, errors };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  const opts = parseArgs(process.argv.slice(2));

  const pages = SECTION_PAGES[opts.section];
  if (!pages) {
    console.error(
      `Unknown --section "${opts.section}". Valid values: ${Object.keys(SECTION_PAGES).join(", ")}`,
    );
    process.exit(1);
  }

  const lightDir = path.join(opts.outDir, opts.section, "light");
  const darkDir = path.join(opts.outDir, opts.section, "dark");
  await fs.mkdir(lightDir, { recursive: true });
  await fs.mkdir(darkDir, { recursive: true });

  console.log(
    `\nCapturing ${pages.length} page(s) for section "${opts.section}" ` +
      `(light + dark) → ${opts.outDir}/${opts.section}/`,
  );
  if (opts.live) console.log(`  Live mode: ES at ${opts.esUrl}`);

  const browser = await chromium.launch({ headless: true });
  const allErrors = [];

  try {
    // Capture light and dark themes in parallel using separate browser contexts
    const [lightResult, darkResult] = await Promise.all([
      captureThemeScreenshots(browser, opts, pages, "light", lightDir),
      captureThemeScreenshots(browser, opts, pages, "dark", darkDir),
    ]);

    const { captured: lightCaptured, errors: lightErrors } = lightResult;
    const { captured: darkCaptured, errors: darkErrors } = darkResult;

    allErrors.push(...lightErrors, ...darkErrors);

    // Write a manifest so the agent knows exactly which files to evaluate
    const manifest = {
      section: opts.section,
      capturedAt: new Date().toISOString(),
      live: opts.live,
      pages: {
        light: lightCaptured,
        dark: darkCaptured,
      },
      errors: allErrors,
    };
    const manifestPath = path.join(opts.outDir, opts.section, "manifest.json");
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    console.log(`\nManifest written to ${manifestPath}`);
    console.log(
      `Captured ${lightCaptured.length + darkCaptured.length} screenshots total.`,
    );
  } finally {
    await browser.close();
  }

  if (allErrors.length > 0) {
    console.error(`\n${allErrors.length} error(s) during capture:`);
    for (const e of allErrors) console.error(`  [${e.type}] ${e.message}`);
    process.exit(1);
  }

  console.log("\nAll screenshots captured successfully.");
}

run().catch((err) => {
  console.error("screenshot-section crashed:", err);
  process.exit(1);
});
