import type { HealthCheckDefinition } from "../types";

export const ilmChecks: HealthCheckDefinition[] = [
  {
    id: "ilm.indices.error",
    domain: "ilm",
    title: "ILM indices in error",
    description: "Fails when ILM-managed indices are stuck in a failed step.",
    severityOnFail: "high",
    surfaces: ["global", "local"],
    dependsOn: ["ilmCore"],
    docsUrl:
      "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/ilm-explain-lifecycle",
    recommendation:
      "Use the ILM Explain API to identify the failed step and error, then fix the root cause and retry the step.",
    evaluate: (snapshot) => {
      const indices = snapshot.data.ilmCore?.ilmExplain?.indices ?? {};
      const failed = Object.entries(indices)
        .filter(([, entry]) => Boolean(entry.failed_step))
        .map(([index, entry]) => ({ index, failedStep: entry.failed_step }));

      if (failed.length > 0) {
        return {
          status: "fail",
          summary: `${failed.length} ILM index${failed.length === 1 ? "" : "es"} in failed state.`,
          observed: { failed: failed.slice(0, 10) },
          links: [{ label: "Resilience", to: "/cluster-resilience" }],
        };
      }
      return { status: "pass", summary: "No ILM indices in failed steps." };
    },
  },
  {
    id: "ilm.policy.missing_or_invalid",
    domain: "ilm",
    title: "ILM missing policies",
    description: "Fails when ILM-managed indices reference lifecycle policies that do not exist.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["ilmCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/ilm-get-lifecycle",
    recommendation:
      "Recreate the missing ILM policy or reassign affected indices to an existing policy.",
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
          observed: { missing: missing.slice(0, 10) },
          links: [{ label: "Resilience", to: "/cluster-resilience" }],
        };
      }
      return { status: "pass", summary: "All ILM-managed indices reference existing policies." };
    },
  },
  {
    id: "ilm.indices.step_info.exception",
    domain: "ilm",
    title: "ILM step exceptions",
    description:
      "Warns when ILM-managed indices have step_info containing error reasons, even if not yet in a failed step.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["ilmCore"],
    docsUrl:
      "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/ilm-explain-lifecycle",
    recommendation:
      "Step info exceptions often precede failed steps. Investigate the reason and fix proactively.",
    evaluate: (snapshot) => {
      const indices = snapshot.data.ilmCore?.ilmExplain?.indices ?? {};
      const withErrors = Object.entries(indices)
        .filter(([, entry]) => entry.managed && entry.step_info?.reason && !entry.failed_step)
        .map(([index, entry]) => ({ index, reason: entry.step_info?.reason }));

      if (withErrors.length > 0) {
        return {
          status: "warn",
          summary: `${withErrors.length} ILM index${withErrors.length === 1 ? "" : "es"} with step exceptions.`,
          observed: { withErrors: withErrors.slice(0, 10) },
          links: [{ label: "Resilience", to: "/cluster-resilience" }],
        };
      }
      return { status: "pass", summary: "No ILM step exceptions." };
    },
  },
  {
    id: "ilm.indices.hot_phase.backlog",
    domain: "ilm",
    title: "ILM hot phase backlog",
    description: "Warns when many ILM-managed indices are stuck in the hot phase.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["ilmCore"],
    docsUrl:
      "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/ilm-explain-lifecycle",
    recommendation:
      "A backlog in the hot phase may indicate rollover is not triggering. Check max_age, max_size, and max_docs conditions.",
    evaluate: (snapshot) => {
      const indices = snapshot.data.ilmCore?.ilmExplain?.indices ?? {};
      const hotIndices = Object.entries(indices).filter(
        ([, entry]) => entry.managed && entry.phase === "hot",
      );
      if (hotIndices.length >= 50) {
        return {
          status: "warn",
          summary: `${hotIndices.length} ILM indices in hot phase — possible rollover backlog.`,
          observed: { hotPhaseCount: hotIndices.length },
          links: [{ label: "Resilience", to: "/cluster-resilience" }],
        };
      }
      return { status: "pass", summary: "Hot phase index count is normal." };
    },
  },
  {
    id: "ilm.indices.unmanaged.ratio",
    domain: "ilm",
    title: "Unmanaged indices ratio",
    description:
      "Warns when a large proportion of indices are not managed by ILM, which may indicate missing lifecycle policies.",
    severityOnFail: "low",
    surfaces: ["global"],
    dependsOn: ["ilmCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/ilm-get-lifecycle",
    recommendation:
      "Unmanaged indices will not be automatically rolled over or deleted. Consider assigning ILM policies to prevent unbounded growth.",
    evaluate: (snapshot) => {
      const indices = snapshot.data.ilmCore?.ilmExplain?.indices ?? {};
      const entries = Object.values(indices);
      if (entries.length === 0) {
        return { status: "pass", summary: "No indices to assess ILM coverage." };
      }
      const unmanaged = entries.filter((e) => !e.managed).length;
      const pct = (unmanaged / entries.length) * 100;
      if (unmanaged >= 10 && pct >= 50) {
        return {
          status: "warn",
          summary: `${unmanaged} of ${entries.length} indices (${pct.toFixed(0)}%) are not ILM-managed.`,
          observed: { unmanaged, total: entries.length, unmanagedPercent: +pct.toFixed(1) },
          links: [{ label: "Resilience", to: "/cluster-resilience" }],
        };
      }
      return { status: "pass", summary: "ILM coverage is adequate." };
    },
  },
];
