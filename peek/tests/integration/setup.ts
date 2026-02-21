import { ElasticsearchContainer, type StartedElasticsearchContainer } from "@testcontainers/elasticsearch";
import { Client } from "@elastic/elasticsearch";

const ES_IMAGE = "docker.elastic.co/elasticsearch/elasticsearch:8.17.0";

export interface TestContext {
  container: StartedElasticsearchContainer;
  esClient: Client;
  baseUrl: string;
}

/**
 * Start an Elasticsearch container with security disabled so our
 * browser-style fetch client (no TLS, no auth) works against it.
 */
export async function startElasticsearch(): Promise<TestContext> {
  const container = await new ElasticsearchContainer(ES_IMAGE)
    .withEnvironment({
      "xpack.security.enabled": "false",
      "discovery.type": "single-node",
    })
    .start();

  const baseUrl = container.getHttpUrl();

  const esClient = new Client({ node: baseUrl });

  return { container, esClient, baseUrl };
}

/**
 * Seed a "web_logs" index with sample HTTP access log entries.
 */
export async function seedWebLogs(client: Client): Promise<void> {
  const now = Date.now();
  const docs = [
    { "@timestamp": new Date(now - 5 * 60_000).toISOString(), method: "GET",  path: "/index.html",   status: 200, bytes: 1024,  host: "web-1" },
    { "@timestamp": new Date(now - 4 * 60_000).toISOString(), method: "GET",  path: "/style.css",    status: 200, bytes: 512,   host: "web-1" },
    { "@timestamp": new Date(now - 3 * 60_000).toISOString(), method: "POST", path: "/api/login",    status: 200, bytes: 256,   host: "web-2" },
    { "@timestamp": new Date(now - 2 * 60_000).toISOString(), method: "GET",  path: "/api/users",    status: 403, bytes: 128,   host: "web-2" },
    { "@timestamp": new Date(now - 1 * 60_000).toISOString(), method: "GET",  path: "/missing",      status: 404, bytes: 64,    host: "web-1" },
    { "@timestamp": new Date(now).toISOString(),               method: "POST", path: "/api/checkout", status: 500, bytes: 32,    host: "web-3" },
  ];

  await client.indices.create({
    index: "web_logs",
    mappings: {
      properties: {
        "@timestamp": { type: "date" },
        method:       { type: "keyword" },
        path:         { type: "keyword" },
        status:       { type: "integer" },
        bytes:        { type: "long" },
        host:         { type: "keyword" },
      },
    },
  });

  const operations = docs.flatMap((doc) => [
    { index: { _index: "web_logs" } },
    doc,
  ]);

  await client.bulk({ operations, refresh: "wait_for" });
}

/**
 * Seed an "orders" index with sample e-commerce order data.
 */
export async function seedOrders(client: Client): Promise<void> {
  const docs = [
    { order_id: "ORD-001", category: "electronics", amount: 299.99, quantity: 1, region: "us-east" },
    { order_id: "ORD-002", category: "electronics", amount: 149.99, quantity: 2, region: "us-west" },
    { order_id: "ORD-003", category: "clothing",    amount: 49.99,  quantity: 3, region: "us-east" },
    { order_id: "ORD-004", category: "clothing",    amount: 79.99,  quantity: 1, region: "eu-west" },
    { order_id: "ORD-005", category: "books",       amount: 19.99,  quantity: 5, region: "us-east" },
    { order_id: "ORD-006", category: "books",       amount: 29.99,  quantity: 2, region: "us-west" },
    { order_id: "ORD-007", category: "electronics", amount: 999.99, quantity: 1, region: "eu-west" },
    { order_id: "ORD-008", category: "clothing",    amount: 39.99,  quantity: 4, region: "us-west" },
  ];

  await client.indices.create({
    index: "orders",
    mappings: {
      properties: {
        order_id: { type: "keyword" },
        category: { type: "keyword" },
        amount:   { type: "double" },
        quantity: { type: "integer" },
        region:   { type: "keyword" },
      },
    },
  });

  const operations = docs.flatMap((doc) => [
    { index: { _index: "orders" } },
    doc,
  ]);

  await client.bulk({ operations, refresh: "wait_for" });
}
