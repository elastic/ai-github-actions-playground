import type { HealthCheckDefinition } from "../types";

function unknownShardsDataResult() {
  return {
    status: "unknown" as const,
    summary: "Shard data unavailable.",
    recommendation: "Ensure shard data is collected and verify cluster permissions.",
  };
}

function unknownAllocationDataResult() {
  return {
    status: "unknown" as const,
    summary: "Allocation explain data unavailable.",
    recommendation: "Ensure allocation explain data is collected and verify cluster permissions.",
  };
}

export const shardChecks: HealthCheckDefinition[] = [
  // #15
  {
    id: "shards.state.unassigned.present",
    domain: "shards",
    title: "Unassigned shards present",
    description: "Fails when cat shards has UNASSIGNED entries.",
    severityOnFail: "high",
    surfaces: ["global", "local"],
    dependsOn: ["shards"],
    evaluate: (snapshot) => {
      const shards = snapshot.data.shards?.catShards;
      if (!shards) return unknownShardsDataResult();
      const unassigned = shards.filter((s) => s.state === "UNASSIGNED");
      if (unassigned.length > 0) {
        return {
          status: "fail",
          summary: `${unassigned.length} UNASSIGNED shard${unassigned.length === 1 ? "" : "s"} found.`,
          observed: { unassigned_count: unassigned.length },
          recommendation: "Run allocation explain to diagnose the root cause.",
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "No UNASSIGNED shards found." };
    },
  },
  // #18
  {
    id: "shards.unassigned.primary.present",
    domain: "shards",
    title: "Unassigned primary shards present",
    description: "Fails when unassigned primary shard rows exist.",
    severityOnFail: "critical",
    surfaces: ["global", "local"],
    dependsOn: ["shards"],
    evaluate: (snapshot) => {
      const shards = snapshot.data.shards?.catShards;
      if (!shards) return unknownShardsDataResult();
      const unassignedPrimaries = shards.filter(
        (s) => s.state === "UNASSIGNED" && s.prirep === "p",
      );
      if (unassignedPrimaries.length > 0) {
        const indices = [...new Set(unassignedPrimaries.map((s) => s.index).filter(Boolean))];
        return {
          status: "fail",
          summary: `${unassignedPrimaries.length} unassigned primary shard${unassignedPrimaries.length === 1 ? "" : "s"} across ${indices.length} index${indices.length === 1 ? "" : "es"}.`,
          observed: {
            unassigned_primary_count: unassignedPrimaries.length,
            affected_indices: indices.slice(0, 10),
          },
          recommendation:
            "Unassigned primaries mean data loss risk. Check allocation explain for details.",
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "No unassigned primary shards." };
    },
  },
  // #23
  {
    id: "allocation.explain.can_allocate.no",
    domain: "shards",
    title: "Allocation blocked",
    description: "Fails when allocation explain says a shard cannot be allocated.",
    severityOnFail: "high",
    surfaces: ["global", "local"],
    dependsOn: ["allocationSample"],
    evaluate: (snapshot) => {
      if (!snapshot.data.allocationSample) {
        return unknownAllocationDataResult();
      }
      const explain = snapshot.data.allocationSample?.allocationExplain;
      if (!explain) {
        return { status: "pass", summary: "No unassigned shards to explain." };
      }
      if (explain.can_allocate?.toLowerCase() === "no") {
        return {
          status: "fail",
          summary: `Shard ${explain.index ?? "unknown"}[${explain.shard ?? "?"}] cannot be allocated.`,
          observed: {
            index: explain.index,
            shard: explain.shard,
            primary: explain.primary,
            can_allocate: explain.can_allocate,
            explanation: explain.allocate_explanation,
          },
          recommendation: "Review allocation deciders to resolve the blocking constraint.",
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return {
        status: "pass",
        summary: "Allocation explain shows shard can be allocated.",
      };
    },
  },
  // #24
  {
    id: "allocation.explain.disk_watermark",
    domain: "shards",
    title: "Disk watermark allocation block",
    description: "Fails when allocation explain indicates a disk threshold block.",
    severityOnFail: "high",
    surfaces: ["global", "local"],
    dependsOn: ["allocationSample"],
    evaluate: (snapshot) => {
      if (!snapshot.data.allocationSample) {
        return unknownAllocationDataResult();
      }
      const explain = snapshot.data.allocationSample?.allocationExplain;
      if (!explain) {
        return { status: "pass", summary: "No unassigned shards to explain." };
      }
      const allocationBlocked = explain.can_allocate?.toLowerCase() === "no";
      if (!allocationBlocked) {
        return {
          status: "pass",
          summary: "Allocation explain shows shard can be allocated.",
        };
      }
      const decisions = explain.node_allocation_decisions ?? [];
      const diskBlocked = decisions.some((node) =>
        (node.deciders ?? []).some(
          (d) =>
            d.decision === "NO" &&
            d.decider === "disk_threshold" &&
            (d.explanation ?? "").length > 0,
        ),
      );
      if (diskBlocked) {
        return {
          status: "fail",
          summary: `Disk watermark is blocking shard allocation for ${explain.index ?? "unknown"}[${explain.shard ?? "?"}].`,
          observed: {
            index: explain.index,
            shard: explain.shard,
            blocked_by: "disk_threshold",
          },
          recommendation:
            "Free disk space or adjust disk watermark thresholds in cluster settings.",
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "No disk watermark allocation blocks detected." };
    },
  },
  // #25
  {
    id: "allocation.explain.tier_mismatch",
    domain: "shards",
    title: "Tier/attribute allocation mismatch",
    description: "Fails when allocation explain indicates a tier or attribute mismatch.",
    severityOnFail: "high",
    surfaces: ["global", "local"],
    dependsOn: ["allocationSample"],
    evaluate: (snapshot) => {
      if (!snapshot.data.allocationSample) {
        return unknownAllocationDataResult();
      }
      const explain = snapshot.data.allocationSample?.allocationExplain;
      if (!explain) {
        return { status: "pass", summary: "No unassigned shards to explain." };
      }
      const allocationBlocked = explain.can_allocate?.toLowerCase() === "no";
      if (!allocationBlocked) {
        return {
          status: "pass",
          summary: "Allocation explain shows shard can be allocated.",
        };
      }
      const decisions = explain.node_allocation_decisions ?? [];
      const tierBlocked = decisions.some((node) =>
        (node.deciders ?? []).some(
          (d) =>
            d.decision === "NO" &&
            (d.decider === "data_tier" || d.decider === "filter") &&
            (d.explanation ?? "").length > 0,
        ),
      );
      if (tierBlocked) {
        return {
          status: "fail",
          summary: `Tier/attribute mismatch blocking allocation for ${explain.index ?? "unknown"}[${explain.shard ?? "?"}].`,
          observed: {
            index: explain.index,
            shard: explain.shard,
            blocked_by: "tier_or_attribute_filter",
          },
          recommendation:
            "Ensure the index tier preference matches available node roles or attributes.",
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "No tier/attribute allocation mismatches detected." };
    },
  },
];
