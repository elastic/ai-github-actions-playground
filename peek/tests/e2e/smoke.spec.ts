import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const ELASTICSEARCH_URL = "http://example.com:9200";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "authorization,content-type",
  "content-type": "application/json",
};

async function mockElasticsearch(page: Page) {
  await page.route(`${ELASTICSEARCH_URL}/**`, async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());

    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS_HEADERS, body: "" });
      return;
    }

    if (url.pathname === "/" && method === "GET") {
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          cluster_name: "playwright-smoke-cluster",
          tagline: "You Know, for Search",
        }),
      });
      return;
    }

    if (url.pathname === "/_security/user/_has_privileges" && method === "POST") {
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          cluster: {
            manage_data_stream: true,
            read_security: true,
            manage_security: false,
          },
        }),
      });
      return;
    }

    if (url.pathname === "/_query" && method === "POST") {
      const body = request.postDataJSON() as { query?: string } | null;
      const query = body?.query ?? "";

      if (query.includes("FROM metrics-* | LIMIT 0")) {
        await route.fulfill({
          status: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            columns: [
              { name: "@timestamp", type: "date" },
              { name: "system.cpu.total.norm.pct", type: "double" },
              { name: "host.name", type: "keyword" },
            ],
            values: [],
          }),
        });
        return;
      }

      if (query.includes("FROM metrics-*")) {
        await route.fulfill({
          status: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            columns: [
              { name: "timestamp", type: "date" },
              { name: "metric", type: "double" },
            ],
            values: [
              ["2026-02-23T10:00:00.000Z", 0.12],
              ["2026-02-23T10:05:00.000Z", 0.32],
              ["2026-02-23T10:10:00.000Z", 0.24],
            ],
          }),
        });
        return;
      }

      if (query.includes('trace.id == "trace-123"')) {
        await route.fulfill({
          status: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({
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
          }),
        });
        return;
      }

      if (query.includes("STATS request_count = COUNT(*)")) {
        await route.fulfill({
          status: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({
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
          }),
        });
        return;
      }

      if (query.includes("FROM traces-*")) {
        await route.fulfill({
          status: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({
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
          }),
        });
        return;
      }
    }

    await route.fulfill({
      status: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: { reason: `Unhandled mock route: ${method} ${url.pathname}` },
      }),
    });
  });
}

async function connectToMockCluster(page: Page) {
  await mockElasticsearch(page);
  await page.goto("");
  await page.getByRole("button", { name: "Connect to Elasticsearch" }).click();
  await page.getByRole("textbox", { name: "Elasticsearch URL" }).fill(ELASTICSEARCH_URL);
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
    await page.getByRole("textbox", { name: "Elasticsearch URL" }).fill(ELASTICSEARCH_URL);
    await expect(connectBtn).toBeEnabled();
    await page.getByRole("button", { name: "Cancel" }).click();

    await connectToMockCluster(page);
    await page.getByRole("button", { name: /Reset/i }).click();
    await expect(page.getByRole("heading", { name: "Elastic Peek" })).toBeVisible();
  });
});
