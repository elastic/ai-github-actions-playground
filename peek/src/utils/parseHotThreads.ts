export interface ParsedHotThread {
  node: string;
  sampleType: string;
  sampleValue: number;
  sampleUnit: string;
  sampleWindow: string;
  threadName: string;
  snapshotSummary: string;
  stackFrames: string[];
  topFrame: string;
}

const NODE_HEADER_PREFIX = ":::";

function parseSampleLine(line: string): {
  sampleValue: number;
  sampleUnit: string;
  sampleWindow: string;
  sampleType: string;
  threadName: string;
} | null {
  const percentMatch = line.match(
    /^\s*([0-9]+(?:\.[0-9]+)?)%\s+(?:\[[^\]]+\]\s+)?\(([^)]+)\)\s+([a-z]+)\s+usage by thread\s+'([^']+)'/i,
  );
  if (percentMatch) {
    return {
      sampleValue: Number.parseFloat(percentMatch[1] ?? "0"),
      sampleUnit: "%",
      sampleWindow: percentMatch[2] ?? "",
      sampleType: (percentMatch[3] ?? "").toLowerCase(),
      threadName: percentMatch[4] ?? "",
    };
  }

  const memoryMatch = line.match(
    /^\s*([0-9]+(?:\.[0-9]+)?)([a-zA-Z]+)\s+memory\s+allocated\s+by\s+thread\s+'([^']+)'/i,
  );
  if (memoryMatch) {
    return {
      sampleValue: Number.parseFloat(memoryMatch[1] ?? "0"),
      sampleUnit: (memoryMatch[2] ?? "").toLowerCase(),
      sampleWindow: "allocated",
      sampleType: "mem",
      threadName: memoryMatch[3] ?? "",
    };
  }

  return null;
}

function parseNodeLabel(headerLine: string): string {
  const trimmed = headerLine.trim();
  if (!trimmed.startsWith(NODE_HEADER_PREFIX)) return "unknown";
  const braces = Array.from(trimmed.matchAll(/\{([^}]*)\}/g)).map((m) => m[1]);
  if (braces.length === 0) return "unknown";
  return braces[0] || "unknown";
}

export function parseHotThreadsText(text: string): ParsedHotThread[] {
  const lines = text.split(/\r?\n/);
  const parsed: ParsedHotThread[] = [];
  let currentNode = "unknown";
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.trim().startsWith(NODE_HEADER_PREFIX)) {
      currentNode = parseNodeLabel(line);
      i += 1;
      continue;
    }

    const sample = parseSampleLine(line);
    if (!sample) {
      i += 1;
      continue;
    }

    let j = i + 1;
    let snapshotSummary = "";
    const stackFrames: string[] = [];
    while (j < lines.length) {
      const next = (lines[j] ?? "").trim();
      if (!next) {
        j += 1;
        continue;
      }
      if (next.startsWith(NODE_HEADER_PREFIX) || parseSampleLine(next)) {
        break;
      }
      if (/^\d+\/\d+\s+snapshots\s+sharing\s+following/i.test(next)) {
        snapshotSummary = next;
        j += 1;
        continue;
      }
      if (/^unique\s+snapshot$/i.test(next)) {
        snapshotSummary = next;
        j += 1;
        continue;
      }
      stackFrames.push(next);
      j += 1;
    }
    const topFrame = stackFrames[0] ?? "";

    parsed.push({
      node: currentNode,
      sampleType: sample.sampleType,
      sampleValue: sample.sampleValue,
      sampleUnit: sample.sampleUnit,
      sampleWindow: sample.sampleWindow,
      threadName: sample.threadName,
      snapshotSummary,
      stackFrames,
      topFrame,
    });
    i += 1;
  }

  return parsed;
}
