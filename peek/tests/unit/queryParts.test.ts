import { describe, it, expect } from "vitest";

import { buildWhereClause, buildWherePipe } from "../../src/services/es/queryParts";

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
