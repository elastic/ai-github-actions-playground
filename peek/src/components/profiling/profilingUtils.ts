/** Detect ES|QL "Unknown index" errors that indicate missing profiling data streams. */
export function isMissingProfilingIndex(error: string): boolean {
  return /Unknown index \[profiling-/i.test(error);
}

export interface ProfilingEvent {
  stacktraceId: string;
  count: number;
  serviceName: string;
  hostName: string;
  timestamp: string;
}

export interface StacktraceFrameMap {
  id: string;
  frameIds: string;
  frameTypes: string;
}

export interface FrameSymbol {
  id: string;
  functionName: string;
  fileName: string;
  lineNumber: number | null;
  functionOffset: number | null;
}

export interface SymbolizedFrame {
  frameId: string;
  functionName: string;
  fileName: string;
  lineNumber: number | null;
  functionOffset: number | null;
  frameType?: FrameType;
}

export interface SymbolizedStacktrace {
  stacktraceId: string;
  count: number;
  serviceName: string;
  hostName: string;
  timestamp: string;
  frames: SymbolizedFrame[];
}

export function parseFrameIds(frameIdsString: string): string[] {
  if (!frameIdsString) return [];
  // EDOT OTel exporter uses comma-separated frame IDs
  if (frameIdsString.includes(",")) {
    return frameIdsString
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
  }
  // Legacy hex format: underscore-separated 32-char hex IDs.
  // Detect by checking if the string (minus underscores) is purely hex.
  if (frameIdsString.includes("_")) {
    const withoutSeparators = frameIdsString.replace(/_/g, "");
    if (/^[0-9a-f]+$/i.test(withoutSeparators)) {
      const ids: string[] = [];
      for (let i = 0; i < withoutSeparators.length; i += 32) {
        const chunk = withoutSeparators.slice(i, i + 32);
        if (chunk.length === 32) ids.push(chunk);
      }
      return ids;
    }
  }
  // Universal Profiling base64url format: concatenated 32-char base64url IDs
  // (each ID is 16 bytes FileID + 8 bytes address = 24 bytes → 32 base64 chars).
  // Split directly into 32-char chunks without any character removal.
  const ids: string[] = [];
  for (let i = 0; i < frameIdsString.length; i += 32) {
    const chunk = frameIdsString.slice(i, i + 32);
    if (chunk.length === 32) ids.push(chunk);
  }
  return ids;
}

export type FrameType = "kernel" | "runtime" | "native" | "interpreted" | "app";

/** Map Universal Profiling frame type IDs to our FrameType categories. */
const PROFILING_TYPE_MAP: Record<number, FrameType> = {
  1: "interpreted", // Python
  2: "interpreted", // PHP
  3: "native", // Native (C/C++/Rust)
  4: "kernel", // Kernel
  5: "runtime", // JVM/Hotspot
  6: "interpreted", // APM JS
  7: "interpreted", // Ruby
  8: "interpreted", // Perl
  9: "interpreted", // JavaScript
  10: "interpreted", // JavaScript (unwinding)
  11: "runtime", // Go
  12: "native", // abort marker
  13: "runtime", // .NET
};

/**
 * Decode the base64-encoded RLE `Stacktrace.frame.types` field into a
 * per-frame {@link FrameType} array.
 *
 * The encoding is: base64 → bytes read in (count, typeId) pairs, where each
 * pair expands to `count` copies of that type.
 */
export function parseFrameTypes(encoded: string): FrameType[] {
  if (!encoded) return [];
  // Standard base64 decode (the field uses standard base64, not base64url)
  const binary = atob(encoded);
  const result: FrameType[] = [];
  for (let i = 0; i + 1 < binary.length; i += 2) {
    const count = binary.charCodeAt(i);
    const typeId = binary.charCodeAt(i + 1);
    const frameType = PROFILING_TYPE_MAP[typeId] ?? "app";
    for (let j = 0; j < count; j++) {
      result.push(frameType);
    }
  }
  return result;
}

export function inferFrameType(functionName: string, fileName: string): FrameType {
  const fn = functionName.toLowerCase();
  const file = fileName.toLowerCase();

  // Kernel: Linux/OS kernel frames
  if (
    fn.startsWith("do_") ||
    fn.startsWith("sys_") ||
    fn.startsWith("__") ||
    file.includes("/kernel/") ||
    file.includes("/arch/") ||
    file.endsWith(".s")
  ) {
    return "kernel";
  }

  // Runtime/VM: Go runtime, JVM, V8, Python runtime, .NET CLR
  if (
    fn.startsWith("runtime.") ||
    fn.startsWith("runtime/") ||
    fn.startsWith("gc") ||
    fn.startsWith("jit_") ||
    fn.includes("::gc") ||
    file.includes("/runtime/") ||
    file.includes("/vm/") ||
    file.includes("/gc/")
  ) {
    return "runtime";
  }

  // Interpreted: Python, JS, Ruby, PHP
  if (
    file.endsWith(".py") ||
    file.endsWith(".js") ||
    file.endsWith(".ts") ||
    file.endsWith(".tsx") ||
    file.endsWith(".jsx") ||
    file.endsWith(".rb") ||
    file.endsWith(".php") ||
    file.includes("node_modules/")
  ) {
    return "interpreted";
  }

  // Native: C/C++/Rust system libraries
  if (
    file.endsWith(".c") ||
    file.endsWith(".cpp") ||
    file.endsWith(".cc") ||
    file.endsWith(".h") ||
    file.endsWith(".rs") ||
    file.includes("/lib/") ||
    file.includes("/usr/lib/") ||
    fn.startsWith("std::") ||
    fn.startsWith("std/")
  ) {
    return "native";
  }

  return "app";
}

export interface FlamegraphNode {
  name: string;
  value: number;
  children: FlamegraphNode[];
  frameType?: FrameType;
}

/**
 * Aggregate symbolized stacktraces into a hierarchical tree for flamegraph rendering.
 * Each stacktrace's frames are walked root-to-leaf (bottom-up in call order) and
 * merged into a shared tree, with `value` accumulating the sample count.
 */
export function buildFlamegraphTree(stacktraces: SymbolizedStacktrace[]): FlamegraphNode {
  const root: FlamegraphNode = { name: "root", value: 0, children: [] };
  const childIndex = new Map<FlamegraphNode, Map<string, FlamegraphNode>>();
  for (const st of stacktraces) {
    // Frames are ordered caller→callee (deepest last); walk from root (first) to leaf (last)
    const frames = st.frames;
    let current = root;
    current.value += st.count;
    for (const frame of frames) {
      const name = frame.functionName || "(unknown)";
      let idx = childIndex.get(current);
      if (!idx) {
        idx = new Map<string, FlamegraphNode>();
        childIndex.set(current, idx);
      }
      let child = idx.get(name);
      if (!child) {
        child = {
          name,
          value: 0,
          children: [],
          frameType: frame.frameType ?? inferFrameType(frame.functionName, frame.fileName),
        };
        current.children.push(child);
        idx.set(name, child);
      }
      child.value += st.count;
      current = child;
    }
  }
  return root;
}

export interface TopFunctionRow {
  functionName: string;
  selfCount: number | null;
  totalCount: number | null;
}

/**
 * Normalize the response from the `/_profiling/topn/functions` API into a
 * flat list of {@link TopFunctionRow}.
 *
 * The canonical API response nests the function name under
 * `topn[].frame.function_name`, but older / alternative payloads may surface
 * it as a flat key (`function_name`, `Stackframe.function.name`, or `name`).
 * Both shapes are supported so that legacy data and the current API format
 * both work without changes to callers.
 */
export function normalizeTopFunctions(payload: unknown): TopFunctionRow[] {
  const arrayPayload = Array.isArray(payload)
    ? payload
    : typeof payload === "object" && payload !== null
      ? Object.values(payload).find((value) => Array.isArray(value))
      : null;
  if (!Array.isArray(arrayPayload)) return [];
  return arrayPayload
    .map((item) => {
      if (typeof item !== "object" || item === null) return null;
      const record = item as Record<string, unknown>;
      const frame =
        typeof record.frame === "object" && record.frame !== null
          ? (record.frame as Record<string, unknown>)
          : null;
      return {
        functionName: String(
          frame?.function_name ??
            record.function_name ??
            record["Stackframe.function.name"] ??
            record.name ??
            "(unknown)",
        ),
        selfCount: typeof record.self_count === "number" ? record.self_count : null,
        totalCount:
          typeof record.total_count === "number"
            ? record.total_count
            : typeof record.count === "number"
              ? record.count
              : null,
      } satisfies TopFunctionRow;
    })
    .filter((row): row is TopFunctionRow => row !== null);
}

/**
 * Find a subtree node by following a path of frame names from the root.
 * Returns the node at the end of the path, or the root if the path is empty
 * or a segment is not found.
 */
export function findSubtreeByPath(root: FlamegraphNode, path: string[]): FlamegraphNode {
  let current = root;
  for (const name of path) {
    const child = current.children.find((c) => c.name === name);
    if (!child) return current;
    current = child;
  }
  return current;
}

/**
 * Count nodes in a flamegraph tree whose name matches a search term (case-insensitive).
 */
export function countMatchingFrames(node: FlamegraphNode, term: string): number {
  const lower = term.toLowerCase();
  return countMatchingFramesLower(node, lower);
}

function countMatchingFramesLower(node: FlamegraphNode, lowerTerm: string): number {
  let count = node.name.toLowerCase().includes(lowerTerm) ? 1 : 0;
  for (const child of node.children) {
    count += countMatchingFramesLower(child, lowerTerm);
  }
  return count;
}

export function joinStacktraces(
  events: ProfilingEvent[],
  stacktraces: StacktraceFrameMap[],
  stackframes: FrameSymbol[],
): SymbolizedStacktrace[] {
  const stacktraceById = new Map<string, StacktraceFrameMap>();
  for (const stacktrace of stacktraces) {
    stacktraceById.set(stacktrace.id, stacktrace);
  }

  const frameById = new Map<string, FrameSymbol>();
  for (const frame of stackframes) {
    frameById.set(frame.id, frame);
  }

  return events.map((event) => {
    const stacktrace = stacktraceById.get(event.stacktraceId);
    const frameIds = stacktrace ? parseFrameIds(stacktrace.frameIds) : [];
    const decodedTypes = stacktrace ? parseFrameTypes(stacktrace.frameTypes) : [];
    const frames: SymbolizedFrame[] = frameIds.map((frameId, index) => {
      const symbol = frameById.get(frameId);
      const functionName = symbol?.functionName ?? "(unknown)";
      const fileName = symbol?.fileName ?? "";
      return {
        frameId,
        functionName,
        fileName,
        lineNumber: symbol?.lineNumber ?? null,
        functionOffset: symbol?.functionOffset ?? null,
        frameType: decodedTypes[index] ?? inferFrameType(functionName, fileName),
      };
    });
    return {
      stacktraceId: event.stacktraceId,
      count: event.count,
      serviceName: event.serviceName,
      hostName: event.hostName,
      timestamp: event.timestamp,
      frames,
    };
  });
}

export interface FlamescopeWindow {
  from: string;
  to: string;
}

export interface FlamescopeHeatmapModel {
  xLabels: string[];
  yLabels: string[];
  points: Array<[number, number, number]>;
  bucketStacktraces: SymbolizedStacktrace[][];
  bucketWindows: FlamescopeWindow[];
}

function getStacktraceSignature(stacktrace: SymbolizedStacktrace): string {
  const head = stacktrace.frames
    .slice(0, 3)
    .map((frame) => frame.functionName || "(unknown)")
    .join(" → ");
  return head.length > 0 ? head : stacktrace.stacktraceId;
}

function formatBucketLabel(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(11, 19);
}

export function buildFlamescopeHeatmap(
  stacktraces: SymbolizedStacktrace[],
  bucketCount = 48,
  rowLimit = 30,
): FlamescopeHeatmapModel {
  const tracesWithTs = stacktraces
    .map((stacktrace) => ({
      stacktrace,
      timestampMs: Date.parse(stacktrace.timestamp),
    }))
    .filter((item) => Number.isFinite(item.timestampMs));
  if (tracesWithTs.length === 0) {
    return {
      xLabels: [],
      yLabels: [],
      points: [],
      bucketStacktraces: [],
      bucketWindows: [],
    };
  }

  const minTs = Math.min(...tracesWithTs.map((item) => item.timestampMs));
  const maxTs = Math.max(...tracesWithTs.map((item) => item.timestampMs));
  const safeBucketCount = Math.max(1, bucketCount);
  const bucketSizeMs = Math.max(1, Math.ceil((maxTs - minTs + 1) / safeBucketCount));

  const bucketStacktraces: SymbolizedStacktrace[][] = Array.from(
    { length: safeBucketCount },
    () => [],
  );
  const bucketsBySignature: Map<string, number>[] = Array.from(
    { length: safeBucketCount },
    () => new Map(),
  );
  const totalBySignature = new Map<string, number>();

  for (const item of tracesWithTs) {
    const bucket = Math.min(
      safeBucketCount - 1,
      Math.floor((item.timestampMs - minTs) / bucketSizeMs),
    );
    bucketStacktraces[bucket]!.push(item.stacktrace);
    const signature = getStacktraceSignature(item.stacktrace);
    const nextBucketCount =
      (bucketsBySignature[bucket]!.get(signature) ?? 0) + item.stacktrace.count;
    bucketsBySignature[bucket]!.set(signature, nextBucketCount);
    totalBySignature.set(signature, (totalBySignature.get(signature) ?? 0) + item.stacktrace.count);
  }

  const yLabels = [...totalBySignature.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(1, rowLimit))
    .map(([signature]) => signature);
  const yIndex = new Map(yLabels.map((label, index) => [label, index]));
  const points: Array<[number, number, number]> = [];

  for (let x = 0; x < bucketsBySignature.length; x++) {
    for (const [signature, value] of bucketsBySignature[x]!.entries()) {
      const row = yIndex.get(signature);
      if (row == null) continue;
      points.push([x, row, value]);
    }
  }

  const xLabels = Array.from({ length: safeBucketCount }, (_, index) =>
    formatBucketLabel(minTs + index * bucketSizeMs),
  );
  const bucketWindows: FlamescopeWindow[] = Array.from({ length: safeBucketCount }, (_, index) => {
    const from = minTs + index * bucketSizeMs;
    const to = Math.min(maxTs + 1, from + bucketSizeMs);
    return {
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
    };
  });

  return {
    xLabels,
    yLabels,
    points,
    bucketStacktraces,
    bucketWindows,
  };
}
