import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { DEFAULT_ES_URL, registerElasticsearchMocks } from "../../scripts/elasticsearch-mocks.mjs";

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

async function connectToMockCluster(page: Page) {
  await mockElasticsearch(page);
  await page.goto("");
  await page.getByRole("button", { name: "Connect to Elasticsearch" }).click();
  await page.getByRole("textbox", { name: "Elasticsearch URL" }).fill(DEFAULT_ES_URL);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
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

  test("metrics user connects, picks a metric, and gets a line chart-ready result", async ({
    page,
  }) => {
    await connectToMockCluster(page);
    await page.getByRole("button", { name: "Metrics", exact: true }).click();
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
    await page.getByRole("button", { name: "Traces", exact: true }).click();
    await page.getByRole("button", { name: "Search Traces" }).click();
    await expect(page.getByText("1 traces found")).toBeVisible();
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
    await page.getByRole("button", { name: "Query Lab", exact: true }).click();
    await expect(page).toHaveURL(/\/discover$/);
    // The global header (banner) must show the current page label chip
    const header = page.getByRole("banner");
    await expect(header.getByText("Query Lab")).toBeVisible();
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
    await page.getByRole("button", { name: /Reset/i }).click();
    await expect(page.getByRole("heading", { name: "Elastic Peek" })).toBeVisible();
  });

  test("query lab preserves query text and results after navigating to Console and back", async ({
    page,
  }) => {
    await connectToMockCluster(page);
    // Open Query Lab
    await page.getByRole("button", { name: "Query Lab", exact: true }).click();
    await expect(page).toHaveURL(/\/discover$/);

    // Run the default query — the mock returns @timestamp + message columns
    await page.getByRole("button", { name: "Run" }).click();
    await expect(page.getByText("Run a query to see results")).toBeHidden();
    // Verify results rendered (default mock: columns @timestamp, message, 1 row)
    await expect(page.getByRole("columnheader", { name: "@timestamp" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "message" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Hello World" })).toBeVisible();

    // Navigate away to Console
    await page.getByRole("button", { name: "Console", exact: true }).click();
    await expect(page).toHaveURL(/\/console$/);

    // Navigate back to Query Lab
    await page.getByRole("button", { name: "Query Lab", exact: true }).click();
    await expect(page).toHaveURL(/\/discover$/);

    // Verify query text and results are still present
    await expect(page.getByRole("columnheader", { name: "@timestamp" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "message" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Hello World" })).toBeVisible();
    await expect(page.getByText("Run a query to see results")).toBeHidden();
  });
});
