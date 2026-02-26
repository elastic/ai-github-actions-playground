import { describe, expect, it } from "vitest";

import {
  buildFlamegraphTree,
  buildSandwichData,
  joinStacktraces,
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

describe("buildSandwichData", () => {
  const makeFrame = (functionName: string) => ({
    frameId: functionName,
    functionName,
    fileName: "",
    lineNumber: null,
    functionOffset: null,
  });

  const makeStack = (id: string, count: number, ...fns: string[]): SymbolizedStacktrace => ({
    stacktraceId: id,
    count,
    serviceName: "",
    hostName: "",
    frames: fns.map(makeFrame),
  });

  it("returns null self when function is not found", () => {
    const result = buildSandwichData([makeStack("st1", 5, "main", "foo")], "missing");
    expect(result.self).toBeNull();
    expect(result.callers).toHaveLength(0);
    expect(result.callees).toHaveLength(0);
  });

  it("identifies caller and callee for a middle frame", () => {
    const result = buildSandwichData([makeStack("st1", 3, "main", "foo", "bar")], "foo");
    expect(result.self).toEqual({ functionName: "foo", count: 3 });
    expect(result.callers).toEqual([{ functionName: "main", count: 3 }]);
    expect(result.callees).toEqual([{ functionName: "bar", count: 3 }]);
  });

  it("has no caller for a top-level frame", () => {
    const result = buildSandwichData([makeStack("st1", 2, "main", "foo")], "main");
    expect(result.self).toEqual({ functionName: "main", count: 2 });
    expect(result.callers).toHaveLength(0);
    expect(result.callees).toEqual([{ functionName: "foo", count: 2 }]);
  });

  it("has no callee for a leaf frame", () => {
    const result = buildSandwichData([makeStack("st1", 4, "main", "foo")], "foo");
    expect(result.self).toEqual({ functionName: "foo", count: 4 });
    expect(result.callers).toEqual([{ functionName: "main", count: 4 }]);
    expect(result.callees).toHaveLength(0);
  });

  it("accumulates counts from multiple stacktraces", () => {
    const stacks = [makeStack("st1", 5, "a", "foo", "b"), makeStack("st2", 3, "c", "foo", "d")];
    const result = buildSandwichData(stacks, "foo");
    expect(result.self).toEqual({ functionName: "foo", count: 8 });
    const callerA = result.callers.find((r) => r.functionName === "a");
    const callerC = result.callers.find((r) => r.functionName === "c");
    expect(callerA?.count).toBe(5);
    expect(callerC?.count).toBe(3);
    const calleeB = result.callees.find((r) => r.functionName === "b");
    const calleeD = result.callees.find((r) => r.functionName === "d");
    expect(calleeB?.count).toBe(5);
    expect(calleeD?.count).toBe(3);
  });

  it("sorts callers and callees by count descending", () => {
    const stacks = [makeStack("st1", 10, "a", "foo", "x"), makeStack("st2", 2, "b", "foo", "y")];
    const result = buildSandwichData(stacks, "foo");
    expect(result.callers[0]!.functionName).toBe("a");
    expect(result.callers[1]!.functionName).toBe("b");
  });

  it("counts each occurrence of the function in a single stacktrace", () => {
    const result = buildSandwichData([makeStack("st1", 1, "foo", "bar", "foo")], "foo");
    expect(result.self!.count).toBe(2);
  });
});
