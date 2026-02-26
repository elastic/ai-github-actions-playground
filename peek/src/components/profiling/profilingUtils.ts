export interface ProfilingEvent {
  stacktraceId: string;
  count: number;
  serviceName: string;
  hostName: string;
}

export interface StacktraceFrameMap {
  id: string;
  frameIds: string;
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
}

export interface SymbolizedStacktrace {
  stacktraceId: string;
  count: number;
  serviceName: string;
  hostName: string;
  frames: SymbolizedFrame[];
}

export function parseFrameIds(frameIdsString: string): string[] {
  // EDOT OTel exporter uses comma-separated frame IDs
  if (frameIdsString.includes(",")) {
    return frameIdsString.split(",").filter((id) => id.length > 0);
  }
  // Legacy Universal Profiling format: underscore-concatenated 32-char hex IDs
  const normalized = frameIdsString.replace(/_/g, "");
  const ids: string[] = [];
  for (let i = 0; i < normalized.length; i += 32) {
    const chunk = normalized.slice(i, i + 32);
    if (chunk.length === 32) ids.push(chunk);
  }
  return ids;
}

export interface FlamegraphNode {
  name: string;
  value: number;
  children: FlamegraphNode[];
}

/**
 * Aggregate symbolized stacktraces into a hierarchical tree for flamegraph rendering.
 * Each stacktrace's frames are walked root-to-leaf (bottom-up in call order) and
 * merged into a shared tree, with `value` accumulating the sample count.
 */
export function buildFlamegraphTree(stacktraces: SymbolizedStacktrace[]): FlamegraphNode {
  const root: FlamegraphNode = { name: "root", value: 0, children: [] };
  for (const st of stacktraces) {
    // Frames are ordered caller→callee (deepest last); walk from root (first) to leaf (last)
    const frames = st.frames;
    let current = root;
    current.value += st.count;
    for (const frame of frames) {
      const name = frame.functionName || "(unknown)";
      let child = current.children.find((c) => c.name === name);
      if (!child) {
        child = { name, value: 0, children: [] };
        current.children.push(child);
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
    const frames: SymbolizedFrame[] = frameIds.map((frameId) => {
      const symbol = frameById.get(frameId);
      return {
        frameId,
        functionName: symbol?.functionName ?? "(unknown)",
        fileName: symbol?.fileName ?? "",
        lineNumber: symbol?.lineNumber ?? null,
        functionOffset: symbol?.functionOffset ?? null,
      };
    });
    return {
      stacktraceId: event.stacktraceId,
      count: event.count,
      serviceName: event.serviceName,
      hostName: event.hostName,
      frames,
    };
  });
}
