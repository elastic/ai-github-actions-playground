import { test, expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import { DEFAULT_ES_URL, registerElasticsearchMocks } from "../../scripts/elasticsearch-mocks.mjs";

/**
 * Baseline of known pre-existing axe violations per browser project and page
 * (tracked in #954).
 *
 * IMPORTANT: This is a temporary measure to prevent accessibility regressions
 * while we work toward full WCAG 2.2 Level AA compliance. Each entry here
 * represents a technical debt item that should be resolved rather than expanded.
 *
 * Structure: browser project name → page label → rule ID → max violating nodes.
 * A missing project key falls back to the "_default" entry.
 * The gate fails when a new rule fires or its node count exceeds the baseline.
 */
const A11Y_BASELINE: Record<string, Record<string, Record<string, number>>> = {
  _default: {
    welcome: {
      "color-contrast": 1,
      "page-has-heading-one": 1,
    },
    "post-connect": {
      "color-contrast": 3,
    },
    Metrics: {
      "aria-prohibited-attr": 1,
      "color-contrast": 3,
    },
    Services: {
      "color-contrast": 2,
    },
    Traces: {
      "aria-prohibited-attr": 1,
      "color-contrast": 17,
    },
    "Query Lab": {
      "aria-prohibited-attr": 1,
      "color-contrast": 17,
      "scrollable-region-focusable": 1,
    },
    Logs: {
      "aria-prohibited-attr": 1,
      "color-contrast": 18,
      "scrollable-region-focusable": 1,
    },
    Console: {
      "color-contrast": 17,
      "scrollable-region-focusable": 1,
    },
    Indices: {
      "color-contrast": 9,
    },
  },
  "mobile-safari": {
    "Query Lab": {
      "aria-prohibited-attr": 1,
      "color-contrast": 17,
      "scrollable-region-focusable": 2,
    },
    Logs: {
      "aria-prohibited-attr": 1,
      "color-contrast": 17,
      "scrollable-region-focusable": 2,
    },
    Traces: {
      "aria-prohibited-attr": 1,
      "color-contrast": 13,
      "scrollable-region-focusable": 1,
    },
    Console: {
      "color-contrast": 17,
      "scrollable-region-focusable": 2,
    },
    Indices: {
      "color-contrast": 3,
    },
  },
  "mobile-chrome": {
    "Query Lab": {
      "scrollable-region-focusable": 1,
    },
  },
};

/**
 * Run an axe accessibility scan and fail on any *new* violations.
 * A violation is "new" if its rule ID is absent from the baseline or if the
 * number of violating nodes exceeds the baselined count for that rule+page+browser.
 */
async function checkA11y(page: Page, pageName: string, testInfo: TestInfo) {
  const results = await new AxeBuilder({ page }).analyze();
  const projectName = testInfo.project.name;
  const projectBaseline = A11Y_BASELINE[projectName] ?? {};
  const baseline = {
    ...(A11Y_BASELINE["_default"]?.[pageName] ?? {}),
    ...(projectBaseline[pageName] ?? {}),
  };

  const newViolations = results.violations.filter((v) => {
    const allowed = baseline[v.id];
    if (allowed === undefined) return true;
    return v.nodes.length > allowed;
  });

  expect(
    newViolations.map(
      (v) => `${v.id} (${v.nodes.length} node(s), baseline: ${baseline[v.id] ?? "none"})`,
    ),
    `axe found new accessibility violations on "${pageName}" [${projectName}].\n` +
      `Fix the violations or, if absolutely necessary, update A11Y_BASELINE in smoke.spec.ts.\n` +
      `See DEVELOPING.md for accessibility standards.`,
  ).toEqual([]);
}

async function mockElasticsearch(page: Page) {
  await registerElasticsearchMocks(page, {
    esUrl: DEFAULT_ES_URL,
    data: { clusterInfo: { cluster_name: "playwright-smoke-cluster" } },
    queryResolver: ({ query }) => {
      if (query.includes('trace.id == "trace-123"')) {
        return {
          columns: [
            { name: "trace.id", type: "keyword" },
            { name: "span.id", type: "keyword" },
            { name: "parent.id", type: "keyword" },
            { name: "service.name", type: "keyword" },
            { name: "name", type: "keyword" },
            { name: "kind", type: "keyword" },
            { name: "attributes.span.duration.us", type: "long" },
            { name: "status", type: "keyword" },
            { name: "@timestamp", type: "date" },
            { name: "events", type: "keyword" },
          ],
          values: [
            [
              "trace-123",
              "span-root",
              null,
              "checkout-service",
              "GET /checkout",
              "server",
              55000,
              "STATUS_CODE_OK",
              "2026-02-23T10:00:00.000Z",
              "[]",
            ],
            [
              "trace-123",
              "span-db",
              "span-root",
              "payments-db",
              "SELECT charge",
              "client",
              32000,
              "STATUS_CODE_OK",
              "2026-02-23T10:00:00.010Z",
              "[]",
            ],
          ],
        };
      }

      if (query.includes("STATS request_count = COUNT(*)")) {
        return {
          columns: [
            { name: "@timestamp", type: "date" },
            { name: "request_count", type: "long" },
            { name: "avg_latency_ms", type: "double" },
            { name: "p95_latency_ms", type: "double" },
          ],
          values: [
            ["2026-02-23T09:55:00.000Z", 4, 18.2, 41.3],
            ["2026-02-23T10:00:00.000Z", 5, 22.8, 48.6],
          ],
        };
      }

      if (query.includes("FROM logs-*")) {
        return {
          columns: [
            { name: "@timestamp", type: "date" },
            { name: "service.name", type: "keyword" },
            { name: "log.level", type: "keyword" },
            { name: "message", type: "keyword" },
            { name: "trace.id", type: "keyword" },
          ],
          values: [
            ["2026-02-23T10:00:00.000Z", "checkout-service", "ERROR", "Hello World", "trace-123"],
          ],
        };
      }

      if (query.includes("FROM traces-*")) {
        return {
          columns: [
            { name: "trace.id", type: "keyword" },
            { name: "span.id", type: "keyword" },
            { name: "service.name", type: "keyword" },
            { name: "name", type: "keyword" },
            { name: "attributes.span.duration.us", type: "long" },
            { name: "status", type: "keyword" },
            { name: "@timestamp", type: "date" },
          ],
          values: [
            [
              "trace-123",
              "span-root",
              "checkout-service",
              "GET /checkout",
              55000,
              "STATUS_CODE_OK",
              "2026-02-23T10:00:00.000Z",
            ],
          ],
        };
      }

      return undefined;
    },
    fallback: { error: { reason: "Unhandled mock route" } },
  });
}

/**
 * Navigate to a page using the sidebar, opening the mobile drawer first if necessary.
 */
async function navigateViaSidebar(page: Page, label: string) {
  const isMobile = page.viewportSize()!.width <= 768;
  const navBtn = page.getByRole("button", { name: label, exact: true });

  if (isMobile && !(await navBtn.isVisible())) {
    await page.getByRole("button", { name: "Open navigation menu" }).click();
  }

  await navBtn.click();
}

async function connectToMockCluster(page: Page) {
  await mockElasticsearch(page);
  await page.goto("");
  await page.getByRole("button", { name: "Connect to Elasticsearch" }).click();
  await page.getByRole("textbox", { name: "Elasticsearch URL" }).fill(DEFAULT_ES_URL);
  await page.getByRole("textbox", { name: "API Key" }).fill("test-api-key");
  await page.getByRole("button", { name: "Connect", exact: true }).click();

  // Wait for connection dialog to close
  await expect(page.getByRole("dialog", { name: "Elasticsearch Connection" })).toBeHidden();

  // On mobile, the sidebar is in a temporary drawer that must be opened to see the nav buttons.
  const isMobile = page.viewportSize()!.width <= 768;
  if (isMobile) {
    await page.getByRole("button", { name: "Open navigation menu" }).click();
  }

  await expect(page.getByRole("button", { name: "Metrics", exact: true })).toBeVisible();
}

test.describe("smoke – site navigation", () => {
  test("onboarding user reaches the connect entrypoint from the welcome screen", async ({
    page,
  }) => {
    await page.goto("");
    await expect(page.getByRole("heading", { name: "Elastic Peek" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect to Elasticsearch" })).toBeVisible();
  });

  test("add data entrypoint exposes the technology picker and step 2", async ({ page }) => {
    await connectToMockCluster(page);
    await navigateViaSidebar(page, "Add Data");

    await expect(page.getByRole("heading", { name: /What do you want to monitor/i })).toBeVisible();
    const main = page.getByRole("main");
    await main.getByPlaceholder("Search technologies").fill("Kubernetes");
    await main
      .getByRole("button", { name: /Kubernetes/, pressed: false })
      .first()
      .click();
    // Clicking a technology now auto-advances to step 2
    await expect(page.getByRole("heading", { name: /Set up Kubernetes/i })).toBeVisible();
  });

  test("metrics user connects, picks a metric, and gets a line chart-ready result", async ({
    page,
  }) => {
    await connectToMockCluster(page);
    await navigateViaSidebar(page, "Metrics");
    const metricSearch = page.getByLabel("Search metrics");
    await expect(metricSearch).toBeVisible({ timeout: 5_000 });
    await metricSearch.fill("system.cpu");
    await page.locator("li.MuiAutocomplete-option").first().click();
    await page.getByRole("button", { name: "View ungrouped" }).click();
    // After query success, result count appears in the search panel footer
    await expect(page.getByText("3 metrics found")).toBeVisible({ timeout: 15_000 });
  });

  test("traces user opens a trace and pivots from service map context into Query Lab", async ({
    page,
  }) => {
    await connectToMockCluster(page);
    await navigateViaSidebar(page, "Traces");
    await page.getByRole("button", { name: "Search Traces" }).first().click();
    // "1 trace found" — resultLabel() singularizes for count === 1
    await expect(page.getByText("1 trace found")).toBeVisible({ timeout: 10_000 });
    await page.getByText("GET /checkout").click();
    await expect(page.getByRole("button", { name: "Open in Query Lab" })).toBeVisible({
      timeout: 10_000,
    });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Open in Query Lab" })).toBeHidden();
    await page.getByRole("button", { name: "Service Map" }).click();
    await expect(
      page.getByText("Select a trace in List or Scatter view to see its service map"),
    ).toBeHidden();
    // Return to list view, re-open span details, then pivot into Query Lab.
    await page.getByRole("button", { name: "List" }).click();
    await page.getByText("GET /checkout").click();
    await page.getByRole("button", { name: "Open in Query Lab" }).click();
    await expect(page).toHaveURL(/\/discover$/);
  });

  test("security-focused user validates auth tab switching before submitting credentials", async ({
    page,
  }) => {
    await page.goto("");
    await page.getByRole("button", { name: "Connect to Elasticsearch" }).click();
    await expect(page.getByRole("dialog", { name: "Elasticsearch Connection" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "API Key" })).toBeVisible();
    await page.getByRole("tab", { name: "Username / Password" }).click();
    await expect(page.getByRole("textbox", { name: "Username" })).toBeVisible();
    await page.getByRole("tab", { name: "API Key" }).click();
    await expect(page.getByRole("textbox", { name: "API Key" })).toBeVisible();
  });

  test("ops user confirms connection guardrails and can reset back to the landing state", async ({
    page,
  }) => {
    await page.goto("");
    await page.getByRole("button", { name: "Connect to Elasticsearch" }).click();
    const connectBtn = page.getByRole("button", { name: "Connect", exact: true });
    await expect(connectBtn).toBeDisabled();
    await page.getByRole("textbox", { name: "Elasticsearch URL" }).fill(DEFAULT_ES_URL);
    // Connect still disabled — credentials are also required
    await expect(connectBtn).toBeDisabled();
    await page.getByRole("textbox", { name: "API Key" }).fill("test-api-key");
    await expect(connectBtn).toBeEnabled();
    await page.getByRole("button", { name: "Cancel" }).click();

    await connectToMockCluster(page);
    await page.getByRole("button", { name: /Settings/i }).click();
    await page.getByRole("menuitem", { name: /Reset All State/i }).click();
    await expect(page.getByRole("dialog", { name: /Reset all application state/i })).toBeVisible();
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Elastic Peek" })).toBeVisible();
  });

  test("query lab preserves query text and results after navigating to Console and back", async ({
    page,
  }) => {
    await connectToMockCluster(page);
    const queryInput = page.getByRole("textbox", { name: "ES|QL query editor" });
    const queryText = "FROM logs-* | SORT @timestamp | LIMIT 1";

    // Open Query Lab
    await navigateViaSidebar(page, "Query Lab");
    await expect(page).toHaveURL(/\/discover$/);

    await queryInput.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type(queryText);
    await expect(queryInput).toContainText(queryText);

    // Run query — the mock returns @timestamp + message columns
    await page.getByRole("button", { name: /^Run Query\b/ }).click();
    await expect(page.getByText("Run a query to see results")).toBeHidden();
    // Verify results rendered (default mock: columns @timestamp, message, 1 row)
    await expect(page.getByRole("columnheader", { name: "@timestamp" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "message" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Hello World" })).toBeVisible();

    // Navigate away to Console
    await navigateViaSidebar(page, "Console");
    await expect(page).toHaveURL(/\/console$/);

    // Navigate back to Query Lab
    await navigateViaSidebar(page, "Query Lab");
    await expect(page).toHaveURL(/\/discover$/);

    // Verify query text and results are still present
    await expect(queryInput).toContainText(queryText);
    await expect(page.getByRole("columnheader", { name: "@timestamp" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "message" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Hello World" })).toBeVisible();
    await expect(page.getByText("Run a query to see results")).toBeHidden();
  });

  test("logs explorer route is available and runs a logs query", async ({ page }) => {
    await connectToMockCluster(page);
    await navigateViaSidebar(page, "Logs");
    await expect(page).toHaveURL(/\/logs$/);
    // The ES|QL editor starts collapsed; expand it first
    await page.getByRole("button", { name: "Expand ES|QL query section" }).click();
    const queryInput = page.getByRole("textbox", { name: "ES|QL query editor" });
    await expect(queryInput).toBeVisible();
    await queryInput.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("FROM logs-* | LIMIT 1");
    await page.getByRole("button", { name: /^Search Logs\b/ }).click();
    await expect(page.getByRole("columnheader", { name: "@timestamp" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "message" })).toBeVisible();
  });

  test("logs explorer keeps search and click-to-filter in visible query", async ({ page }) => {
    test.setTimeout(60_000);
    await connectToMockCluster(page);
    await navigateViaSidebar(page, "Logs");
    await expect(page).toHaveURL(/\/logs$/);

    // Use the guided search input (stepper-based flow) to set search text
    await page.getByPlaceholder('e.g. "timeout in checkout"').fill('"Hello World"');
    await page.getByRole("button", { name: "Apply", exact: true }).click();

    // Run the query and wait for results
    await page.getByRole("button", { name: /^Search Logs\b/ }).click();
    await expect(page.getByRole("columnheader", { name: "@timestamp" })).toBeVisible({
      timeout: 15_000,
    });

    // Click-to-filter: clicking a cell adds a filter chip and updates the query
    await page.getByRole("cell", { name: "checkout-service" }).click();
    await expect(page.getByText("service.name: checkout-service")).toBeVisible();

    // Expand the collapsed ES|QL editor to verify the generated query text
    await page.getByRole("button", { name: "Expand ES|QL query section" }).click();
    const queryInput = page.getByRole("textbox", { name: "ES|QL query editor" });
    await expect(queryInput).toContainText('MATCH_PHRASE(message, "Hello World")');
    await expect(queryInput).toContainText('service.name == "checkout-service"');
  });

  test("pages have no axe accessibility violations", async ({ page }, testInfo) => {
    test.setTimeout(90_000); // axe scans 9 pages serially; 30s default is too tight in CI
    await page.goto("");
    await checkA11y(page, "welcome", testInfo);

    await connectToMockCluster(page);
    await checkA11y(page, "post-connect", testInfo);

    // Wait for page-specific content to fully render before running axe,
    // so results are deterministic across fast (local) and slow (CI) machines.
    const pageReadyLocators: Record<string, () => Promise<void>> = {
      Metrics: () => expect(page.getByText("Explore your metrics")).toBeVisible(),
      Services: () =>
        expect(page.getByRole("heading", { name: "Service Performance" })).toBeVisible(),
      Traces: () => expect(page.getByText("Search for traces")).toBeVisible(),
      "Query Lab": () =>
        expect(page.getByRole("textbox", { name: "ES|QL query editor" })).toBeVisible(),
      Logs: () => expect(page.getByRole("heading", { name: "Logs Explorer" })).toBeVisible(),
      Console: () => expect(page.getByRole("heading", { name: "API Console" })).toBeVisible(),
      Indices: () => expect(page.getByRole("heading", { name: "Indices" })).toBeVisible(),
    };

    for (const nav of [
      "Metrics",
      "Services",
      "Traces",
      "Query Lab",
      "Logs",
      "Console",
      "Indices",
    ]) {
      await navigateViaSidebar(page, nav);
      await pageReadyLocators[nav]!();
      await checkA11y(page, nav, testInfo);
    }
  });
});
