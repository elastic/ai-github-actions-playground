import { describe, expect, it } from "vitest";

import { isUnknownColumnError } from "../../src/services/es/esqlErrors";

describe("isUnknownColumnError", () => {
  it("matches unknown-column error messages", () => {
    expect(isUnknownColumnError("line 1:42: Unknown column [event.category]")).toBe(true);
  });

  it("matches missing-mapping error messages", () => {
    expect(isUnknownColumnError("No mapping found for field [event.action]")).toBe(true);
    expect(isUnknownColumnError("verification_exception: no mapping found for [host.name]")).toBe(
      true,
    );
    expect(isUnknownColumnError("sql_illegal_argument_exception: no such column [foo]")).toBe(true);
  });

  it("does not match generic validation problem summaries", () => {
    expect(isUnknownColumnError("Found 3 problems")).toBe(false);
    expect(isUnknownColumnError("line 1:1: mismatched input")).toBe(false);
  });
});
