import type { HealthCheckDefinition, HealthSnapshot } from "../types";

function getTransformStats(snapshot: HealthSnapshot) {
  return snapshot.data.transformsCore?.transformStats?.transforms ?? [];
}

export const transformChecks: HealthCheckDefinition[] = [
  {
    id: "transforms.failed",
    domain: "transforms",
    title: "Failed transforms",
    description: "Critical when any transform has state === failed.",
    severityOnFail: "critical",
    surfaces: ["global"],
    dependsOn: ["transformsCore"],
    evaluate: (snapshot) => {
      const transforms = getTransformStats(snapshot);
      const failed = transforms.filter((t) => t.state === "failed");
      if (failed.length > 0) {
        return {
          status: "fail",
          summary: `${failed.length} transform${failed.length === 1 ? "" : "s"} in failed state.`,
          observed: { failedIds: failed.map((t) => t.id).slice(0, 10) },
          recommendation:
            "Investigate failed transforms — they may need to be reset or have underlying data issues fixed.",
          links: [{ label: "Transforms", to: "/transforms" }],
        };
      }
      return { status: "pass", summary: "No transforms in failed state." };
    },
  },
  {
    id: "transforms.health.degraded",
    domain: "transforms",
    title: "Transform health degraded",
    description: 'High when any transform has health.status === "red".',
    severityOnFail: "high",
    surfaces: ["global"],
    dependsOn: ["transformsCore"],
    evaluate: (snapshot) => {
      const transforms = getTransformStats(snapshot);
      const degraded = transforms.filter((t) => t.health?.status === "red");
      if (degraded.length > 0) {
        return {
          status: "warn",
          summary: `${degraded.length} transform${degraded.length === 1 ? "" : "s"} with red health status.`,
          observed: { degradedIds: degraded.map((t) => t.id).slice(0, 10) },
          recommendation:
            "Transforms with red health are experiencing failures. Check search and index failure counts.",
          links: [{ label: "Transforms", to: "/transforms" }],
        };
      }
      return { status: "pass", summary: "All transforms have healthy status." };
    },
  },
  {
    id: "transforms.failures.nonzero",
    domain: "transforms",
    title: "Transforms with non-zero failures",
    description: "Medium when any transform has search_failures + index_failures > 0.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["transformsCore"],
    evaluate: (snapshot) => {
      const transforms = getTransformStats(snapshot);
      const withFailures = transforms.filter(
        (t) => (t.stats?.search_failures ?? 0) + (t.stats?.index_failures ?? 0) > 0,
      );
      if (withFailures.length > 0) {
        return {
          status: "warn",
          summary: `${withFailures.length} transform${withFailures.length === 1 ? "" : "s"} with non-zero failure counts.`,
          observed: {
            transforms: withFailures.slice(0, 10).map((t) => ({
              id: t.id,
              searchFailures: t.stats?.search_failures ?? 0,
              indexFailures: t.stats?.index_failures ?? 0,
            })),
          },
          recommendation:
            "Review transforms with failures. Search failures may indicate source index issues; index failures may indicate mapping conflicts or disk pressure.",
          links: [{ label: "Transforms", to: "/transforms" }],
        };
      }
      return { status: "pass", summary: "No transforms with failure counts." };
    },
  },
];
