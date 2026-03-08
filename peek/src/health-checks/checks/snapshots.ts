import type { HealthCheckDefinition } from "../types";

function snapshotsCoreUnavailable(snapshot: Parameters<HealthCheckDefinition["evaluate"]>[0]) {
  if (snapshot.errors.snapshotsCore) {
    return {
      status: "unknown" as const,
      summary: "Snapshot data could not be loaded.",
      reason: snapshot.errors.snapshotsCore,
    };
  }
  if (!snapshot.data.snapshotsCore) {
    return {
      status: "unknown" as const,
      summary: "Snapshot data is unavailable.",
    };
  }
  return null;
}

export const snapshotChecks: HealthCheckDefinition[] = [
  {
    id: "snapshots.failed.recent",
    domain: "snapshots",
    title: "Failed snapshots",
    description: "Warns if any snapshots are in FAILED state.",
    severityOnFail: "high",
    surfaces: ["global"],
    dependsOn: ["snapshotsCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/get-snapshot-api",
    recommendation: "Investigate failed snapshots and check repository connectivity.",
    evaluate: (snapshot) => {
      const unavailable = snapshotsCoreUnavailable(snapshot);
      if (unavailable) return unavailable;
      const snapshots = snapshot.data.snapshotsCore?.snapshots ?? [];
      const failed = snapshots.filter((s) => s.state === "FAILED");
      if (failed.length > 0) {
        return {
          status: "warn",
          summary: `${failed.length} snapshot${failed.length === 1 ? "" : "s"} in FAILED state.`,
          observed: { failedCount: failed.length },
          recommendation: "Investigate failed snapshots and check repository connectivity.",
          links: [{ label: "Snapshots", to: "/snapshots" }],
        };
      }
      return { status: "pass", summary: "No failed snapshots." };
    },
  },
  {
    id: "snapshots.partial.recent",
    domain: "snapshots",
    title: "Partial snapshots",
    description: "Warns if snapshots completed with partial shard failures.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["snapshotsCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/get-snapshot-api",
    recommendation: "Partial snapshots indicate some shards failed to snapshot.",
    evaluate: (snapshot) => {
      const unavailable = snapshotsCoreUnavailable(snapshot);
      if (unavailable) return unavailable;
      const snapshots = snapshot.data.snapshotsCore?.snapshots ?? [];
      const partial = snapshots.filter((s) => s.state === "PARTIAL");
      if (partial.length > 0) {
        return {
          status: "warn",
          summary: `${partial.length} snapshot${partial.length === 1 ? "" : "s"} in PARTIAL state.`,
          observed: { partialCount: partial.length },
          recommendation: "Partial snapshots indicate some shards failed to snapshot.",
          links: [{ label: "Snapshots", to: "/snapshots" }],
        };
      }
      return { status: "pass", summary: "No partial snapshots." };
    },
  },
  {
    id: "slm.policy.failing",
    domain: "snapshots",
    title: "SLM policy failing",
    description: "Fails if any SLM policy has last_failure more recent than last_success.",
    severityOnFail: "high",
    surfaces: ["global"],
    dependsOn: ["snapshotsCore"],
    docsUrl:
      "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/get-snapshot-lifecycle-management-policy",
    recommendation: "Check SLM policy configuration and repository health.",
    evaluate: (snapshot) => {
      const unavailable = snapshotsCoreUnavailable(snapshot);
      if (unavailable) return unavailable;
      const policies = snapshot.data.snapshotsCore?.policies ?? {};
      const failingPolicies = Object.entries(policies).filter(([, p]) => {
        const lastSuccess = p.last_success?.time ?? 0;
        const lastFailure = p.last_failure?.time ?? 0;
        return lastFailure > 0 && lastFailure > lastSuccess;
      });
      if (failingPolicies.length > 0) {
        const names = failingPolicies.map(([name]) => name);
        return {
          status: "fail",
          summary: `${failingPolicies.length} SLM ${failingPolicies.length === 1 ? "policy is" : "policies are"} failing: ${names.join(", ")}`,
          observed: { failingPolicies: names },
          recommendation: "Check SLM policy configuration and repository health.",
          links: [{ label: "SLM Policies", to: "/snapshots?tab=policies" }],
        };
      }
      return { status: "pass", summary: "All SLM policies are healthy." };
    },
  },
  {
    id: "slm.policy.no_recent_success",
    domain: "snapshots",
    title: "SLM policy no recent success",
    description: "Warns if a policy hasn't succeeded recently relative to its schedule.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["snapshotsCore"],
    docsUrl:
      "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/get-snapshot-lifecycle-management-policy",
    recommendation: "Verify SLM schedule and repository availability.",
    evaluate: (snapshot) => {
      const unavailable = snapshotsCoreUnavailable(snapshot);
      if (unavailable) return unavailable;
      const policies = snapshot.data.snapshotsCore?.policies ?? {};
      const now = Date.now();
      const stale = Object.entries(policies).filter(([, p]) => {
        const lastSuccess = p.last_success?.time ?? 0;
        const nextExecution = p.next_execution_millis ?? 0;
        // Don't flag policies that haven't run yet but have a future scheduled run
        if (!lastSuccess && nextExecution > now) return false;
        if (!lastSuccess) return true;
        // Use 2x the interval between now and next execution as grace window, or 48h default
        const interval = nextExecution > now ? nextExecution - now : 0;
        const grace = interval > 0 ? interval * 2 : 48 * 60 * 60 * 1000;
        return now - lastSuccess > grace;
      });
      if (stale.length > 0) {
        const names = stale.map(([name]) => name);
        return {
          status: "warn",
          summary: `${stale.length} SLM ${stale.length === 1 ? "policy has" : "policies have"} no recent success.`,
          observed: { stalePolicies: names },
          recommendation: "Verify SLM schedule and repository availability.",
          links: [{ label: "SLM Policies", to: "/snapshots?tab=policies" }],
        };
      }
      return { status: "pass", summary: "All SLM policies have recent successes." };
    },
  },
  {
    id: "slm.retention.failures",
    domain: "snapshots",
    title: "SLM retention deletion failures",
    description: "Warns if snapshot retention deletions have failures.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["snapshotsCore"],
    docsUrl:
      "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/get-snapshot-lifecycle-management-stats",
    recommendation: "Check repository permissions and disk space for retention cleanups.",
    evaluate: (snapshot) => {
      const unavailable = snapshotsCoreUnavailable(snapshot);
      if (unavailable) return unavailable;
      const slmStats = snapshot.data.snapshotsCore?.slmStats;
      const failures = slmStats?.total_snapshot_deletion_failures ?? 0;
      if (failures > 0) {
        return {
          status: "warn",
          summary: `${failures} snapshot retention deletion failure${failures === 1 ? "" : "s"}.`,
          observed: { deletionFailures: failures },
          recommendation: "Check repository permissions and disk space for retention cleanups.",
          links: [{ label: "Snapshots", to: "/snapshots" }],
        };
      }
      return { status: "pass", summary: "No snapshot retention deletion failures." };
    },
  },
];
