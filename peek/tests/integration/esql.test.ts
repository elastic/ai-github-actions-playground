import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ElasticsearchClient, isElasticsearchError } from "../../src/services/es";
import type { ElasticsearchConnection } from "../../src/types";
import { startElasticsearch, seedWebLogs, seedOrders, type TestContext } from "./setup";

let ctx: TestContext;
let connection: ElasticsearchConnection;
let client: ElasticsearchClient;

beforeAll(async () => {
  ctx = await startElasticsearch();
  connection = { url: ctx.baseUrl, apiKey: "" };
  client = new ElasticsearchClient(connection);

  await seedWebLogs(ctx.esClient);
  await seedOrders(ctx.esClient);
});

afterAll(async () => {
  await ctx?.container.stop();
});

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

describe("testConnection", () => {
  it("returns ok for a valid cluster", async () => {
    const info = await client.getClusterInfo();
    expect(info.cluster_name).toBeTruthy();
  });

  it("returns error for a bad URL", async () => {
    const bad = new ElasticsearchClient({ url: "http://localhost:1", apiKey: "" });
    await expect(bad.getClusterInfo()).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Basic ES|QL queries
// ---------------------------------------------------------------------------

describe("executeEsql", () => {
  it("runs SHOW INFO and returns columns + values", async () => {
    const result = await client.query({ query: "SHOW INFO" });
    expect(result.columns.length).toBeGreaterThan(0);
    expect(result.values.length).toBeGreaterThan(0);
  });

  it("throws a structured error for invalid syntax", async () => {
    try {
      await client.query({ query: "THIS IS NOT VALID ESQL" });
      expect.fail("Should have thrown");
    } catch (err) {
      expect(isElasticsearchError(err)).toBe(true);
      if (isElasticsearchError(err)) {
        expect(err.status).toBe(400);
        expect(err.message).toBeTruthy();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Web logs queries
// ---------------------------------------------------------------------------

describe("web_logs queries", () => {
  it("FROM returns all 6 rows", async () => {
    const result = await client.query({ query: "FROM web_logs" });
    expect(result.values).toHaveLength(6);

    const colNames = result.columns.map((c) => c.name);
    expect(colNames).toContain("@timestamp");
    expect(colNames).toContain("method");
    expect(colNames).toContain("status");
    expect(colNames).toContain("bytes");
  });

  it("WHERE filters correctly", async () => {
    const result = await client.query({
      query: "FROM web_logs | WHERE status == 200",
    });
    expect(result.values).toHaveLength(3);
    const statusIdx = result.columns.findIndex((c) => c.name === "status");
    for (const row of result.values) {
      expect(row[statusIdx]).toBe(200);
    }
  });

  it("STATS COUNT aggregation", async () => {
    const result = await client.query({
      query: "FROM web_logs | STATS request_count = COUNT(*) BY method | SORT method",
    });

    const methodIdx = result.columns.findIndex((c) => c.name === "method");
    const countIdx = result.columns.findIndex((c) => c.name === "request_count");

    expect(methodIdx).toBeGreaterThanOrEqual(0);
    expect(countIdx).toBeGreaterThanOrEqual(0);

    const rows = result.values.map((row) => ({
      method: row[methodIdx],
      count: row[countIdx],
    }));

    expect(rows).toContainEqual({ method: "GET", count: 4 });
    expect(rows).toContainEqual({ method: "POST", count: 2 });
  });

  it("STATS SUM aggregation on bytes", async () => {
    const result = await client.query({
      query: "FROM web_logs | STATS total_bytes = SUM(bytes)",
    });

    expect(result.values).toHaveLength(1);
    const totalIdx = result.columns.findIndex((c) => c.name === "total_bytes");
    expect(result.values[0]![totalIdx]).toBe(1024 + 512 + 256 + 128 + 64 + 32);
  });

  it("SORT and LIMIT", async () => {
    const result = await client.query({
      query: "FROM web_logs | SORT bytes DESC | LIMIT 3",
    });
    expect(result.values).toHaveLength(3);

    const bytesIdx = result.columns.findIndex((c) => c.name === "bytes");
    const byteValues = result.values.map((row) => row[bytesIdx] as number);
    expect(byteValues).toEqual([1024, 512, 256]);
  });

  it("STATS grouped by host", async () => {
    const result = await client.query({
      query: "FROM web_logs | STATS count = COUNT(*) BY host | SORT host",
    });

    const hostIdx = result.columns.findIndex((c) => c.name === "host");
    const countIdx = result.columns.findIndex((c) => c.name === "count");

    const rows = result.values.map((row) => ({
      host: row[hostIdx],
      count: row[countIdx],
    }));

    expect(rows).toContainEqual({ host: "web-1", count: 3 });
    expect(rows).toContainEqual({ host: "web-2", count: 2 });
    expect(rows).toContainEqual({ host: "web-3", count: 1 });
  });

  it("EVAL computed column", async () => {
    const result = await client.query({
      query:
        "FROM web_logs | EVAL kb = bytes / 1024.0 | KEEP path, bytes, kb | SORT bytes DESC | LIMIT 2",
    });

    const kbIdx = result.columns.findIndex((c) => c.name === "kb");
    const bytesIdx = result.columns.findIndex((c) => c.name === "bytes");
    expect(kbIdx).toBeGreaterThanOrEqual(0);

    expect(result.values[0]![bytesIdx]).toBe(1024);
    expect(result.values[0]![kbIdx]).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// Orders queries
// ---------------------------------------------------------------------------

describe("orders queries", () => {
  it("FROM returns all 8 rows", async () => {
    const result = await client.query({ query: "FROM orders" });
    expect(result.values).toHaveLength(8);
  });

  it("STATS revenue by category", async () => {
    const result = await client.query({
      query: "FROM orders | STATS revenue = SUM(amount) BY category | SORT category",
    });

    const catIdx = result.columns.findIndex((c) => c.name === "category");
    const revIdx = result.columns.findIndex((c) => c.name === "revenue");

    const rows = Object.fromEntries(
      result.values.map((row) => [row[catIdx], row[revIdx]]),
    );

    expect(rows["books"]).toBeCloseTo(19.99 + 29.99, 1);
    expect(rows["clothing"]).toBeCloseTo(49.99 + 79.99 + 39.99, 1);
    expect(rows["electronics"]).toBeCloseTo(299.99 + 149.99 + 999.99, 1);
  });

  it("STATS with multiple aggregations", async () => {
    const result = await client.query({
      query:
        "FROM orders | STATS total_orders = COUNT(*), avg_amount = AVG(amount), total_qty = SUM(quantity)",
    });

    expect(result.values).toHaveLength(1);

    const orderIdx = result.columns.findIndex((c) => c.name === "total_orders");
    const qtyIdx = result.columns.findIndex((c) => c.name === "total_qty");
    const avgIdx = result.columns.findIndex((c) => c.name === "avg_amount");

    expect(result.values[0]![orderIdx]).toBe(8);
    expect(result.values[0]![qtyIdx]).toBe(1 + 2 + 3 + 1 + 5 + 2 + 1 + 4);
    expect(result.values[0]![avgIdx]).toBeCloseTo(
      (299.99 + 149.99 + 49.99 + 79.99 + 19.99 + 29.99 + 999.99 + 39.99) / 8,
      1,
    );
  });

  it("WHERE with numeric filter", async () => {
    const result = await client.query({
      query: "FROM orders | WHERE amount > 100 | SORT amount DESC",
    });

    const amountIdx = result.columns.findIndex((c) => c.name === "amount");
    const amounts = result.values.map((row) => row[amountIdx] as number);

    expect(amounts).toEqual([999.99, 299.99, 149.99]);
  });

  it("STATS grouped by region", async () => {
    const result = await client.query({
      query: "FROM orders | STATS order_count = COUNT(*) BY region | SORT region",
    });

    const regionIdx = result.columns.findIndex((c) => c.name === "region");
    const countIdx = result.columns.findIndex((c) => c.name === "order_count");

    const rows = Object.fromEntries(
      result.values.map((row) => [row[regionIdx], row[countIdx]]),
    );

    expect(rows["eu-west"]).toBe(2);
    expect(rows["us-east"]).toBe(3);
    expect(rows["us-west"]).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Time range filter
// ---------------------------------------------------------------------------

describe("client.query time range filter", () => {
  it("returns all rows when time range covers all data", async () => {
    const result = await client.query({
      query: "FROM web_logs",
      filter: {
        range: { "@timestamp": { gte: "now-1h", lte: "now" } },
      },
    });
    expect(result.values).toHaveLength(6);
  });

  it("returns no rows when time range excludes all data", async () => {
    const result = await client.query({
      query: "FROM web_logs",
      filter: {
        range: { "@timestamp": { gte: "now-30d", lte: "now-1d" } },
      },
    });
    expect(result.values).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Response structure verification
// ---------------------------------------------------------------------------

describe("response structure", () => {
  it("columns include name and type", async () => {
    const result = await client.query({
      query: "FROM web_logs | KEEP method, status, bytes | LIMIT 1",
    });

    expect(result.columns).toHaveLength(3);

    const methodCol = result.columns.find((c) => c.name === "method");
    const statusCol = result.columns.find((c) => c.name === "status");
    const bytesCol = result.columns.find((c) => c.name === "bytes");

    expect(methodCol?.type).toBe("keyword");
    expect(statusCol?.type).toBe("integer");
    expect(bytesCol?.type).toBe("long");
  });

  it("aggregation columns have correct types", async () => {
    const result = await client.query({
      query: "FROM orders | STATS total = SUM(amount), cnt = COUNT(*)",
    });

    const totalCol = result.columns.find((c) => c.name === "total");
    const cntCol = result.columns.find((c) => c.name === "cnt");

    expect(totalCol?.type).toBe("double");
    expect(cntCol?.type).toBe("long");
  });
});
