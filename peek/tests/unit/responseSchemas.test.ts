import { describe, it, expect } from "vitest";

import {
  validateResponse,
  esqlQueryResponseSchema,
  clusterHealthResponseSchema,
  clusterStatsResponseSchema,
  nodesInfoResponseSchema,
  nodesStatsResponseSchema,
  catIndicesResponseSchema,
  fieldCapsResponseSchema,
  getDataStreamsResponseSchema,
  getIngestPipelinesResponseSchema,
} from "../../src/services/es/responseSchemas";

// ---------------------------------------------------------------------------
// validateResponse helper
// ---------------------------------------------------------------------------

describe("validateResponse", () => {
  it("returns parsed data when schema matches", () => {
    const schema = esqlQueryResponseSchema;
    const data = { columns: [{ name: "count", type: "long" }], values: [[42]] };
    expect(validateResponse(schema, data, "test")).toEqual(data);
  });

  it("throws an error with label when schema does not match", () => {
    const schema = esqlQueryResponseSchema;
    expect(() => validateResponse(schema, { bad: "shape" }, "ES|QL query")).toThrow(
      /Unexpected ES\|QL query response shape/,
    );
  });

  it("thrown error has status 0 and a message property", () => {
    const schema = esqlQueryResponseSchema;
    try {
      validateResponse(schema, "not-an-object", "ES|QL query");
      expect.unreachable("should have thrown");
    } catch (err) {
      const e = err as { status: number; message: string };
      expect(e.status).toBe(0);
      expect(typeof e.message).toBe("string");
      expect(e.message).toContain("ES|QL query");
    }
  });

  it("passes through extra fields thanks to .passthrough()", () => {
    const data = {
      columns: [{ name: "x", type: "long" }],
      values: [[1]],
      took: 5,
      extra_field: true,
    };
    const result = validateResponse(esqlQueryResponseSchema, data, "test");
    expect((result as Record<string, unknown>).extra_field).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// esqlQueryResponseSchema
// ---------------------------------------------------------------------------

describe("esqlQueryResponseSchema", () => {
  it("accepts a minimal valid ES|QL response", () => {
    const data = { columns: [{ name: "a", type: "keyword" }], values: [["hello"]] };
    expect(esqlQueryResponseSchema.safeParse(data).success).toBe(true);
  });

  it("accepts an ES|QL response with extra fields", () => {
    const data = {
      columns: [{ name: "a", type: "keyword" }],
      values: [["hello"]],
      took: 3,
      is_partial: false,
    };
    expect(esqlQueryResponseSchema.safeParse(data).success).toBe(true);
  });

  it("rejects a response missing columns", () => {
    expect(esqlQueryResponseSchema.safeParse({ values: [[1]] }).success).toBe(false);
  });

  it("rejects a response missing values", () => {
    expect(
      esqlQueryResponseSchema.safeParse({ columns: [{ name: "a", type: "keyword" }] }).success,
    ).toBe(false);
  });

  it("rejects a response with non-array columns", () => {
    expect(esqlQueryResponseSchema.safeParse({ columns: "bad", values: [] }).success).toBe(false);
  });

  it("rejects a column entry missing name", () => {
    const data = { columns: [{ type: "keyword" }], values: [] };
    expect(esqlQueryResponseSchema.safeParse(data).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// clusterHealthResponseSchema
// ---------------------------------------------------------------------------

describe("clusterHealthResponseSchema", () => {
  it("accepts a valid cluster health response", () => {
    const data = {
      cluster_name: "test",
      status: "green",
      number_of_nodes: 3,
      active_shards: 100,
    };
    expect(clusterHealthResponseSchema.safeParse(data).success).toBe(true);
  });

  it("accepts an empty object (all fields are optional)", () => {
    expect(clusterHealthResponseSchema.safeParse({}).success).toBe(true);
  });

  it("rejects if status is not a valid enum value", () => {
    expect(clusterHealthResponseSchema.safeParse({ status: "blue" }).success).toBe(false);
  });

  it("rejects if number_of_nodes is a string", () => {
    expect(clusterHealthResponseSchema.safeParse({ number_of_nodes: "3" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// clusterStatsResponseSchema
// ---------------------------------------------------------------------------

describe("clusterStatsResponseSchema", () => {
  it("accepts a typical cluster stats response", () => {
    const data = {
      indices: { count: 50, docs: { count: 10000 }, store: { size_in_bytes: 1024000 } },
      nodes: { count: { total: 3 } },
    };
    expect(clusterStatsResponseSchema.safeParse(data).success).toBe(true);
  });

  it("accepts an empty object", () => {
    expect(clusterStatsResponseSchema.safeParse({}).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// nodesInfoResponseSchema
// ---------------------------------------------------------------------------

describe("nodesInfoResponseSchema", () => {
  it("accepts a valid nodes info response", () => {
    const data = {
      nodes: {
        node1: { name: "node-1", roles: ["data", "master"], version: "8.12.0" },
      },
    };
    expect(nodesInfoResponseSchema.safeParse(data).success).toBe(true);
  });

  it("accepts a response with no nodes key", () => {
    expect(nodesInfoResponseSchema.safeParse({}).success).toBe(true);
  });

  it("rejects if roles is not an array of strings", () => {
    const data = { nodes: { n1: { roles: [1, 2] } } };
    expect(nodesInfoResponseSchema.safeParse(data).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// nodesStatsResponseSchema
// ---------------------------------------------------------------------------

describe("nodesStatsResponseSchema", () => {
  it("accepts a valid nodes stats response", () => {
    const data = {
      nodes: {
        n1: { name: "node-1", os: { cpu: { percent: 50 } } },
      },
    };
    expect(nodesStatsResponseSchema.safeParse(data).success).toBe(true);
  });

  it("passes through deeply nested OS/JVM/FS stats", () => {
    const data = {
      nodes: {
        n1: {
          name: "node-1",
          jvm: { mem: { heap_used_percent: 65 } },
          fs: { total: { available_in_bytes: 1024 } },
        },
      },
    };
    const result = nodesStatsResponseSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// catIndicesResponseSchema
// ---------------------------------------------------------------------------

describe("catIndicesResponseSchema", () => {
  it("accepts a valid cat indices response", () => {
    const data = [
      {
        index: "logs-2024",
        health: "green",
        status: "open",
        pri: "1",
        rep: "0",
        "docs.count": "1000",
        "docs.deleted": "0",
        "store.size": "1024",
        "pri.store.size": "1024",
      },
    ];
    expect(catIndicesResponseSchema.safeParse(data).success).toBe(true);
  });

  it("accepts null for nullable string fields", () => {
    const data = [
      {
        index: "test",
        health: "yellow",
        status: "open",
        pri: "1",
        rep: "0",
        "docs.count": null,
        "docs.deleted": null,
        "store.size": null,
        "pri.store.size": null,
      },
    ];
    expect(catIndicesResponseSchema.safeParse(data).success).toBe(true);
  });

  it("accepts an empty array", () => {
    expect(catIndicesResponseSchema.safeParse([]).success).toBe(true);
  });

  it("rejects if index is missing", () => {
    const data = [{ health: "green", status: "open", pri: "1", rep: "0" }];
    expect(catIndicesResponseSchema.safeParse(data).success).toBe(false);
  });

  it("rejects non-array input", () => {
    expect(catIndicesResponseSchema.safeParse({ indices: [] }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// fieldCapsResponseSchema
// ---------------------------------------------------------------------------

describe("fieldCapsResponseSchema", () => {
  it("accepts a valid field caps response", () => {
    const data = {
      fields: {
        "@timestamp": { date: { type: "date", searchable: true } },
      },
      indices: ["logs-*"],
    };
    expect(fieldCapsResponseSchema.safeParse(data).success).toBe(true);
  });

  it("rejects a response missing fields", () => {
    expect(fieldCapsResponseSchema.safeParse({ indices: [] }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getDataStreamsResponseSchema
// ---------------------------------------------------------------------------

describe("getDataStreamsResponseSchema", () => {
  it("accepts a valid data streams response", () => {
    const data = {
      data_streams: [{ name: "logs-nginx", timestamp_field: { name: "@timestamp" } }],
    };
    expect(getDataStreamsResponseSchema.safeParse(data).success).toBe(true);
  });

  it("accepts an empty data_streams array", () => {
    expect(getDataStreamsResponseSchema.safeParse({ data_streams: [] }).success).toBe(true);
  });

  it("rejects a response missing data_streams", () => {
    expect(getDataStreamsResponseSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a data stream entry missing name", () => {
    const data = { data_streams: [{ timestamp_field: { name: "@timestamp" } }] };
    expect(getDataStreamsResponseSchema.safeParse(data).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getIngestPipelinesResponseSchema
// ---------------------------------------------------------------------------

describe("getIngestPipelinesResponseSchema", () => {
  it("accepts a valid ingest pipelines response", () => {
    const data = {
      my_pipeline: {
        description: "A test pipeline",
        processors: [{ set: { field: "test", value: "1" } }],
      },
    };
    expect(getIngestPipelinesResponseSchema.safeParse(data).success).toBe(true);
  });

  it("accepts an empty object (no pipelines)", () => {
    expect(getIngestPipelinesResponseSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a pipeline with no description", () => {
    const data = { my_pipeline: { processors: [] } };
    expect(getIngestPipelinesResponseSchema.safeParse(data).success).toBe(true);
  });
});
