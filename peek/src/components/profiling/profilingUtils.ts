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

export interface SandwichRow {
  functionName: string;
  count: number;
}

export interface SandwichData {
  callers: SandwichRow[];
  self: SandwichRow | null;
  callees: SandwichRow[];
}

/**
 * Build sandwich view data for a selected function.
 * For every occurrence of the function in each stacktrace, accumulate:
 *  - callers: the frame immediately above the selected function
 *  - self: total sample count for the selected function
 *  - callees: the frame immediately below the selected function
 */
export function buildSandwichData(
  stacktraces: SymbolizedStacktrace[],
  functionName: string,
): SandwichData {
  const callerCounts = new Map<string, number>();
  const calleeCounts = new Map<string, number>();
  let selfCount = 0;

  for (const st of stacktraces) {
    const { frames, count } = st;
    for (let i = 0; i < frames.length; i++) {
      if (frames[i]!.functionName === functionName) {
        selfCount += count;
        if (i > 0) {
          const caller = frames[i - 1]!.functionName;
          callerCounts.set(caller, (callerCounts.get(caller) ?? 0) + count);
        }
        if (i < frames.length - 1) {
          const callee = frames[i + 1]!.functionName;
          calleeCounts.set(callee, (calleeCounts.get(callee) ?? 0) + count);
        }
      }
    }
  }

  const toSortedRows = (counts: Map<string, number>): SandwichRow[] =>
    Array.from(counts.entries())
      .map(([fn, count]) => ({ functionName: fn, count }))
      .sort((a, b) => b.count - a.count);

  return {
    callers: toSortedRows(callerCounts),
    self: selfCount > 0 ? { functionName, count: selfCount } : null,
    callees: toSortedRows(calleeCounts),
  };
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
