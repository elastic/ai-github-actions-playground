/**
 * Shared helpers and page definitions for love-audit specs.
 *
 * Both the mocked and demo variants call {@link registerLoveAuditTests} with
 * their own `connect` callback and page list, keeping all navigation,
 * screenshot, accessibility, and diagnostics logic in one place.
 */
import { test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConsoleDiagnostic {
  type: string;
  text: string;
}

/**
 * Describes one page (or sub-view) to audit.
 *
 * - `navButton` — the sidebar button label (clicked with `exact: true`).
 * - `waitMs` — how long to wait after navigation (default 1500).
 * - `afterNav` — optional extra steps between navigation and the screenshot
 *    (e.g. click tabs, set filters, press Run). Receives the `Page` and
 *    the file-prefix so it can take additional screenshots.
 */
export interface PageAuditConfig {
  name: string;
  navButton: string;
  waitMs?: number;
  afterNav?: (page: Page, prefix: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Diagnostic helpers
// ---------------------------------------------------------------------------

export function collectConsoleLogs(page: Page): ConsoleDiagnostic[] {
  const logs: ConsoleDiagnostic[] = [];
  page.on("console", (msg) => {
    const type = msg.type();
    if (type === "error" || type === "warning") {
      logs.push({ type, text: msg.text() });
    }
  });
  return logs;
}

export async function runAccessibilityCheck(page: Page, pageName: string) {
  const results = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();

  if (results.violations.length > 0) {
    console.log(`\n=== A11Y VIOLATIONS: ${pageName} (${results.violations.length}) ===`);
    for (const v of results.violations) {
      console.log(`  [${v.impact}] ${v.id}: ${v.description}`);
      for (const node of v.nodes.slice(0, 3)) {
        console.log(`    -> ${node.target.join(" > ")}`);
      }
    }
  }
  return results.violations;
}

export async function checkForMuiErrors(page: Page): Promise<string[]> {
  const alerts = page.locator(".MuiAlert-standardError");
  const count = await alerts.count();
  const errors: string[] = [];
  for (let i = 0; i < count; i++) {
    const text = await alerts.nth(i).textContent();
    if (text) errors.push(text);
  }
  return errors;
}

export async function dumpDOM(page: Page, pageName: string, prefix: string) {
  const html = await page.evaluate(() => {
    const main = document.querySelector("main") ?? document.querySelector("#root") ?? document.body;
    return main.innerHTML;
  });
  const fs = await import("fs");
  const path = await import("path");
  const dir = path.resolve("test-results");
  fs.mkdirSync(dir, { recursive: true });
  const slug = pageName.toLowerCase().replace(/\s+/g, "-");
  fs.writeFileSync(path.join(dir, `${prefix}-dom-${slug}.html`), html, "utf-8");
}

export function logDiagnostics(
  pageName: string,
  consoleLogs: ConsoleDiagnostic[],
  muiErrors: string[],
  a11yCount: number,
) {
  console.log(`\n=== DIAGNOSTICS: ${pageName} ===`);
  console.log(`Console errors/warnings: ${consoleLogs.length}`);
  consoleLogs.forEach((l) => console.log(`  [${l.type}] ${l.text}`));
  console.log(`MUI error alerts: ${muiErrors.length}`);
  muiErrors.forEach((e) => console.log(`  ${e}`));
  console.log(`A11y violations: ${a11yCount}`);
}

export function slug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

// ---------------------------------------------------------------------------
// Shared page definitions
// ---------------------------------------------------------------------------

/** Pages audited by both the mocked and demo variants. */
export const COMMON_PAGES: PageAuditConfig[] = [
  { name: "Cluster Overview", navButton: "Cluster Overview" },
  { name: "Data Streams", navButton: "Data Streams" },
  {
    name: "Indices",
    navButton: "Indices",
    afterNav: async (page, prefix) => {
      // Screenshot overview tab first
      await page.screenshot({
        path: `test-results/${prefix}-indices-overview.png`,
        fullPage: true,
      });
      // Navigate through sub-tabs
      for (const tab of ["Mappings", "Settings", "Stats", "Disk Usage"]) {
        await page.getByRole("tab", { name: tab }).click();
        await page.waitForTimeout(500);
        await page.screenshot({
          path: `test-results/${prefix}-indices-${slug(tab)}.png`,
          fullPage: true,
        });
      }
    },
  },
  { name: "Ingest Pipelines", navButton: "Ingest Pipelines" },
  { name: "Query Lab", navButton: "Query Lab" },
  {
    name: "Metrics",
    navButton: "Metrics",
    afterNav: async (page, prefix) => {
      await page.screenshot({
        path: `test-results/${prefix}-metrics.png`,
        fullPage: true,
      });
      const metricSearch = page.getByLabel("Search metrics");
      await metricSearch.fill("system.cpu");
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: `test-results/${prefix}-metrics-search.png`,
        fullPage: true,
      });
    },
  },
  { name: "Console", navButton: "Console", waitMs: 1000 },
  { name: "Users", navButton: "Users" },
  { name: "Roles", navButton: "Roles" },
  { name: "Dashboards", navButton: "Dashboards", waitMs: 1000 },
  { name: "Fleet", navButton: "Fleet" },
];

/**
 * Profiling sub-view helper: navigate to Profiling, pick a view mode chip,
 * set time range to "Last 7d", click Run, and wait for results.
 */
async function profilingAfterNav(viewMode: string, waitMs: number) {
  return async (page: Page) => {
    await page.getByRole("button", { name: viewMode, exact: true }).click();
    await page.getByLabel("Time range").click();
    await page.getByRole("option", { name: "Last 7d" }).click();
    await page.getByRole("button", { name: "Run" }).click();
    await page.waitForTimeout(waitMs);
  };
}

/** Profiling pages — only meaningful against a cluster with profiling data. */
export const PROFILING_PAGES: PageAuditConfig[] = [
  {
    name: "Profiling Top Functions",
    navButton: "Profiling",
    waitMs: 1000,
    afterNav: async (page) => {
      // Top Functions is the default view, just set time range and run
      await page.getByLabel("Time range").click();
      await page.getByRole("option", { name: "Last 7d" }).click();
      await page.getByRole("button", { name: "Run" }).click();
      await page.waitForTimeout(5000);

      // Check function name resolution
      const tableText = await page.locator("table").textContent();
      if (tableText) {
        const unknownCount = (tableText.match(/\(unknown\)/g) ?? []).length;
        console.log(`  Function name resolution: ${unknownCount} "(unknown)" entries in table`);
      }
    },
  },
  {
    name: "Profiling Stacktraces",
    navButton: "Profiling",
    waitMs: 1000,
    afterNav: async (page, prefix) => {
      await (
        await profilingAfterNav("Stacktraces", 8000)
      )(page);

      // Expand the first stacktrace
      const firstRow = page.locator("table tbody tr").first();
      await firstRow.click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `test-results/${prefix}-profiling-stacktraces-expanded.png`,
        fullPage: true,
      });

      // Check frame resolution
      const expandedText = await page.locator("table").textContent();
      if (expandedText) {
        const unknownCount = (expandedText.match(/\(unknown\)/g) ?? []).length;
        console.log(
          `  Frame resolution: ${unknownCount} "(unknown)" frames in expanded stacktraces`,
        );
      }
    },
  },
  {
    name: "Profiling Flamegraph",
    navButton: "Profiling",
    waitMs: 1000,
    afterNav: async (page) => {
      await (
        await profilingAfterNav("Flamegraph", 10_000)
      )(page);
    },
  },
  {
    name: "Profiling Timeline",
    navButton: "Profiling",
    waitMs: 1000,
    afterNav: async (page) => {
      await (
        await profilingAfterNav("Timeline", 5000)
      )(page);
    },
  },
  {
    name: "Profiling Flamescope",
    navButton: "Profiling",
    waitMs: 1000,
    afterNav: async (page) => {
      await (
        await profilingAfterNav("Flamescope", 10_000)
      )(page);
    },
  },
];

// ---------------------------------------------------------------------------
// Test registration
// ---------------------------------------------------------------------------

/**
 * Register a `test.describe` block that audits every page in `pages`.
 *
 * Each page gets its own parallel Playwright test that:
 * 1. Collects console logs
 * 2. Connects to the cluster via `connect`
 * 3. Navigates to the page
 * 4. Runs optional `afterNav` steps
 * 5. Takes a screenshot, dumps DOM, runs a11y, and logs diagnostics
 */
export function registerLoveAuditTests(
  describeName: string,
  connect: (page: Page) => Promise<void>,
  pages: PageAuditConfig[],
  prefix: string,
) {
  test.describe.configure({ mode: "parallel" });

  test.describe(describeName, () => {
    for (const pageConfig of pages) {
      test(pageConfig.name, async ({ page }) => {
        const consoleLogs = collectConsoleLogs(page);
        await connect(page);

        // Navigate
        await page.getByRole("button", { name: pageConfig.navButton, exact: true }).click();
        await page.waitForTimeout(pageConfig.waitMs ?? 1500);

        // Optional extra steps (tab navigation, filters, Run button, etc.)
        if (pageConfig.afterNav) {
          await pageConfig.afterNav(page, prefix);
        }

        // Final screenshot + diagnostics
        const screenshotSlug = slug(pageConfig.name);
        await page.screenshot({
          path: `test-results/${prefix}-${screenshotSlug}.png`,
          fullPage: true,
        });
        await dumpDOM(page, pageConfig.name, prefix);
        const muiErrors = await checkForMuiErrors(page);
        const a11y = await runAccessibilityCheck(page, pageConfig.name);
        logDiagnostics(pageConfig.name, consoleLogs, muiErrors, a11y.length);
      });
    }
  });
}
