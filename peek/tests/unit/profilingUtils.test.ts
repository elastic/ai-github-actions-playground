import { describe, expect, it } from "vitest";

import { joinStacktraces, parseFrameIds } from "../../src/components/profiling/profilingUtils";

describe("profilingUtils", () => {
  it("parses frame IDs from compact payload (legacy format)", () => {
    const joined = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    expect(parseFrameIds(joined)).toEqual([
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    ]);
  });

  it("parses comma-separated frame IDs (EDOT format)", () => {
    const csv =
      "abc123def456789012345678fedcba98,deadbeef00112233aabbccddeeff0011,0123456789abcdef0123456789abcdef";
    expect(parseFrameIds(csv)).toEqual([
      "abc123def456789012345678fedcba98",
      "deadbeef00112233aabbccddeeff0011",
      "0123456789abcdef0123456789abcdef",
    ]);
  });

  it("handles single comma-separated frame ID", () => {
    expect(parseFrameIds("abc123,def456")).toEqual(["abc123", "def456"]);
  });

  it("filters empty entries from comma-separated format", () => {
    expect(parseFrameIds("abc123,,def456,")).toEqual(["abc123", "def456"]);
  });

  it("joins events stacktraces and symbols", () => {
    const result = joinStacktraces(
      [{ stacktraceId: "st1", count: 12, serviceName: "svc", hostName: "host" }],
      [{ id: "st1", frameIds: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
      [
        {
          id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          functionName: "main",
          fileName: "main.go",
          lineNumber: 10,
          functionOffset: 1,
        },
      ],
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.frames[0]!.functionName).toBe("main");
    expect(result[0]!.count).toBe(12);
  });
});
