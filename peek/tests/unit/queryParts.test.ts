import { describe, it, expect } from "vitest";

import {
  buildPipeline,
  buildTimeRangeClause,
  buildValueList,
  buildWhereClause,
  buildWherePipe,
  normalizeTimeExpression,
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

describe("buildValueList", () => {
  it("quotes and escapes each value", () => {
    expect(buildValueList(['a"b', "c\\d"])).toBe('"a\\"b", "c\\\\d"');
  });

  it("returns empty string for an empty list", () => {
    expect(buildValueList([])).toBe("");
  });
});

describe("buildPipeline", () => {
  it("joins non-empty parts with pipes", () => {
    expect(buildPipeline(["FROM foo", "WHERE a == 1", "LIMIT 10"])).toBe(
      "FROM foo | WHERE a == 1 | LIMIT 10",
    );
  });

  it("skips empty parts", () => {
    expect(buildPipeline(["FROM foo", "", "SORT @timestamp DESC"])).toBe(
      "FROM foo | SORT @timestamp DESC",
    );
  });
});

describe("normalizeTimeExpression", () => {
  it("normalizes NOW() expressions", () => {
    expect(normalizeTimeExpression("now()")).toBe("NOW()");
    expect(normalizeTimeExpression("NOW()-15 minutes")).toBe("NOW() - 15 minutes");
  });

  it("normalizes parseable timestamps to escaped ISO strings", () => {
    expect(normalizeTimeExpression("2026-01-01T00:00:00.000Z")).toBe('"2026-01-01T00:00:00.000Z"');
  });

  it("returns null for unsupported expressions", () => {
    expect(normalizeTimeExpression("NOW(); DROP TABLE x")).toBeNull();
  });
});
