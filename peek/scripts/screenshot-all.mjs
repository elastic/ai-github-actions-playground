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
import { PAGE_NAV_BUTTONS } from "./page-nav-buttons.mjs";

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
  /status of 404/,
];

// ---------------------------------------------------------------------------
// Add Data catalog (mirrors peek/src/services/addData/catalog.ts)
// ---------------------------------------------------------------------------

const EXPERIENCE_LABELS = {
  cloud_providers: "Cloud Providers",
  kubernetes: "Kubernetes",
  servers: "Servers, Desktops & Laptops",
  saas_databases: "SaaS & Databases",
  advanced: "Advanced",
};

const PRIMARY_EXPERIENCES = ["cloud_providers", "kubernetes", "servers", "saas_databases"];

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

    const SETTLE_MS = opts.live ? 2000 : 1500;

    console.log(`Capturing ${Object.keys(PAGE_NAV_BUTTONS).length} pages to ${opts.outDir}/...`);

    // Screenshot each page
    for (const [slug, navButton] of Object.entries(PAGE_NAV_BUTTONS)) {
      await page.getByRole("button", { name: navButton, exact: true }).click();
      await page.waitForTimeout(SETTLE_MS);

      const screenshotPath = path.join(opts.outDir, `screenshot-${slug}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`  ${slug}`);
    }

    // -----------------------------------------------------------------------
    // Add Data detailed flow screenshots
    // -----------------------------------------------------------------------
    const addDataDir = path.join(opts.outDir, "add-data");
    await fs.mkdir(addDataDir, { recursive: true });

    /** Navigate to Add Data Step 1 by clicking away then back. */
    async function resetToAddDataLanding() {
      await page.getByRole("button", { name: "Overview", exact: true }).click();
      await page.waitForTimeout(500);
      await page.getByRole("button", { name: "Add Data", exact: true }).click();
      await page.waitForTimeout(SETTLE_MS);
    }

    /** Open the technology list for an experience. */
    async function openExperience(experience) {
      if (experience === "advanced") {
        await page.locator("button").filter({ hasText: "Advanced" }).first().click();
        await page.waitForTimeout(500);
      } else {
        await page.getByText(EXPERIENCE_LABELS[experience], { exact: true }).first().click();
        await page.waitForTimeout(SETTLE_MS);
      }
    }

    /** Select a technology card by its display name. */
    async function selectTechnology(technologyName) {
      await page
        .locator("[aria-pressed]")
        .filter({ hasText: technologyName })
        .first()
        .click();
      await page.waitForTimeout(500);
    }

    console.log(`\nCapturing add-data flows to ${addDataDir}/...`);

    // Navigate to Add Data
    await page.getByRole("button", { name: "Add Data", exact: true }).click();
    await page.waitForTimeout(SETTLE_MS);

    // 1. Landing page
    await page.screenshot({ path: path.join(addDataDir, "add-data-landing.png"), fullPage: true });
    console.log("  add-data-landing");

    // 2. Each experience's technology list
    for (const exp of [...PRIMARY_EXPERIENCES, "advanced"]) {
      await resetToAddDataLanding();
      await openExperience(exp);

      const slug = exp.replace(/_/g, "-");
      await page.screenshot({ path: path.join(addDataDir, `add-data-experience-${slug}.png`), fullPage: true });
      console.log(`  add-data-experience-${slug}`);
    }

    // 3. Step 2 for every technology + Step 3 for first per guide type
    const capturedStep3GuideTypes = new Set();

    for (const tech of ADD_DATA_TECHNOLOGIES) {
      await resetToAddDataLanding();
      await openExperience(tech.experience);
      await selectTechnology(tech.technology);

      await page.getByRole("button", { name: "Continue" }).click();
      await page.waitForTimeout(SETTLE_MS);

      await page.screenshot({ path: path.join(addDataDir, `add-data-step2-${tech.id}.png`), fullPage: true });
      console.log(`  add-data-step2-${tech.id}`);

      if (!capturedStep3GuideTypes.has(tech.guideType)) {
        capturedStep3GuideTypes.add(tech.guideType);

        await page.getByRole("button", { name: "Continue" }).click();
        await page.waitForTimeout(SETTLE_MS);

        await page.screenshot({ path: path.join(addDataDir, `add-data-step3-${tech.id}.png`), fullPage: true });
        console.log(`  add-data-step3-${tech.id}`);
      }
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
