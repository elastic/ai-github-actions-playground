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
      "color-contrast": 2,
    },
    Metrics: {
      "aria-input-field-name": 1,
      "aria-prohibited-attr": 1,
      "color-contrast": 2,
    },
    Services: {},
    Traces: {
      "aria-input-field-name": 2,
      "aria-prohibited-attr": 1,
      "color-contrast": 12,
    },
    "Query Lab": {
      "aria-input-field-name": 2,
      "aria-prohibited-attr": 1,
      "color-contrast": 12,
    },
    Logs: {
      "aria-input-field-name": 2,
      "aria-prohibited-attr": 1,
      "color-contrast": 16,
      "scrollable-region-focusable": 1,
    },
    Console: {
      "aria-input-field-name": 1,
      "color-contrast": 16,
      "scrollable-region-focusable": 1,
    },
    Indices: {
      "color-contrast": 2,
    },
  },
  "mobile-safari": {
    "Query Lab": {
      "aria-input-field-name": 2,
      "aria-prohibited-attr": 1,
      "color-contrast": 12,
      "scrollable-region-focusable": 2,
    },
    Logs: {
      "aria-input-field-name": 2,
      "aria-prohibited-attr": 1,
      "color-contrast": 16,
      "scrollable-region-focusable": 2,
    },
    Traces: {
      "aria-input-field-name": 2,
      "aria-prohibited-attr": 1,
      "color-contrast": 12,
      "scrollable-region-focusable": 1,
    },
    Console: {
      "aria-input-field-name": 1,
      "color-contrast": 16,
      "scrollable-region-focusable": 2,
    },
    Indices: {
      "color-contrast": 2,
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

  test("add data entrypoint exposes the full three-step happy path", async ({ page }) => {
    await connectToMockCluster(page);
    await navigateViaSidebar(page, "Add Data");

    await expect(
      page.getByRole("heading", { name: "Step 1: What are you monitoring?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Kubernetes" }).first().click();
    await page.getByRole("button", { name: "Continue to step 2" }).click();
    await expect(page.getByRole("heading", { name: "Step 2: Set up and verify" })).toBeVisible();

    await page.getByRole("button", { name: "Continue to step 3" }).click();
    await expect(
      page.getByRole("heading", { name: "Step 3: Explore your data + next steps" }),
    ).toBeVisible();
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
    await expect(page.getByText("Save to Dashboard")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Query took")).toBeVisible({ timeout: 15_000 });
  });

  test("traces user opens a trace and pivots from service map context into Query Lab", async ({
    page,
  }) => {
    await connectToMockCluster(page);
    await navigateViaSidebar(page, "Traces");
    await page.getByRole("button", { name: "Search Traces" }).first().click();
    await expect(page.getByText("1 trace found")).toBeVisible();
    await page.getByText("GET /checkout").click();
    await expect(page.getByText("2 spans")).toBeVisible();
    await page.getByRole("button", { name: "Service Map" }).click();
    await expect(
      page.getByText("Select a trace in List or Scatter view to see its service map"),
    ).toBeHidden();
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

  test("header chip reflects current page label on non-dashboard routes", async ({ page }) => {
    await connectToMockCluster(page);
    // Navigate to a non-dashboard page (Query Lab / discover)
    await navigateViaSidebar(page, "Query Lab");
    await expect(page).toHaveURL(/\/discover$/);
    // The global header (banner) must show the current page label chip (Desktop only)
    if (page.viewportSize()!.width > 768) {
      const header = page.getByRole("banner");
      await expect(header.getByText("Query Lab")).toBeVisible();
    }
  });

  test("ops user confirms connection guardrails and can reset back to the landing state", async ({
    page,
  }) => {
    await page.goto("");
    await page.getByRole("button", { name: "Connect to Elasticsearch" }).click();
    const connectBtn = page.getByRole("button", { name: "Connect", exact: true });
    await expect(connectBtn).toBeDisabled();
    await page.getByRole("textbox", { name: "Elasticsearch URL" }).fill(DEFAULT_ES_URL);
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
    const queryEditor = page.getByLabel("ES|QL query editor");
    const queryInput = queryEditor.getByRole("textbox");
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
    const queryEditor = page.getByLabel("ES|QL query editor");
    const queryInput = queryEditor.getByRole("textbox");
    await expect(queryEditor).toBeVisible();
    await queryInput.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("FROM logs-* | LIMIT 1");
    await page.getByRole("button", { name: /^Search Logs\b/ }).click();
    await expect(page.getByRole("columnheader", { name: "@timestamp" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "message" })).toBeVisible();
  });

  test("logs explorer keeps search and click-to-filter in visible query", async ({ page }) => {
    await connectToMockCluster(page);
    await navigateViaSidebar(page, "Logs");
    await expect(page).toHaveURL(/\/logs$/);

    const queryEditor = page.getByLabel("ES|QL query editor");
    const queryInput = queryEditor.getByRole("textbox");
    await page.getByLabel("Search logs").fill('"Hello World"');
    await page.getByRole("button", { name: "Apply Search" }).click();
    await expect(queryInput).toContainText('MATCH_PHRASE(message, "Hello World")');

    await page.getByRole("button", { name: /^Search Logs\b/ }).click();
    await page.getByRole("cell", { name: "checkout-service" }).click();
    await expect(page.getByText("service.name: checkout-service")).toBeVisible();
    await expect(queryInput).toContainText('service.name == "checkout-service"');
  });

  test("pages have no axe accessibility violations", async ({ page }, testInfo) => {
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
      "Query Lab": () => expect(page.getByLabel("ES|QL query editor")).toBeVisible(),
      Logs: () => expect(page.getByLabel("ES|QL query editor")).toBeVisible(),
      Console: () => expect(page.getByLabel("ES|QL query editor")).toBeVisible(),
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
      await page.waitForLoadState("networkidle");
      await pageReadyLocators[nav]!();
      await checkA11y(page, nav, testInfo);
    }
  });
});
