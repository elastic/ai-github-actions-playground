import { describe, expect, it } from "vitest";

import {
  buildFlamegraphTree,
  countMatchingFrames,
  findSubtreeByPath,
  joinStacktraces,
  normalizeTopFunctions,
  parseFrameIds,
} from "../../src/components/profiling/profilingUtils";
import type { SymbolizedStacktrace } from "../../src/components/profiling/profilingUtils";

describe("profilingUtils", () => {
  it("parses frame IDs from compact payload (legacy format)", () => {
    const joined = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    expect(parseFrameIds(joined)).toEqual([
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
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

describe("buildFlamegraphTree", () => {
  const makeFrame = (functionName: string) => ({
    frameId: functionName,
    functionName,
    fileName: "",
    lineNumber: null,
    functionOffset: null,
  });

  it("returns an empty root for no stacktraces", () => {
    const tree = buildFlamegraphTree([]);
    expect(tree.name).toBe("root");
    expect(tree.value).toBe(0);
    expect(tree.children).toHaveLength(0);
  });

  it("builds a single-path tree from one stacktrace", () => {
    const stacks: SymbolizedStacktrace[] = [
      {
        stacktraceId: "st1",
        count: 5,
        serviceName: "svc",
        hostName: "host",
        frames: [makeFrame("main"), makeFrame("foo"), makeFrame("bar")],
      },
    ];
    const tree = buildFlamegraphTree(stacks);
    expect(tree.value).toBe(5);
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0]!.name).toBe("main");
    expect(tree.children[0]!.value).toBe(5);
    expect(tree.children[0]!.children[0]!.name).toBe("foo");
    expect(tree.children[0]!.children[0]!.children[0]!.name).toBe("bar");
    expect(tree.children[0]!.children[0]!.children[0]!.value).toBe(5);
  });

  it("merges shared prefixes from multiple stacktraces", () => {
    const stacks: SymbolizedStacktrace[] = [
      {
        stacktraceId: "st1",
        count: 3,
        serviceName: "",
        hostName: "",
        frames: [makeFrame("main"), makeFrame("foo")],
      },
      {
        stacktraceId: "st2",
        count: 7,
        serviceName: "",
        hostName: "",
        frames: [makeFrame("main"), makeFrame("bar")],
      },
    ];
    const tree = buildFlamegraphTree(stacks);
    expect(tree.value).toBe(10);
    const mainNode = tree.children[0]!;
    expect(mainNode.name).toBe("main");
    expect(mainNode.value).toBe(10);
    expect(mainNode.children).toHaveLength(2);
    const fooNode = mainNode.children.find((c) => c.name === "foo")!;
    const barNode = mainNode.children.find((c) => c.name === "bar")!;
    expect(fooNode.value).toBe(3);
    expect(barNode.value).toBe(7);
  });

  it("handles stacktraces with unknown frames gracefully", () => {
    const stacks: SymbolizedStacktrace[] = [
      {
        stacktraceId: "st1",
        count: 2,
        serviceName: "",
        hostName: "",
        frames: [makeFrame("main"), makeFrame("(unknown)"), makeFrame("leaf")],
      },
    ];
    const tree = buildFlamegraphTree(stacks);
    expect(tree.value).toBe(2);
    expect(tree.children[0]!.children[0]!.name).toBe("(unknown)");
    expect(tree.children[0]!.children[0]!.children[0]!.name).toBe("leaf");
  });

  it("handles multiple roots (different top-level functions)", () => {
    const stacks: SymbolizedStacktrace[] = [
      {
        stacktraceId: "st1",
        count: 1,
        serviceName: "",
        hostName: "",
        frames: [makeFrame("main")],
      },
      {
        stacktraceId: "st2",
        count: 2,
        serviceName: "",
        hostName: "",
        frames: [makeFrame("init")],
      },
    ];
    const tree = buildFlamegraphTree(stacks);
    expect(tree.value).toBe(3);
    expect(tree.children).toHaveLength(2);
  });
});

describe("normalizeTopFunctions", () => {
  it("returns empty array for non-array payloads", () => {
    expect(normalizeTopFunctions(null)).toEqual([]);
    expect(normalizeTopFunctions(undefined)).toEqual([]);
    expect(normalizeTopFunctions("string")).toEqual([]);
    expect(normalizeTopFunctions({})).toEqual([]);
  });

  it("parses canonical API response with frame.function_name", () => {
    const payload = {
      topn: [
        { count: 123, frame: { function_name: "runtime.schedule" } },
        { count: 50, frame: { function_name: "main.main" } },
      ],
    };
    const rows = normalizeTopFunctions(payload);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.functionName).toBe("runtime.schedule");
    expect(rows[0]!.totalCount).toBe(123);
    expect(rows[1]!.functionName).toBe("main.main");
  });

  it("parses canonical API response with self_count and total_count", () => {
    const payload = {
      topn: [{ self_count: 10, total_count: 100, frame: { function_name: "foo" } }],
    };
    const rows = normalizeTopFunctions(payload);
    expect(rows[0]!.selfCount).toBe(10);
    expect(rows[0]!.totalCount).toBe(100);
  });

  it("falls back to flat function_name key (legacy shape)", () => {
    const payload = [{ function_name: "legacyFn", self_count: 5, total_count: 20 }];
    const rows = normalizeTopFunctions(payload);
    expect(rows[0]!.functionName).toBe("legacyFn");
    expect(rows[0]!.selfCount).toBe(5);
    expect(rows[0]!.totalCount).toBe(20);
  });

  it("falls back to Stackframe.function.name key", () => {
    const payload = [{ "Stackframe.function.name": "stackframeFn" }];
    const rows = normalizeTopFunctions(payload);
    expect(rows[0]!.functionName).toBe("stackframeFn");
  });

  it("falls back to name key", () => {
    const payload = [{ name: "namedFn" }];
    const rows = normalizeTopFunctions(payload);
    expect(rows[0]!.functionName).toBe("namedFn");
  });

  it("uses (unknown) when no name field is present", () => {
    const payload = [{ count: 5 }];
    const rows = normalizeTopFunctions(payload);
    expect(rows[0]!.functionName).toBe("(unknown)");
  });

  it("frame.function_name takes priority over flat function_name", () => {
    const payload = [{ function_name: "flat", frame: { function_name: "nested" } }];
    const rows = normalizeTopFunctions(payload);
    expect(rows[0]!.functionName).toBe("nested");
  });

  it("falls back to count when total_count is absent", () => {
    const payload = { topn: [{ count: 77, frame: { function_name: "fn" } }] };
    const rows = normalizeTopFunctions(payload);
    expect(rows[0]!.totalCount).toBe(77);
  });
});

describe("findSubtreeByPath", () => {
  function buildTestTree(): ReturnType<typeof buildFlamegraphTree> {
    const stacks: SymbolizedStacktrace[] = [
      {
        stacktraceId: "st1",
        count: 5,
        serviceName: "",
        hostName: "",
        frames: [
          {
            frameId: "main",
            functionName: "main",
            fileName: "",
            lineNumber: null,
            functionOffset: null,
          },
          {
            frameId: "foo",
            functionName: "foo",
            fileName: "",
            lineNumber: null,
            functionOffset: null,
          },
          {
            frameId: "bar",
            functionName: "bar",
            fileName: "",
            lineNumber: null,
            functionOffset: null,
          },
        ],
      },
      {
        stacktraceId: "st2",
        count: 3,
        serviceName: "",
        hostName: "",
        frames: [
          {
            frameId: "main",
            functionName: "main",
            fileName: "",
            lineNumber: null,
            functionOffset: null,
          },
          {
            frameId: "baz",
            functionName: "baz",
            fileName: "",
            lineNumber: null,
            functionOffset: null,
          },
        ],
      },
    ];
    return buildFlamegraphTree(stacks);
  }

  it("returns the root when the path is empty", () => {
    const tree = buildTestTree();
    const result = findSubtreeByPath(tree, []);
    expect(result.name).toBe("root");
    expect(result.value).toBe(8);
  });

  it("navigates to a single-level child", () => {
    const tree = buildTestTree();
    const result = findSubtreeByPath(tree, ["main"]);
    expect(result.name).toBe("main");
    expect(result.value).toBe(8);
    expect(result.children).toHaveLength(2);
  });

  it("navigates to a deeply nested child", () => {
    const tree = buildTestTree();
    const result = findSubtreeByPath(tree, ["main", "foo", "bar"]);
    expect(result.name).toBe("bar");
    expect(result.value).toBe(5);
    expect(result.children).toHaveLength(0);
  });

  it("stops at the last valid segment when path is invalid", () => {
    const tree = buildTestTree();
    const result = findSubtreeByPath(tree, ["main", "nonexistent"]);
    expect(result.name).toBe("main");
  });

  it("returns root when the first segment is invalid", () => {
    const tree = buildTestTree();
    const result = findSubtreeByPath(tree, ["nonexistent"]);
    expect(result.name).toBe("root");
  });
});

describe("countMatchingFrames", () => {
  it("returns 0 for an empty tree with no match", () => {
    const tree = buildFlamegraphTree([]);
    expect(countMatchingFrames(tree, "foo")).toBe(0);
  });

  it("counts matching frames case-insensitively", () => {
    const stacks: SymbolizedStacktrace[] = [
      {
        stacktraceId: "st1",
        count: 1,
        serviceName: "",
        hostName: "",
        frames: [
          {
            frameId: "main",
            functionName: "main",
            fileName: "",
            lineNumber: null,
            functionOffset: null,
          },
          {
            frameId: "fooBar",
            functionName: "fooBar",
            fileName: "",
            lineNumber: null,
            functionOffset: null,
          },
          {
            frameId: "foo",
            functionName: "foo",
            fileName: "",
            lineNumber: null,
            functionOffset: null,
          },
        ],
      },
    ];
    const tree = buildFlamegraphTree(stacks);
    // "foo" matches "fooBar" and "foo" but not "main" or "root"
    expect(countMatchingFrames(tree, "foo")).toBe(2);
  });

  it("matches partial function names", () => {
    const stacks: SymbolizedStacktrace[] = [
      {
        stacktraceId: "st1",
        count: 1,
        serviceName: "",
        hostName: "",
        frames: [
          {
            frameId: "handleRequest",
            functionName: "handleRequest",
            fileName: "",
            lineNumber: null,
            functionOffset: null,
          },
        ],
      },
    ];
    const tree = buildFlamegraphTree(stacks);
    expect(countMatchingFrames(tree, "Request")).toBe(1);
  });
});
