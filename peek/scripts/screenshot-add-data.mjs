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
import { PAGE_NAV_BUTTONS } from "./page-nav-buttons.mjs";

// ---------------------------------------------------------------------------
// Catalog data (mirrors peek/src/services/addData/catalog.ts)
// ---------------------------------------------------------------------------

const EXPERIENCE_LABELS = {
  cloud_providers: "Cloud Providers",
  kubernetes: "Kubernetes",
  servers: "Servers, Desktops & Laptops",
  saas_databases: "SaaS & Databases",
  advanced: "Advanced",
};

const PRIMARY_EXPERIENCES = ["cloud_providers", "kubernetes", "servers", "saas_databases"];

/** Every technology from the catalog, in display order. */
const ADD_DATA_TECHNOLOGIES = [
  { id: "aws", technology: "AWS", experience: "cloud_providers", guideType: "aws_cloud_deploy" },
  { id: "vpc-flow-logs", technology: "VPC Flow Logs", experience: "cloud_providers", guideType: "edot_collector" },
  { id: "kubernetes", technology: "Kubernetes", experience: "kubernetes", guideType: "edot_collector" },
  { id: "docker", technology: "Docker", experience: "kubernetes", guideType: "edot_collector" },
  { id: "linux-host", technology: "Linux Host", experience: "servers", guideType: "edot_collector" },
  { id: "windows-host", technology: "Windows Host", experience: "servers", guideType: "edot_collector" },
  { id: "macos-host", technology: "macOS Host", experience: "servers", guideType: "edot_collector" },
  { id: "nginx", technology: "Nginx", experience: "saas_databases", guideType: "otel_receiver" },
  { id: "postgresql", technology: "PostgreSQL", experience: "saas_databases", guideType: "otel_receiver" },
  { id: "redis", technology: "Redis", experience: "saas_databases", guideType: "otel_receiver" },
  { id: "mysql", technology: "MySQL", experience: "saas_databases", guideType: "otel_receiver" },
  { id: "mongodb", technology: "MongoDB", experience: "saas_databases", guideType: "otel_receiver" },
  { id: "java-apm", technology: "Java", experience: "advanced", guideType: "apm" },
  { id: "python-apm", technology: "Python", experience: "advanced", guideType: "apm" },
  { id: "nodejs-apm", technology: "Node.js", experience: "advanced", guideType: "apm" },
  { id: "go-apm", technology: "Go", experience: "advanced", guideType: "apm" },
  { id: "dotnet-apm", technology: ".NET", experience: "advanced", guideType: "apm" },
  { id: "ruby-apm", technology: "Ruby", experience: "advanced", guideType: "apm" },
  { id: "php-apm", technology: "PHP", experience: "advanced", guideType: "apm" },
  { id: "fluent-bit", technology: "Fluent Bit", experience: "advanced", guideType: "fluent_bit" },
];

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
];

function isIgnorableConsoleError(text) {
  return IGNORABLE_CONSOLE_PATTERNS.some((re) => re.test(text));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SETTLE_MS = 1500;

/** Navigate to Add Data Step 1 by clicking away then back. */
async function resetToAddDataLanding(page) {
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Add Data", exact: true }).click();
  await page.waitForTimeout(SETTLE_MS);
}

/**
 * From Step 1 landing, open the technology list for an experience.
 * For primary experiences, clicks the tile. For "advanced", clicks the expander.
 */
async function openExperience(page, experience) {
  const label = EXPERIENCE_LABELS[experience];
  if (experience === "advanced") {
    // Click the Advanced collapsible header
    await page.locator("button").filter({ hasText: "Advanced" }).first().click();
    await page.waitForTimeout(500);
  } else {
    // Click the experience tile by its label text
    await page.getByText(label, { exact: true }).first().click();
    await page.waitForTimeout(SETTLE_MS);
  }
}

/** Select a technology card by its display name. */
async function selectTechnology(page, technologyName) {
  await page.getByText(technologyName, { exact: true }).first().click();
  await page.waitForTimeout(500);
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

    // Navigate to Add Data
    await page.getByRole("button", { name: "Add Data", exact: true }).click();
    await page.waitForTimeout(SETTLE_MS);

    let captured = 0;

    // -----------------------------------------------------------------------
    // 1. Landing page (experience tiles)
    // -----------------------------------------------------------------------
    const landingPath = path.join(opts.outDir, "add-data-landing.png");
    await page.screenshot({ path: landingPath, fullPage: true });
    console.log(`  add-data-landing`);
    captured += 1;

    // -----------------------------------------------------------------------
    // 2. Each experience's technology list
    // -----------------------------------------------------------------------
    for (const exp of [...PRIMARY_EXPERIENCES, "advanced"]) {
      await resetToAddDataLanding(page);
      await openExperience(page, exp);

      const slug = exp.replace(/_/g, "-");
      const expPath = path.join(opts.outDir, `add-data-experience-${slug}.png`);
      await page.screenshot({ path: expPath, fullPage: true });
      console.log(`  add-data-experience-${slug}`);
      captured += 1;
    }

    // -----------------------------------------------------------------------
    // 3. Step 2 for every technology + Step 3 for first per guide type
    // -----------------------------------------------------------------------
    const capturedStep3GuideTypes = new Set();

    for (const tech of ADD_DATA_TECHNOLOGIES) {
      await resetToAddDataLanding(page);
      await openExperience(page, tech.experience);
      await selectTechnology(page, tech.technology);

      // Click Continue → Step 2
      await page.getByRole("button", { name: "Continue" }).click();
      await page.waitForTimeout(SETTLE_MS);

      const step2Path = path.join(opts.outDir, `add-data-step2-${tech.id}.png`);
      await page.screenshot({ path: step2Path, fullPage: true });
      console.log(`  add-data-step2-${tech.id}`);
      captured += 1;

      // Capture Step 3 for the first technology of each guide type
      if (!capturedStep3GuideTypes.has(tech.guideType)) {
        capturedStep3GuideTypes.add(tech.guideType);

        await page.getByRole("button", { name: "Continue" }).click();
        await page.waitForTimeout(SETTLE_MS);

        const step3Path = path.join(opts.outDir, `add-data-step3-${tech.id}.png`);
        await page.screenshot({ path: step3Path, fullPage: true });
        console.log(`  add-data-step3-${tech.id}`);
        captured += 1;
      }
    }

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
