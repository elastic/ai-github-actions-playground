import { describe, it, expect } from "vitest";

import {
  buildTimeRangeClause,
  buildWhereClause,
  buildWherePipe,
} from "../../src/services/es/queryParts";

describe("buildWhereClause", () => {
  it("returns empty string for empty array", () => {
    expect(buildWhereClause([])).toBe("");
  });

  it("returns a single clause as-is", () => {
    expect(buildWhereClause(["a == 1"])).toBe("a == 1");
  });

  it("joins multiple clauses with AND", () => {
    expect(buildWhereClause(["a == 1", "b == 2", "c == 3"])).toBe("a == 1 AND b == 2 AND c == 3");
  });
});

describe("buildWherePipe", () => {
  it("returns empty string for empty array", () => {
    expect(buildWherePipe([])).toBe("");
  });

  it("returns WHERE with a single clause", () => {
    expect(buildWherePipe(["a == 1"])).toBe("WHERE a == 1");
  });

  it("returns WHERE with multiple AND-joined clauses", () => {
    expect(buildWherePipe(["a == 1", "b == 2"])).toBe("WHERE a == 1 AND b == 2");
  });
});

describe("buildTimeRangeClause", () => {
  it("returns an inclusive time range clause", () => {
    expect(buildTimeRangeClause("@timestamp", "?_tstart", "?_tend")).toBe(
      "@timestamp >= ?_tstart AND @timestamp <= ?_tend",
    );
  });

  it("supports custom fields and expressions", () => {
    expect(buildTimeRangeClause("event.ingested", "NOW() - 1 hour", "NOW()")).toBe(
      "event.ingested >= NOW() - 1 hour AND event.ingested <= NOW()",
    );
  });
});
