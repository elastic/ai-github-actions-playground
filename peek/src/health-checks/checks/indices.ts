import type { HealthCheckDefinition } from "../types";

const SHARD_SIZE_TOO_LARGE_BYTES = 50 * 1024 * 1024 * 1024; // 50 GB
const SHARD_SIZE_TOO_SMALL_BYTES = 1 * 1024 * 1024; // 1 MB
const DOCS_DELETED_RATIO_HIGH = 0.3;
const YELLOW_INDICES_HIGH = 10;
const UNDERSIZED_SHARD_WARNING_THRESHOLD = 5;
const INDICES_COUNT_HIGH = 1000;

function unknownIndicesDataResult() {
  return {
    status: "unknown" as const,
    summary: "Indices data unavailable.",
    recommendation: "Ensure indices data is collected and verify cluster permissions.",
  };
}

export const indicesChecks: HealthCheckDefinition[] = [
  // #73
  {
    id: "indices.status.red.present",
    domain: "indices",
    title: "Red indices",
    description: "Fails when any index has red health status.",
    severityOnFail: "critical",
    surfaces: ["global", "local"],
    dependsOn: ["indicesCore"],
    evaluate: (snapshot) => {
      const indices = snapshot.data.indicesCore?.catIndices;
      if (!indices) return unknownIndicesDataResult();
      const red = indices.filter((i) => i.health === "red");
      if (red.length > 0) {
        return {
          status: "fail",
          summary: `${red.length} red index${red.length === 1 ? "" : "es"} detected.`,
          observed: { count: red.length, indices: red.map((i) => i.index).slice(0, 10) },
          recommendation:
            "Red indices have unassigned primary shards. Check allocation and node health.",
          links: [{ label: "Indices", to: "/indices" }],
        };
      }
      return { status: "pass", summary: "No red indices." };
    },
  },
  // #74
  {
    id: "indices.status.yellow.high",
    domain: "indices",
    title: "Many yellow indices",
    description: `Warns when >= ${YELLOW_INDICES_HIGH} indices have yellow health status.`,
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["indicesCore"],
    evaluate: (snapshot) => {
      const indices = snapshot.data.indicesCore?.catIndices;
      if (!indices) return unknownIndicesDataResult();
      const yellow = indices.filter((i) => i.health === "yellow");
      if (yellow.length >= YELLOW_INDICES_HIGH) {
        return {
          status: "warn",
          summary: `${yellow.length} yellow indices detected.`,
          observed: { count: yellow.length },
          recommendation:
            "Yellow indices have unassigned replica shards. Add nodes or adjust replica count.",
          links: [{ label: "Indices", to: "/indices" }],
        };
      }
      return { status: "pass", summary: `Yellow indices (${yellow.length}) within threshold.` };
    },
  },
  // #75
  {
    id: "indices.shard_size.too_large",
    domain: "indices",
    title: "Oversized shards",
    description: "Warns when primary shard store size exceeds 50 GB.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["indicesCore"],
    evaluate: (snapshot) => {
      const indices = snapshot.data.indicesCore?.catIndices;
      if (!indices) return unknownIndicesDataResult();
      const oversized = indices.filter((i) => {
        const size = Number(i["pri.store.size"] ?? "0");
        const priCount = Number(i.pri ?? "1") || 1;
        return size / priCount > SHARD_SIZE_TOO_LARGE_BYTES;
      });
      if (oversized.length > 0) {
        return {
          status: "warn",
          summary: `${oversized.length} index${oversized.length === 1 ? "" : "es"} with shards > 50 GB.`,
          observed: {
            count: oversized.length,
            indices: oversized.map((i) => i.index).slice(0, 10),
          },
          recommendation:
            "Large shards slow recovery and rebalancing. Consider increasing primary shard count.",
        };
      }
      return { status: "pass", summary: "No oversized shards detected." };
    },
  },
  // #76
  {
    id: "indices.shard_size.too_small",
    domain: "indices",
    title: "Undersized shards",
    description: "Warns when many primary shards are < 1 MB with documents present.",
    severityOnFail: "low",
    surfaces: ["global"],
    dependsOn: ["indicesCore"],
    evaluate: (snapshot) => {
      const indices = snapshot.data.indicesCore?.catIndices;
      if (!indices) return unknownIndicesDataResult();
      const undersized = indices.filter((i) => {
        const size = Number(i["pri.store.size"] ?? "0");
        const docs = Number(i["docs.count"] ?? "0");
        const priCount = Number(i.pri ?? "1") || 1;
        return docs > 0 && size / priCount < SHARD_SIZE_TOO_SMALL_BYTES;
      });
      if (undersized.length > UNDERSIZED_SHARD_WARNING_THRESHOLD) {
        return {
          status: "warn",
          summary: `${undersized.length} indices with very small shards (< 1 MB).`,
          observed: { count: undersized.length },
          recommendation:
            "Many tiny shards waste resources. Consider merging indices or reducing shard count.",
        };
      }
      return { status: "pass", summary: "No excessive undersized shard count." };
    },
  },
  // #77
  {
    id: "indices.docs_deleted_ratio.high",
    domain: "indices",
    title: "High deleted document ratio",
    description: `Warns when deleted docs / total docs > ${(DOCS_DELETED_RATIO_HIGH * 100).toFixed(0)}%.`,
    severityOnFail: "low",
    surfaces: ["global"],
    dependsOn: ["indicesCore"],
    evaluate: (snapshot) => {
      const indices = snapshot.data.indicesCore?.catIndices;
      if (!indices) return unknownIndicesDataResult();
      const highDeletion = indices.filter((i) => {
        const docs = Number(i["docs.count"] ?? "0");
        const deleted = Number(i["docs.deleted"] ?? "0");
        const total = docs + deleted;
        return total > 0 && deleted / total > DOCS_DELETED_RATIO_HIGH;
      });
      if (highDeletion.length > 0) {
        return {
          status: "warn",
          summary: `${highDeletion.length} index${highDeletion.length === 1 ? "" : "es"} with > ${(DOCS_DELETED_RATIO_HIGH * 100).toFixed(0)}% deleted docs.`,
          observed: {
            count: highDeletion.length,
            indices: highDeletion.map((i) => i.index).slice(0, 10),
          },
          recommendation:
            "High deletion ratio wastes disk. Consider force-merging or check update patterns.",
        };
      }
      return { status: "pass", summary: "Deleted document ratios within threshold." };
    },
  },
  // indices.count.high
  {
    id: "indices.count.high",
    domain: "indices",
    title: "High index count",
    description: `Warns when the total number of indices exceeds ${INDICES_COUNT_HIGH}.`,
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["indicesCore"],
    evaluate: (snapshot) => {
      const indices = snapshot.data.indicesCore?.catIndices;
      if (!indices) return unknownIndicesDataResult();
      if (indices.length > INDICES_COUNT_HIGH) {
        return {
          status: "warn",
          summary: `${indices.length} indices in cluster (threshold: ${INDICES_COUNT_HIGH}).`,
          observed: { count: indices.length },
          recommendation:
            "Many indices increase cluster state size. Consider using data streams or ILM.",
          links: [{ label: "Indices", to: "/indices" }],
        };
      }
      return { status: "pass", summary: `Index count (${indices.length}) within threshold.` };
    },
  },
  // indices.closed.present
  {
    id: "indices.closed.present",
    domain: "indices",
    title: "Closed indices present",
    description: "Warns when closed indices are detected.",
    severityOnFail: "low",
    surfaces: ["global"],
    dependsOn: ["indicesCore"],
    evaluate: (snapshot) => {
      const indices = snapshot.data.indicesCore?.catIndices;
      if (!indices) return unknownIndicesDataResult();
      const closed = indices.filter((i) => i.status === "close");
      if (closed.length > 0) {
        return {
          status: "warn",
          summary: `${closed.length} closed index${closed.length === 1 ? "" : "es"}.`,
          observed: { count: closed.length, indices: closed.map((i) => i.index).slice(0, 10) },
          recommendation:
            "Closed indices still consume cluster state resources. Delete or reopen if needed.",
        };
      }
      return { status: "pass", summary: "No closed indices." };
    },
  },
];
