/**
 * seed-elasticsearch.mjs
 *
 * Seeds a real Elasticsearch 9.0.0 instance with data covering all major
 * app pages: web_logs, orders, metrics data stream, traces data stream,
 * and ingest pipelines.
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
      // Not ready yet
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

  await client.indices.delete({ index: "web_logs" }).catch(() => {});

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
  const docs = [
    { order_id: "ORD-001", category: "electronics", amount: 299.99, quantity: 1, region: "us-east" },
    { order_id: "ORD-002", category: "electronics", amount: 149.99, quantity: 2, region: "us-west" },
    { order_id: "ORD-003", category: "clothing", amount: 49.99, quantity: 3, region: "us-east" },
    { order_id: "ORD-004", category: "clothing", amount: 79.99, quantity: 1, region: "eu-west" },
    { order_id: "ORD-005", category: "books", amount: 19.99, quantity: 5, region: "us-east" },
    { order_id: "ORD-006", category: "books", amount: 29.99, quantity: 2, region: "us-west" },
    { order_id: "ORD-007", category: "electronics", amount: 999.99, quantity: 1, region: "eu-west" },
    { order_id: "ORD-008", category: "clothing", amount: 39.99, quantity: 4, region: "us-west" },
  ];

  await client.indices.delete({ index: "orders" }).catch(() => {});

  await client.indices.create({
    index: "orders",
    mappings: {
      properties: {
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
// Seed: metrics-system.cpu-default data stream (Metrics, Data Streams)
// ---------------------------------------------------------------------------

async function seedMetrics(client) {
  // Create index template for metrics-* data streams
  await client.indices.putIndexTemplate({
    name: "seed-metrics",
    index_patterns: ["metrics-system.cpu-default"],
    data_stream: {},
    priority: 500,
    template: {
      mappings: {
        properties: {
          "@timestamp": { type: "date" },
          "system.cpu.total.norm.pct": { type: "scaled_float", scaling_factor: 1000 },
          "system.memory.used.pct": { type: "scaled_float", scaling_factor: 1000 },
          "host.name": { type: "keyword" },
          "data_stream.dataset": { type: "keyword" },
          "data_stream.namespace": { type: "keyword" },
          "data_stream.type": { type: "keyword" },
        },
      },
    },
  });

  // Delete existing data stream if any
  await client.indices.deleteDataStream({ name: "metrics-system.cpu-default" }).catch(() => {});

  const now = Date.now();
  const hosts = ["host-01", "host-02", "host-03"];
  const docs = [];

  for (let i = 0; i < 60; i++) {
    const host = hosts[i % hosts.length];
    docs.push({
      "@timestamp": new Date(now - i * 60_000).toISOString(),
      "system.cpu.total.norm.pct": Math.random() * 0.8 + 0.1,
      "system.memory.used.pct": Math.random() * 0.5 + 0.3,
      "host.name": host,
      "data_stream.dataset": "system.cpu",
      "data_stream.namespace": "default",
      "data_stream.type": "metrics",
    });
  }

  const operations = docs.flatMap((doc) => [
    { create: { _index: "metrics-system.cpu-default" } },
    doc,
  ]);
  await client.bulk({ operations, refresh: "wait_for" });
  console.log(`  metrics-system.cpu-default: ${docs.length} docs`);
}

// ---------------------------------------------------------------------------
// Seed: traces-apm-default data stream (Traces)
// ---------------------------------------------------------------------------

async function seedTraces(client) {
  // Create index template for traces-* data streams
  await client.indices.putIndexTemplate({
    name: "seed-traces",
    index_patterns: ["traces-apm-default"],
    data_stream: {},
    priority: 500,
    template: {
      mappings: {
        properties: {
          "@timestamp": { type: "date" },
          "trace.id": { type: "keyword" },
          "span.id": { type: "keyword" },
          "parent.id": { type: "keyword" },
          "service.name": { type: "keyword" },
          name: { type: "keyword" },
          kind: { type: "keyword" },
          duration: { type: "long" },
          "attributes.span.duration.us": { type: "long" },
          status: { type: "keyword" },
        },
      },
    },
  });

  // Delete existing data stream if any
  await client.indices.deleteDataStream({ name: "traces-apm-default" }).catch(() => {});

  const now = Date.now();
  const docs = [];

  // Generate 4 complete trace trees
  const traces = [
    {
      traceId: "aaa111aaa111aaa111aaa111aaa111aa",
      rootService: "frontend-web",
      rootName: "GET /api/products",
      spans: [
        { service: "api-gateway", name: "gateway.forward", kind: "INTERNAL", durationUs: 45_000 },
        { service: "auth-service", name: "POST /auth/verify", kind: "SERVER", durationUs: 12_000 },
        { service: "catalog-service", name: "GET /catalog/products", kind: "SERVER", durationUs: 28_000 },
        { service: "postgres", name: "SELECT products", kind: "CLIENT", durationUs: 5_000 },
      ],
    },
    {
      traceId: "bbb222bbb222bbb222bbb222bbb222bb",
      rootService: "frontend-web",
      rootName: "POST /api/checkout",
      spans: [
        { service: "api-gateway", name: "gateway.forward", kind: "INTERNAL", durationUs: 120_000 },
        { service: "order-service", name: "POST /orders", kind: "SERVER", durationUs: 95_000 },
        { service: "payment-service", name: "POST /payments/charge", kind: "SERVER", durationUs: 80_000 },
        { service: "postgres", name: "INSERT orders", kind: "CLIENT", durationUs: 8_000 },
        { service: "postgres", name: "UPDATE inventory", kind: "CLIENT", durationUs: 6_000 },
      ],
    },
    {
      traceId: "ccc333ccc333ccc333ccc333ccc333cc",
      rootService: "frontend-web",
      rootName: "GET /api/users/me",
      spans: [
        { service: "api-gateway", name: "gateway.forward", kind: "INTERNAL", durationUs: 20_000 },
        { service: "auth-service", name: "POST /auth/verify", kind: "SERVER", durationUs: 10_000 },
        { service: "auth-service", name: "GET /users/profile", kind: "SERVER", durationUs: 15_000 },
        { service: "postgres", name: "SELECT users", kind: "CLIENT", durationUs: 4_000 },
      ],
    },
    {
      traceId: "ddd444ddd444ddd444ddd444ddd444dd",
      rootService: "frontend-web",
      rootName: "GET /health",
      spans: [
        { service: "api-gateway", name: "gateway.health", kind: "INTERNAL", durationUs: 3_000 },
        { service: "redis", name: "GET health:cache", kind: "CLIENT", durationUs: 1_000 },
      ],
    },
  ];

  let spanCounter = 0;

  for (let t = 0; t < traces.length; t++) {
    const trace = traces[t];
    const traceTime = now - (t + 1) * 10 * 60_000; // stagger traces 10 min apart
    const totalDurationUs = trace.spans.reduce((sum, s) => sum + s.durationUs, 0) + 50_000;

    // Root span (parent.id is null)
    const rootSpanId = `root${String(spanCounter++).padStart(24, "0")}`;
    docs.push({
      "@timestamp": new Date(traceTime).toISOString(),
      "trace.id": trace.traceId,
      "span.id": rootSpanId,
      "parent.id": null,
      "service.name": trace.rootService,
      name: trace.rootName,
      kind: "SERVER",
      duration: totalDurationUs * 1000, // ns
      "attributes.span.duration.us": totalDurationUs,
      status: "OK",
    });

    // Child spans
    let parentId = rootSpanId;
    for (let s = 0; s < trace.spans.length; s++) {
      const span = trace.spans[s];
      const spanId = `span${String(spanCounter++).padStart(24, "0")}`;
      docs.push({
        "@timestamp": new Date(traceTime + (s + 1) * 100).toISOString(),
        "trace.id": trace.traceId,
        "span.id": spanId,
        "parent.id": parentId,
        "service.name": span.service,
        name: span.name,
        kind: span.kind,
        duration: span.durationUs * 1000,
        "attributes.span.duration.us": span.durationUs,
        status: "OK",
      });
      // Chain the first few spans, then branch from root
      if (s < 2) parentId = spanId;
      else parentId = rootSpanId;
    }
  }

  const operations = docs.flatMap((doc) => [
    { create: { _index: "traces-apm-default" } },
    doc,
  ]);
  await client.bulk({ operations, refresh: "wait_for" });
  console.log(`  traces-apm-default: ${docs.length} docs (${traces.length} traces)`);
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

  // Seed regular indices (independent, can run in parallel)
  await Promise.all([seedWebLogs(client), seedOrders(client)]);

  // Seed data streams (need templates created first, run sequentially)
  await seedMetrics(client);
  await seedTraces(client);

  // Seed ingest pipelines
  await seedIngestPipelines(client);

  console.log("\nSeeding complete.");
}

run().catch((error) => {
  console.error("Seeding failed:", error.message ?? error);
  process.exit(1);
});
