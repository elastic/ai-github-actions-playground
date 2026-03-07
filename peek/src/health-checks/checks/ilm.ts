import type { HealthCheckDefinition } from "../types";

const ILM_DELETE_BACKLOG = 50;
const ILM_HOT_BACKLOG = 100;

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
  // #98
  {
    id: "ilm.indices.step_info.exception.present",
    domain: "ilm",
    title: "ILM step info exceptions",
    description: "Warns when ILM indices have step_info with error reasons.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["ilmCore"],
    evaluate: (snapshot) => {
      const indices = snapshot.data.ilmCore?.ilmExplain?.indices ?? {};
      const withExceptions = Object.entries(indices)
        .filter(([, entry]) => Boolean(entry.step_info?.reason))
        .map(([index]) => index);
      if (withExceptions.length > 0) {
        return {
          status: "warn",
          summary: `${withExceptions.length} ILM index${withExceptions.length === 1 ? "" : "es"} with step exceptions.`,
          observed: { count: withExceptions.length, indices: withExceptions.slice(0, 10) },
          recommendation: "Review ILM step errors and retry or fix the underlying issue.",
        };
      }
      return { status: "pass", summary: "No ILM step info exceptions." };
    },
  },
  // #99
  {
    id: "ilm.phase.delete_backlog",
    domain: "ilm",
    title: "ILM delete phase backlog",
    description: `Warns when > ${ILM_DELETE_BACKLOG} indices are stuck in the delete phase.`,
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["ilmCore"],
    evaluate: (snapshot) => {
      const indices = snapshot.data.ilmCore?.ilmExplain?.indices ?? {};
      const inDelete = Object.entries(indices).filter(
        ([, entry]) => entry.managed && entry.phase === "delete",
      );
      if (inDelete.length > ILM_DELETE_BACKLOG) {
        return {
          status: "warn",
          summary: `${inDelete.length} indices in ILM delete phase.`,
          observed: { count: inDelete.length },
          recommendation:
            "Large delete backlogs may indicate permission issues or slow snapshot cleanup.",
        };
      }
      return {
        status: "pass",
        summary: `Delete phase backlog (${inDelete.length}) within threshold.`,
      };
    },
  },
  // #100
  {
    id: "ilm.phase.hot_backlog",
    domain: "ilm",
    title: "ILM hot phase backlog",
    description: `Warns when > ${ILM_HOT_BACKLOG} managed indices remain in the hot phase.`,
    severityOnFail: "low",
    surfaces: ["global"],
    dependsOn: ["ilmCore"],
    evaluate: (snapshot) => {
      const indices = snapshot.data.ilmCore?.ilmExplain?.indices ?? {};
      const inHot = Object.entries(indices).filter(
        ([, entry]) => entry.managed && entry.phase === "hot",
      );
      if (inHot.length > ILM_HOT_BACKLOG) {
        return {
          status: "warn",
          summary: `${inHot.length} indices still in ILM hot phase.`,
          observed: { count: inHot.length },
          recommendation:
            "Many indices lingering in hot phase may indicate misconfigured rollover.",
        };
      }
      return { status: "pass", summary: `Hot phase indices (${inHot.length}) within threshold.` };
    },
  },
  // #102
  {
    id: "ilm.policy.invalid_action_config",
    domain: "ilm",
    title: "ILM invalid action configuration",
    description: "Warns when ILM step_info indicates an invalid action configuration.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["ilmCore"],
    evaluate: (snapshot) => {
      const indices = snapshot.data.ilmCore?.ilmExplain?.indices ?? {};
      const invalid = Object.entries(indices)
        .filter(([, entry]) => {
          const reason = (entry.step_info?.reason ?? "").toLowerCase();
          return reason.includes("invalid") || reason.includes("illegal_argument");
        })
        .map(([index]) => index);
      if (invalid.length > 0) {
        return {
          status: "warn",
          summary: `${invalid.length} index${invalid.length === 1 ? "" : "es"} with invalid ILM action config.`,
          observed: { count: invalid.length, indices: invalid.slice(0, 10) },
          recommendation: "Review and correct the ILM policy action configuration.",
        };
      }
      return { status: "pass", summary: "No invalid ILM action configurations detected." };
    },
  },
];
