/**
 * smoke-live-es.spec.ts
 *
 * Playwright tests that connect to a REAL Elasticsearch instance through the
 * Vite proxy and verify that seeded + replayed data renders correctly on
 * every major page.
 *
 * Data comes from two sources:
 *   1. OTLP replay (otel-replay.mjs) → traces, metrics, logs via EDOT collector
 *   2. Seed script (seed-elasticsearch.mjs) → web_logs, orders, ingest pipelines
 *
 * Prerequisites:
 *   - ES running at ES_URL (default http://localhost:9200)
 *   - OTLP data replayed via otel-replay.mjs (or live OTel stack)
 *   - Non-OTLP data seeded via seed-elasticsearch.mjs
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

const ES_PROXY_URL = process.env.ES_PROXY_URL ?? "http://localhost:3000/_es";

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
    await page.waitForLoadState("networkidle");
    // Cluster health should be visible (green or yellow)
    await expect(page.getByText(/green|yellow/i).first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({
      path: "test-results/live-es-cluster-overview.png",
      fullPage: true,
    });
    await dumpDOM(page, "Cluster Overview", "live-es");
    const muiErrors = await checkForMuiErrors(page);
    logDiagnostics("Cluster Overview", consoleLogs, muiErrors, -1);
  });

  test("Indices shows seeded indices", async ({ page }) => {
    const consoleLogs = collectConsoleLogs(page);
    await connectToLiveCluster(page);
    await page.getByRole("button", { name: "Indices", exact: true }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("web_logs")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("orders")).toBeVisible({ timeout: 10_000 });
    await page.screenshot({
      path: "test-results/live-es-indices.png",
      fullPage: true,
    });
    await dumpDOM(page, "Indices", "live-es");
    const muiErrors = await checkForMuiErrors(page);
    logDiagnostics("Indices", consoleLogs, muiErrors, -1);
  });

  test("Query Lab editor loads against live cluster", async ({ page }) => {
    const consoleLogs = collectConsoleLogs(page);
    await connectToLiveCluster(page);
    await page.getByRole("button", { name: "Query Lab", exact: true }).click();
    await page.waitForLoadState("networkidle");
    // The Query Lab editor should be visible and ready
    await expect(page.getByRole("button", { name: /run/i })).toBeVisible({ timeout: 10_000 });
    await page.screenshot({
      path: "test-results/live-es-query-lab.png",
      fullPage: true,
    });
    await dumpDOM(page, "Query Lab", "live-es");
    const muiErrors = await checkForMuiErrors(page);
    logDiagnostics("Query Lab", consoleLogs, muiErrors, -1);
  });

  test("Metrics page discovers OTel metric fields", async ({ page }) => {
    const consoleLogs = collectConsoleLogs(page);
    await connectToLiveCluster(page);
    await page.getByRole("button", { name: "Metrics", exact: true }).click();
    await page.waitForLoadState("networkidle");
    // Search for system.cpu — OTel hostmetrics data should have these fields
    const metricSearch = page.getByLabel("Search metrics");
    await expect(metricSearch).toBeVisible({ timeout: 5_000 });
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
    logDiagnostics("Metrics", consoleLogs, muiErrors, -1);
  });

  test("Traces page finds OTel traces", async ({ page }) => {
    const consoleLogs = collectConsoleLogs(page);
    await connectToLiveCluster(page);
    await page.getByRole("button", { name: "Traces", exact: true }).click();
    await page.getByRole("button", { name: "Search Traces" }).click();
    // Should find traces from OTel replay data
    await expect(page.getByText(/\d+ traces? found/i)).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: "test-results/live-es-traces.png",
      fullPage: true,
    });
    await dumpDOM(page, "Traces", "live-es");
    const muiErrors = await checkForMuiErrors(page);
    logDiagnostics("Traces", consoleLogs, muiErrors, -1);
  });

  test("Data Streams shows OTel data streams", async ({ page }) => {
    const consoleLogs = collectConsoleLogs(page);
    await connectToLiveCluster(page);
    await page.getByRole("button", { name: "Data Streams", exact: true }).click();
    await page.waitForLoadState("networkidle");
    // OTel replay creates traces-generic.otel-default and metrics-hostmetricsreceiver.otel-default
    await expect(page.getByText("traces-generic.otel-default")).toBeVisible({ timeout: 10_000 });
    await page.screenshot({
      path: "test-results/live-es-data-streams.png",
      fullPage: true,
    });
    await dumpDOM(page, "Data Streams", "live-es");
    const muiErrors = await checkForMuiErrors(page);
    logDiagnostics("Data Streams", consoleLogs, muiErrors, -1);
  });

  test("Ingest Pipelines shows seeded pipelines", async ({ page }) => {
    const consoleLogs = collectConsoleLogs(page);
    await connectToLiveCluster(page);
    await page.getByRole("button", { name: "Ingest Pipelines", exact: true }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("logs-parse-nginx")).toBeVisible({ timeout: 10_000 });
    await page.screenshot({
      path: "test-results/live-es-ingest-pipelines.png",
      fullPage: true,
    });
    await dumpDOM(page, "Ingest Pipelines", "live-es");
    const muiErrors = await checkForMuiErrors(page);
    logDiagnostics("Ingest Pipelines", consoleLogs, muiErrors, -1);
  });
});
