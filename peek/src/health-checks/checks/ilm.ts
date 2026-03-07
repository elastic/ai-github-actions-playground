import type { HealthCheckDefinition } from "../types";

export const ilmChecks: HealthCheckDefinition[] = [
  // #96
  {
    id: "ilm.indices.error.present",
    domain: "ilm",
    title: "ILM indices in error",
    description: "Fails when ILM-managed indices are in a failed step.",
    severityOnFail: "high",
    surfaces: ["global", "local"],
    dependsOn: ["ilmCore"],
    evaluate: (snapshot) => {
      const indices = snapshot.data.ilmCore?.ilmExplain?.indices ?? {};
      const failed = Object.entries(indices)
        .filter(([, entry]) => Boolean(entry.failed_step))
        .map(([index, entry]) => ({ index, failedStep: entry.failed_step }));

      if (failed.length > 0) {
        return {
          status: "fail",
          summary: `${failed.length} ILM index${failed.length === 1 ? "" : "es"} in failed state.`,
          observed: { failed_count: failed.length, failed: failed.slice(0, 10) },
          recommendation: "Retry the failed ILM step or fix the underlying issue.",
          links: [{ label: "Resilience", to: "/cluster-resilience" }],
        };
      }
      return { status: "pass", summary: "No ILM indices in failed steps." };
    },
  },
  // #101
  {
    id: "ilm.policy.missing",
    domain: "ilm",
    title: "ILM missing policies",
    description: "Fails when ILM-managed indices reference missing lifecycle policies.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["ilmCore"],
    evaluate: (snapshot) => {
      const indices = snapshot.data.ilmCore?.ilmExplain?.indices ?? {};
      const policyNames = new Set(Object.keys(snapshot.data.ilmCore?.ilmPolicies ?? {}));
      const missing = Object.entries(indices)
        .filter(
          ([, entry]) => entry.managed && Boolean(entry.policy) && !policyNames.has(entry.policy!),
        )
        .map(([index, entry]) => ({ index, policy: entry.policy }));

      if (missing.length > 0) {
        return {
          status: "fail",
          summary: `${missing.length} index${missing.length === 1 ? "" : "es"} reference missing ILM policies.`,
          observed: { missing_count: missing.length, missing: missing.slice(0, 10) },
          recommendation: "Create the missing ILM policies or update index settings.",
          links: [{ label: "Resilience", to: "/cluster-resilience" }],
        };
      }
      return { status: "pass", summary: "All ILM-managed indices reference existing policies." };
    },
  },
];
