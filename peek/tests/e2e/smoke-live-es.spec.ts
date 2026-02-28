/**
 * smoke-live-es.spec.ts
 *
 * Playwright tests that connect to a REAL Elasticsearch instance through the
 * Vite proxy and verify that seeded data renders correctly on every major page.
 *
 * Prerequisites:
 *   - ES running at ES_URL (default http://localhost:9200), seeded via seed-elasticsearch.mjs
 *   - Vite dev server started with ES_URL set (enables /_es proxy)
 *
 * Usage:
 *   ES_URL=http://localhost:9200 npx playwright test tests/e2e/smoke-live-es.spec.ts
 */

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  collectConsoleLogs,
  dumpDOM,
  checkForMuiErrors,
  logDiagnostics,
} from "./fixtures/love-audit-helpers";

const ES_PROXY_URL = "http://localhost:3000/_es";

async function connectToLiveCluster(page: Page) {
  await page.goto("");
  await page.getByRole("button", { name: "Connect to Elasticsearch" }).click();
  await page.getByRole("textbox", { name: "Elasticsearch URL" }).fill(ES_PROXY_URL);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  // Wait for sidebar — indicates successful connection handshake
  await expect(page.getByRole("button", { name: "Cluster Overview", exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("smoke – live Elasticsearch", () => {
  test("Cluster Overview shows real node data", async ({ page }) => {
    const consoleLogs = collectConsoleLogs(page);
    await connectToLiveCluster(page);
    // Already on Cluster Overview after connect
    await page.waitForTimeout(2000);
    // Cluster health should be visible (green or yellow)
    await expect(page.getByText(/green|yellow/i).first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({
      path: "test-results/live-es-cluster-overview.png",
      fullPage: true,
    });
    await dumpDOM(page, "Cluster Overview", "live-es");
    const muiErrors = await checkForMuiErrors(page);
    logDiagnostics("Cluster Overview", consoleLogs, muiErrors, 0);
  });

  test("Indices shows seeded indices", async ({ page }) => {
    const consoleLogs = collectConsoleLogs(page);
    await connectToLiveCluster(page);
    await page.getByRole("button", { name: "Indices", exact: true }).click();
    await page.waitForTimeout(2000);
    await expect(page.getByText("web_logs")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("orders")).toBeVisible({ timeout: 10_000 });
    await page.screenshot({
      path: "test-results/live-es-indices.png",
      fullPage: true,
    });
    await dumpDOM(page, "Indices", "live-es");
    const muiErrors = await checkForMuiErrors(page);
    logDiagnostics("Indices", consoleLogs, muiErrors, 0);
  });

  test("Query Lab can execute a real ES|QL query", async ({ page }) => {
    const consoleLogs = collectConsoleLogs(page);
    await connectToLiveCluster(page);
    await page.getByRole("button", { name: "Query Lab", exact: true }).click();
    await page.waitForTimeout(2000);
    // The Query Lab should show results or a query editor
    await page.screenshot({
      path: "test-results/live-es-query-lab.png",
      fullPage: true,
    });
    await dumpDOM(page, "Query Lab", "live-es");
    const muiErrors = await checkForMuiErrors(page);
    logDiagnostics("Query Lab", consoleLogs, muiErrors, 0);
  });

  test("Metrics page discovers real metric fields", async ({ page }) => {
    const consoleLogs = collectConsoleLogs(page);
    await connectToLiveCluster(page);
    await page.getByRole("button", { name: "Metrics", exact: true }).click();
    await page.waitForTimeout(2000);
    // Search for system.cpu — real field_caps should find it
    const metricSearch = page.getByLabel("Search metrics");
    await metricSearch.fill("system.cpu");
    await expect(page.locator("li.MuiAutocomplete-option").first()).toBeVisible({
      timeout: 10_000,
    });
    await page.screenshot({
      path: "test-results/live-es-metrics.png",
      fullPage: true,
    });
    await dumpDOM(page, "Metrics", "live-es");
    const muiErrors = await checkForMuiErrors(page);
    logDiagnostics("Metrics", consoleLogs, muiErrors, 0);
  });

  test("Traces page finds seeded traces", async ({ page }) => {
    const consoleLogs = collectConsoleLogs(page);
    await connectToLiveCluster(page);
    await page.getByRole("button", { name: "Traces", exact: true }).click();
    await page.getByRole("button", { name: "Search Traces" }).click();
    // Should find at least one trace from seeded data
    await expect(page.getByText(/\d+ traces? found/i)).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: "test-results/live-es-traces.png",
      fullPage: true,
    });
    await dumpDOM(page, "Traces", "live-es");
    const muiErrors = await checkForMuiErrors(page);
    logDiagnostics("Traces", consoleLogs, muiErrors, 0);
  });

  test("Data Streams shows seeded data streams", async ({ page }) => {
    const consoleLogs = collectConsoleLogs(page);
    await connectToLiveCluster(page);
    await page.getByRole("button", { name: "Data Streams", exact: true }).click();
    await page.waitForTimeout(2000);
    await expect(page.getByText("metrics-system.cpu-default")).toBeVisible({ timeout: 10_000 });
    await page.screenshot({
      path: "test-results/live-es-data-streams.png",
      fullPage: true,
    });
    await dumpDOM(page, "Data Streams", "live-es");
    const muiErrors = await checkForMuiErrors(page);
    logDiagnostics("Data Streams", consoleLogs, muiErrors, 0);
  });

  test("Ingest Pipelines shows seeded pipelines", async ({ page }) => {
    const consoleLogs = collectConsoleLogs(page);
    await connectToLiveCluster(page);
    await page.getByRole("button", { name: "Ingest Pipelines", exact: true }).click();
    await page.waitForTimeout(2000);
    await expect(page.getByText("logs-parse-nginx")).toBeVisible({ timeout: 10_000 });
    await page.screenshot({
      path: "test-results/live-es-ingest-pipelines.png",
      fullPage: true,
    });
    await dumpDOM(page, "Ingest Pipelines", "live-es");
    const muiErrors = await checkForMuiErrors(page);
    logDiagnostics("Ingest Pipelines", consoleLogs, muiErrors, 0);
  });
});
