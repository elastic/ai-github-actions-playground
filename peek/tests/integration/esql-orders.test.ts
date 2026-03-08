import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ElasticsearchClient } from "../../src/services/es";
import type { ElasticsearchConnection } from "../../src/types";
import { startElasticsearch, seedOrders, type TestContext } from "./setup";

let ctx: TestContext;
let connection: ElasticsearchConnection;
let client: ElasticsearchClient;

beforeAll(async () => {
  ctx = await startElasticsearch();
  connection = { url: ctx.baseUrl, apiKey: "" };
  client = new ElasticsearchClient(connection);

  await seedOrders(ctx.esClient);
});

afterAll(async () => {
  await ctx?.container.stop();
});

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

    const rows = Object.fromEntries(result.values.map((row) => [row[catIdx], row[revIdx]]));

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

    const rows = Object.fromEntries(result.values.map((row) => [row[regionIdx], row[countIdx]]));

    expect(rows["eu-west"]).toBe(2);
    expect(rows["us-east"]).toBe(3);
    expect(rows["us-west"]).toBe(3);
  });
});

describe("orders response structure", () => {
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
