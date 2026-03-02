import { describe, expect, it } from "vitest";

import { getCustomRangeValidationError } from "../../src/components/dateRangeValidation";

describe("getCustomRangeValidationError", () => {
  it("returns a specific message for unparsable custom values", () => {
    expect(getCustomRangeValidationError("not-a-date", "2026-02-28T11:00")).toBe(
      "Enter valid date/time values.",
    );
  });
});
