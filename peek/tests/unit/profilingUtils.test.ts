import { describe, expect, it } from "vitest";

import { joinStacktraces, parseFrameIds } from "../../src/components/profiling/profilingUtils";

describe("profilingUtils", () => {
  it("parses frame IDs from compact payload", () => {
    const joined = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    expect(parseFrameIds(joined)).toEqual([
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    ]);
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
