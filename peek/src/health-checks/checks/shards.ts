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

const INITIALIZING_SHARDS_HIGH = 10;
const RELOCATING_SHARDS_HIGH = 10;

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
  // #16
  {
    id: "shards.state.initializing.high",
    domain: "shards",
    title: "High initializing shard count",
    description: `Warns when >= ${INITIALIZING_SHARDS_HIGH} shards are in INITIALIZING state.`,
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["shards"],
    evaluate: (snapshot) => {
      const shards = snapshot.data.shards?.catShards;
      if (!shards) return unknownShardsDataResult();
      const initializing = shards.filter((s) => s.state === "INITIALIZING");
      if (initializing.length >= INITIALIZING_SHARDS_HIGH) {
        return {
          status: "warn",
          summary: `${initializing.length} initializing shards.`,
          observed: { count: initializing.length },
          recommendation: "High initializing shard count suggests ongoing recovery or allocation.",
        };
      }
      return {
        status: "pass",
        summary: `Initializing shards (${initializing.length}) within threshold.`,
      };
    },
  },
  // #17
  {
    id: "shards.state.relocating.high",
    domain: "shards",
    title: "High relocating shard count",
    description: `Warns when >= ${RELOCATING_SHARDS_HIGH} shards are in RELOCATING state.`,
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["shards"],
    evaluate: (snapshot) => {
      const shards = snapshot.data.shards?.catShards;
      if (!shards) return unknownShardsDataResult();
      const relocating = shards.filter((s) => s.state === "RELOCATING");
      if (relocating.length >= RELOCATING_SHARDS_HIGH) {
        return {
          status: "warn",
          summary: `${relocating.length} relocating shards.`,
          observed: { count: relocating.length },
          recommendation: "Many relocating shards may impact cluster performance.",
        };
      }
      return {
        status: "pass",
        summary: `Relocating shards (${relocating.length}) within threshold.`,
      };
    },
  },
  // #19
  {
    id: "shards.unassigned.reason.allocation_failed",
    domain: "shards",
    title: "Unassigned shards: allocation failed",
    description: "Warns when unassigned shards have ALLOCATION_FAILED reason.",
    severityOnFail: "high",
    surfaces: ["global"],
    dependsOn: ["shards"],
    evaluate: (snapshot) => {
      const shards = snapshot.data.shards?.catShards;
      if (!shards) return unknownShardsDataResult();
      const matched = shards.filter(
        (s) =>
          s.state === "UNASSIGNED" && (s["unassigned.reason"] ?? "").includes("ALLOCATION_FAILED"),
      );
      if (matched.length > 0) {
        return {
          status: "warn",
          summary: `${matched.length} shard${matched.length === 1 ? "" : "s"} unassigned due to ALLOCATION_FAILED.`,
          observed: { count: matched.length },
          recommendation:
            "Check node disk space, allocation filters, and shard allocation settings.",
        };
      }
      return { status: "pass", summary: "No shards unassigned due to allocation failure." };
    },
  },
  // #20
  {
    id: "shards.unassigned.reason.primary_failed",
    domain: "shards",
    title: "Unassigned shards: primary failed",
    description: "Fails when unassigned shards have PRIMARY_FAILED reason.",
    severityOnFail: "critical",
    surfaces: ["global"],
    dependsOn: ["shards"],
    evaluate: (snapshot) => {
      const shards = snapshot.data.shards?.catShards;
      if (!shards) return unknownShardsDataResult();
      const matched = shards.filter(
        (s) =>
          s.state === "UNASSIGNED" && (s["unassigned.reason"] ?? "").includes("PRIMARY_FAILED"),
      );
      if (matched.length > 0) {
        return {
          status: "fail",
          summary: `${matched.length} shard${matched.length === 1 ? "" : "s"} unassigned due to PRIMARY_FAILED.`,
          observed: { count: matched.length },
          recommendation:
            "Primary shard failures indicate potential data loss. Investigate immediately.",
        };
      }
      return { status: "pass", summary: "No shards unassigned due to primary failure." };
    },
  },
  // #21
  {
    id: "shards.unassigned.reason.node_left",
    domain: "shards",
    title: "Unassigned shards: node left",
    description: "Warns when unassigned shards are due to NODE_LEFT or NODE_RESTARTING.",
    severityOnFail: "high",
    surfaces: ["global"],
    dependsOn: ["shards"],
    evaluate: (snapshot) => {
      const shards = snapshot.data.shards?.catShards;
      if (!shards) return unknownShardsDataResult();
      const matched = shards.filter((s) => {
        if (s.state !== "UNASSIGNED") return false;
        const reason = s["unassigned.reason"] ?? "";
        return reason.includes("NODE_LEFT") || reason.includes("NODE_RESTARTING");
      });
      if (matched.length > 0) {
        return {
          status: "warn",
          summary: `${matched.length} shard${matched.length === 1 ? "" : "s"} unassigned due to node departure.`,
          observed: { count: matched.length },
          recommendation: "Check for nodes that have recently left the cluster.",
        };
      }
      return { status: "pass", summary: "No shards unassigned due to node departure." };
    },
  },
  // #22
  {
    id: "shards.unassigned.reason.index_closed",
    domain: "shards",
    title: "Unassigned shards: index closed",
    description: "Warns when unassigned shards are due to INDEX_CLOSED.",
    severityOnFail: "low",
    surfaces: ["global"],
    dependsOn: ["shards"],
    evaluate: (snapshot) => {
      const shards = snapshot.data.shards?.catShards;
      if (!shards) return unknownShardsDataResult();
      const matched = shards.filter(
        (s) => s.state === "UNASSIGNED" && (s["unassigned.reason"] ?? "").includes("INDEX_CLOSED"),
      );
      if (matched.length > 0) {
        return {
          status: "warn",
          summary: `${matched.length} shard${matched.length === 1 ? "" : "s"} unassigned due to INDEX_CLOSED.`,
          observed: { count: matched.length },
          recommendation:
            "Closed indices have unassigned shards by design. Reopen or delete if unneeded.",
        };
      }
      return { status: "pass", summary: "No shards unassigned due to closed indices." };
    },
  },
  // #26
  {
    id: "allocation.explain.awareness_constraints",
    domain: "shards",
    title: "Allocation awareness constraints",
    description: "Warns when awareness decider blocks shard allocation.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["allocationSample"],
    evaluate: (snapshot) => {
      const explain = snapshot.data.allocationSample?.allocationExplain;
      if (!explain) return unknownAllocationDataResult();
      const decisions = explain.node_allocation_decisions ?? [];
      const blocked = decisions.filter((d) =>
        d.deciders?.some((dec) => dec.decider === "awareness" && dec.decision === "NO"),
      );
      if (blocked.length > 0) {
        return {
          status: "warn",
          summary: `Awareness decider blocking allocation on ${blocked.length} node${blocked.length === 1 ? "" : "s"}.`,
          observed: { blockedNodes: blocked.map((d) => d.node_name) },
          recommendation: "Review allocation awareness settings and zone distribution.",
        };
      }
      return { status: "pass", summary: "No awareness allocation constraints detected." };
    },
  },
  // #27
  {
    id: "allocation.explain.same_shard_host",
    domain: "shards",
    title: "Same-shard host constraint",
    description: "Warns when same_shard decider blocks allocation.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["allocationSample"],
    evaluate: (snapshot) => {
      const explain = snapshot.data.allocationSample?.allocationExplain;
      if (!explain) return unknownAllocationDataResult();
      const decisions = explain.node_allocation_decisions ?? [];
      const blocked = decisions.filter((d) =>
        d.deciders?.some((dec) => dec.decider === "same_shard" && dec.decision === "NO"),
      );
      if (blocked.length > 0) {
        return {
          status: "warn",
          summary: `Same-shard decider blocking allocation on ${blocked.length} node${blocked.length === 1 ? "" : "s"}.`,
          observed: { blockedNodes: blocked.map((d) => d.node_name) },
          recommendation:
            "Multiple shard copies cannot reside on the same node. Add nodes or reduce replicas.",
        };
      }
      return { status: "pass", summary: "No same-shard allocation constraints detected." };
    },
  },
  // #28
  {
    id: "allocation.explain.max_retry_exceeded",
    domain: "shards",
    title: "Max allocation retry exceeded",
    description: "Warns when max_retry decider blocks allocation.",
    severityOnFail: "high",
    surfaces: ["global"],
    dependsOn: ["allocationSample"],
    evaluate: (snapshot) => {
      const explain = snapshot.data.allocationSample?.allocationExplain;
      if (!explain) return unknownAllocationDataResult();
      const retryInCanAllocate = (explain.can_allocate ?? "").toLowerCase().includes("retry");
      const decisions = explain.node_allocation_decisions ?? [];
      const retryDeciders = decisions.filter((d) =>
        d.deciders?.some((dec) => dec.decider === "max_retry"),
      );
      if (retryInCanAllocate || retryDeciders.length > 0) {
        return {
          status: "warn",
          summary: "Shard allocation retries exhausted.",
          observed: { retryInCanAllocate, retryDeciderNodes: retryDeciders.length },
          recommendation: "Run POST /_cluster/reroute?retry_failed=true to retry allocation.",
        };
      }
      return { status: "pass", summary: "No max-retry allocation issues." };
    },
  },
];
