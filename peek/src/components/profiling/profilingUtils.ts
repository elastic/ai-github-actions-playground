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
