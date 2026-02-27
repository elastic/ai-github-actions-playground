/**
 * screenshot-feature.mjs
 *
 * Takes a screenshot of a specific feature page after connecting to a mocked
 * Elasticsearch cluster. This is the correct tool to use when you want to
 * capture what the app looks like after the user is authenticated and on a
 * real feature page — NOT the "Connect to Elasticsearch" landing page.
 *
 * Usage:
 *   node scripts/screenshot-feature.mjs \
 *     --url  http://127.0.0.1:3000/ai-github-actions-playground/ \
 *     --page metrics \
 *     --screenshot screenshot-metrics.png
 *
 * Supported --page values:
 *   cluster-overview | data-streams | indices | ingest-pipelines |
 *   query-lab | metrics | traces | console | users | roles |
 *   dashboards | fleet
 *
 * The script mocks all required Elasticsearch endpoints so no live cluster
 * is needed.
 */

import { chromium } from "playwright";
import fs from "node:fs/promises";

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    url: process.env.SCREENSHOT_FEATURE_URL ?? "http://127.0.0.1:3000/ai-github-actions-playground/",
    page: process.env.SCREENSHOT_FEATURE_PAGE ?? "cluster-overview",
    screenshot: process.env.SCREENSHOT_FEATURE_IMAGE ?? "screenshot-feature.png",
    output: process.env.SCREENSHOT_FEATURE_OUTPUT ?? "screenshot-feature.json",
    timeoutMs: 30_000,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--url" && argv[i + 1]) opts.url = argv[++i];
    else if (arg === "--page" && argv[i + 1]) opts.page = argv[++i];
    else if (arg === "--screenshot" && argv[i + 1]) opts.screenshot = argv[++i];
    else if (arg === "--output" && argv[i + 1]) opts.output = argv[++i];
    else if (arg === "--timeout-ms" && argv[i + 1]) opts.timeoutMs = Number(argv[++i]) || 30_000;
  }

  return opts;
}

// ---------------------------------------------------------------------------
// Nav-button mapping
// ---------------------------------------------------------------------------

const PAGE_NAV_BUTTONS = {
  "cluster-overview": "Cluster Overview",
  "data-streams": "Data Streams",
  indices: "Indices",
  "ingest-pipelines": "Ingest Pipelines",
  "query-lab": "Query Lab",
  metrics: "Metrics",
  traces: "Traces",
  console: "Console",
  users: "Users",
  roles: "Roles",
  dashboards: "Dashboards",
  fleet: "Fleet",
};

// ---------------------------------------------------------------------------
// Mock Elasticsearch responses
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "authorization,content-type",
  "content-type": "application/json",
};

const ES_URL = "http://example.com:9200";

async function mockElasticsearch(page) {
  await page.route(`${ES_URL}/**`, async (route) => {
    const req = route.request();
    const method = req.method();
    const url = new URL(req.url());
    const path = url.pathname;

    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS_HEADERS, body: "" });
      return;
    }

    const json = (body) =>
      route.fulfill({ status: 200, headers: CORS_HEADERS, body: JSON.stringify(body) });

    // Cluster
    if (path === "/" && method === "GET")
      return json({
        cluster_name: "screenshot-cluster",
        tagline: "You Know, for Search",
        version: { number: "9.0.0" },
      });
    if (path === "/_cluster/health")
      return json({ status: "green", number_of_nodes: 3, active_primary_shards: 12, active_shards: 24, unassigned_shards: 0 });
    if (path === "/_cluster/stats")
      return json({ indices: { count: 10, docs: { count: 500_000 }, store: { size_in_bytes: 1_073_741_824 } }, nodes: { count: { total: 3 } } });
    if (path === "/_nodes" && method === "GET")
      return json({ nodes: { n1: { name: "node-1", roles: ["master", "data_hot"], version: "9.0.0" } } });
    if (path === "/_nodes/stats")
      return json({ nodes: { n1: { name: "node-1", os: { cpu: { percent: 25 } }, jvm: { mem: { heap_used_percent: 50 } }, fs: { total: { total_in_bytes: 500_000_000_000, available_in_bytes: 300_000_000_000 } }, indices: { docs: { count: 500_000 }, shard_stats: { total_count: 12 } } } } });

    // Security
    if (path === "/_security/user/_has_privileges")
      return json({ cluster: { manage_data_stream: true, read_security: true, manage_security: false } });
    if (path === "/_security/user" && method === "GET")
      return json({ elastic: { username: "elastic", enabled: true, roles: ["superuser"], full_name: "Built-in Superuser" } });
    if (path === "/_security/role" && method === "GET")
      return json({ superuser: { cluster: ["all"], indices: [{ names: ["*"], privileges: ["all"] }] } });

    // Indices / data streams
    if (path === "/_cat/indices")
      return json([{ index: "web-logs-2026.02", health: "green", status: "open", pri: "1", rep: "1", "docs.count": "125000", "docs.deleted": "0", "store.size": "524288000", "pri.store.size": "262144000" }]);
    if (path === "/_data_stream")
      return json({ data_streams: [{ name: "logs-nginx.access-default", timestamp_field: { name: "@timestamp" }, indices: [], generation: 1, status: "GREEN", template: "logs-nginx" }] });
    if (path.startsWith("/_resolve/index/"))
      return json({ indices: [], aliases: [], data_streams: [] });
    if (path.match(/\/_field_caps/))
      return json({ fields: { "@timestamp": { date: { type: "date", searchable: true, aggregatable: true } } } });
    if (path.match(/\/_mapping$/))
      return json({});
    if (path.match(/\/_settings$/))
      return json({});
    if (path.match(/\/_stats$/))
      return json({ _shards: { total: 2, successful: 2, failed: 0 }, _all: { primaries: { docs: { count: 125000, deleted: 0 }, store: { size_in_bytes: 262144000 } }, total: { docs: { count: 125000, deleted: 0 }, store: { size_in_bytes: 524288000 } } } });

    // Ingest pipelines
    if (path === "/_ingest/pipeline")
      return json({ "logs-parse-nginx": { description: "Parse NGINX access logs", processors: [] } });

    // ES|QL
    if (path === "/_query" && method === "POST") {
      const body = req.postDataJSON();
      const query = body?.query ?? "";
      if (query.includes("LIMIT 0"))
        return json({ columns: [{ name: "@timestamp", type: "date" }, { name: "system.cpu.total.norm.pct", type: "double" }, { name: "host.name", type: "keyword" }], values: [] });
      if (query.includes("FROM metrics-*"))
        return json({ columns: [{ name: "timestamp", type: "date" }, { name: "metric", type: "double" }], values: [["2026-02-26T10:00:00.000Z", 0.12], ["2026-02-26T10:05:00.000Z", 0.32], ["2026-02-26T10:10:00.000Z", 0.24]] });
      return json({ columns: [{ name: "@timestamp", type: "date" }, { name: "message", type: "text" }], values: [["2026-02-26T10:00:00.000Z", "Hello World"]] });
    }

    // Fleet
    if (path.startsWith("/_fleet/"))
      return json({});

    return json({});
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  const navButton = PAGE_NAV_BUTTONS[opts.page];

  if (!navButton) {
    console.error(`Unknown --page "${opts.page}". Valid values: ${Object.keys(PAGE_NAV_BUTTONS).join(", ")}`);
    process.exit(1);
  }

  const diagnostics = {
    url: opts.url,
    page: opts.page,
    consoleErrors: [],
    pageErrors: [],
    capturedAt: new Date().toISOString(),
  };

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    page.on("console", (msg) => {
      if (msg.type() === "error") diagnostics.consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));

    try {
      // Set up mocks before navigating
      await mockElasticsearch(page);

      // Load the app
      await page.goto(opts.url, { waitUntil: "networkidle", timeout: opts.timeoutMs });

      // Connect to the mocked cluster
      await page.getByRole("button", { name: "Connect to Elasticsearch" }).click();
      await page.getByRole("textbox", { name: "Elasticsearch URL" }).fill(ES_URL);
      await page.getByRole("button", { name: "Connect", exact: true }).click();

      // Wait for the app to be ready (sidebar visible)
      await page.getByRole("button", { name: "Metrics", exact: true }).waitFor({ timeout: opts.timeoutMs });

      // Navigate to the requested feature page
      await page.getByRole("button", { name: navButton, exact: true }).click();
      await page.waitForTimeout(1500);

      // Take the screenshot
      await page.screenshot({ path: opts.screenshot, fullPage: true });
      console.log(`Screenshot saved: ${opts.screenshot}`);
    } catch (error) {
      diagnostics.pageErrors.push(String(error));
      console.error("Error during screenshot capture:", error);
    } finally {
      await browser.close();
    }
  } catch (error) {
    diagnostics.pageErrors.push(String(error));
  }

  await fs.writeFile(opts.output, JSON.stringify(diagnostics, null, 2));

  const hasErrors = diagnostics.consoleErrors.length > 0 || diagnostics.pageErrors.length > 0;
  if (hasErrors) {
    console.error("Screenshot capture failed. See diagnostics:", opts.output);
    process.exit(1);
  }

  console.log("Feature screenshot captured successfully.");
}

run().catch((error) => {
  console.error("screenshot-feature crashed:", error);
  process.exit(1);
});
