/**
 * seed-elasticsearch.mjs
 *
 * Seeds a real Elasticsearch instance with non-OTLP data that the app needs:
 *   - web_logs index (Query Lab, Indices page)
 *   - orders index (Query Lab)
 *   - Ingest pipelines (Ingest Pipelines page)
 *
 * OTLP data (traces, metrics, logs) is handled separately by otel-replay.mjs,
 * which replays captured fixture data through the EDOT collector.
 *
 * Usage:
 *   node scripts/seed-elasticsearch.mjs
 *   node scripts/seed-elasticsearch.mjs --url http://localhost:9200
 *   node scripts/seed-elasticsearch.mjs --url http://localhost:9200 --wait-for-ready
 */

import { Client } from "@elastic/elasticsearch";

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    url: process.env.ES_URL ?? "http://localhost:9200",
    waitForReady: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--url" && argv[i + 1]) opts.url = argv[++i];
    else if (arg === "--wait-for-ready") opts.waitForReady = true;
  }

  return opts;
}

// ---------------------------------------------------------------------------
// Wait for ES to become healthy
// ---------------------------------------------------------------------------

async function waitForReady(client, maxWaitMs = 120_000) {
  const start = Date.now();
  const intervalMs = 2_000;

  while (Date.now() - start < maxWaitMs) {
    try {
      const info = await client.info();
      if (info.tagline) {
        console.log(`  Elasticsearch ${info.version.number} is ready.`);
        return;
      }
    } catch {
      // Not ready yet — ES may still be starting
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`Elasticsearch did not become ready within ${maxWaitMs / 1000}s`);
}

// ---------------------------------------------------------------------------
// Seed: web_logs (Query Lab, Indices)
// ---------------------------------------------------------------------------

async function seedWebLogs(client) {
  const now = Date.now();
  const docs = [];

  const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
  const paths = [
    "/index.html", "/style.css", "/api/login", "/api/users",
    "/api/checkout", "/api/products", "/api/orders", "/health",
    "/missing", "/api/search", "/favicon.ico", "/api/settings",
  ];
  const statuses = [200, 200, 200, 200, 201, 301, 403, 404, 500];
  const hosts = ["web-1", "web-2", "web-3"];

  for (let i = 0; i < 25; i++) {
    docs.push({
      "@timestamp": new Date(now - i * 3 * 60_000).toISOString(),
      method: methods[i % methods.length],
      path: paths[i % paths.length],
      status: statuses[i % statuses.length],
      bytes: Math.floor(Math.random() * 4096) + 64,
      host: hosts[i % hosts.length],
    });
  }

  await client.indices.delete({ index: "web_logs" }).catch((e) => {
    if (e.meta?.statusCode !== 404) console.warn(`  Warning: could not delete web_logs: ${e.message}`);
  });

  await client.indices.create({
    index: "web_logs",
    mappings: {
      properties: {
        "@timestamp": { type: "date" },
        method: { type: "keyword" },
        path: { type: "keyword" },
        status: { type: "integer" },
        bytes: { type: "long" },
        host: { type: "keyword" },
      },
    },
  });

  const operations = docs.flatMap((doc) => [{ index: { _index: "web_logs" } }, doc]);
  await client.bulk({ operations, refresh: "wait_for" });
  console.log(`  web_logs: ${docs.length} docs`);
}

// ---------------------------------------------------------------------------
// Seed: orders (Query Lab)
// ---------------------------------------------------------------------------

async function seedOrders(client) {
  const now = Date.now();
  const docs = [
    { order_id: "ORD-001", category: "electronics", amount: 299.99, quantity: 1, region: "us-east" },
    { order_id: "ORD-002", category: "electronics", amount: 149.99, quantity: 2, region: "us-west" },
    { order_id: "ORD-003", category: "clothing", amount: 49.99, quantity: 3, region: "us-east" },
    { order_id: "ORD-004", category: "clothing", amount: 79.99, quantity: 1, region: "eu-west" },
    { order_id: "ORD-005", category: "books", amount: 19.99, quantity: 5, region: "us-east" },
    { order_id: "ORD-006", category: "books", amount: 29.99, quantity: 2, region: "us-west" },
    { order_id: "ORD-007", category: "electronics", amount: 999.99, quantity: 1, region: "eu-west" },
    { order_id: "ORD-008", category: "clothing", amount: 39.99, quantity: 4, region: "us-west" },
  ].map((doc, i) => ({ "@timestamp": new Date(now - i * 10 * 60_000).toISOString(), ...doc }));

  await client.indices.delete({ index: "orders" }).catch((e) => {
    if (e.meta?.statusCode !== 404) console.warn(`  Warning: could not delete orders: ${e.message}`);
  });

  await client.indices.create({
    index: "orders",
    mappings: {
      properties: {
        "@timestamp": { type: "date" },
        order_id: { type: "keyword" },
        category: { type: "keyword" },
        amount: { type: "double" },
        quantity: { type: "integer" },
        region: { type: "keyword" },
      },
    },
  });

  const operations = docs.flatMap((doc) => [{ index: { _index: "orders" } }, doc]);
  await client.bulk({ operations, refresh: "wait_for" });
  console.log(`  orders: ${docs.length} docs`);
}

// ---------------------------------------------------------------------------
// Seed: security event logs (Investigate page)
// ---------------------------------------------------------------------------

async function seedSecurityLogs(client) {
  const now = Date.now();
  const users = ["elastic", "alice", "bob"];
  const hosts = ["web-01", "web-02", "db-01"];
  const categories = ["authentication", "session", "process"];
  const actions = ["logon", "logout", "exec", "ssh_login", "failed_login"];
  const outcomes = ["success", "success", "success", "failure"];
  const ips = ["10.0.0.1", "10.0.0.2", "192.168.1.10", "172.16.0.5"];
  const docs = [];

  for (let i = 0; i < 30; i++) {
    docs.push({
      "@timestamp": new Date(now - i * 5 * 60_000).toISOString(),
      "user.name": users[i % users.length],
      "host.name": hosts[i % hosts.length],
      "event.category": categories[i % categories.length],
      "event.action": actions[i % actions.length],
      "event.outcome": outcomes[i % outcomes.length],
      "source.ip": ips[i % ips.length],
      message: `Security event ${i + 1}: ${actions[i % actions.length]} by ${users[i % users.length]} on ${hosts[i % hosts.length]}`,
    });
  }

  await client.indices.delete({ index: "logs-security" }).catch((e) => {
    if (e.meta?.statusCode !== 404)
      console.warn(`  Warning: could not delete logs-security: ${e.message}`);
  });

  await client.indices.create({
    index: "logs-security",
    mappings: {
      properties: {
        "@timestamp": { type: "date" },
        "user.name": { type: "keyword" },
        "host.name": { type: "keyword" },
        "event.category": { type: "keyword" },
        "event.action": { type: "keyword" },
        "event.outcome": { type: "keyword" },
        "source.ip": { type: "ip" },
        message: { type: "text" },
      },
    },
  });

  const operations = docs.flatMap((doc) => [{ index: { _index: "logs-security" } }, doc]);
  await client.bulk({ operations, refresh: "wait_for" });
  console.log(`  logs-security: ${docs.length} docs`);
}

// ---------------------------------------------------------------------------
// Seed: ingest pipelines (Ingest Pipelines page)
// ---------------------------------------------------------------------------

async function seedIngestPipelines(client) {
  await client.ingest.putPipeline({
    id: "logs-parse-nginx",
    description: "Parse NGINX access logs into structured fields",
    version: 3,
    processors: [
      { grok: { field: "message", patterns: ["%{COMBINEDAPACHELOG}"] } },
      { date: { field: "timestamp", formats: ["dd/MMM/yyyy:HH:mm:ss Z"] } },
      { remove: { field: "message" } },
    ],
  });

  await client.ingest.putPipeline({
    id: "enrich-geoip",
    description: "Add GeoIP data from source.ip",
    processors: [
      { geoip: { field: "source.ip", ignore_missing: true } },
    ],
  });

  await client.ingest.putPipeline({
    id: "metrics-normalize",
    description: "Normalize metric fields and set event.kind",
    processors: [
      { set: { field: "event.kind", value: "metric" } },
    ],
  });

  console.log("  ingest pipelines: 3 pipelines (logs-parse-nginx, enrich-geoip, metrics-normalize)");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  console.log(`Seeding Elasticsearch at ${opts.url}...`);

  const client = new Client({ node: opts.url });

  if (opts.waitForReady) {
    console.log("  Waiting for Elasticsearch to be ready...");
    await waitForReady(client);
  }

  await Promise.all([seedWebLogs(client), seedOrders(client), seedSecurityLogs(client)]);
  await seedIngestPipelines(client);

  console.log("\nSeeding complete.");
}

run().catch((error) => {
  console.error("Seeding failed:", error.message ?? error);
  process.exit(1);
});
