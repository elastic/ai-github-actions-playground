import type { HealthCheckDefinition, HealthSeverity } from "../types";

export const healthReportChecks: HealthCheckDefinition[] = [
  {
    id: "cluster.health_report.red",
    domain: "cluster",
    title: "Health Report: cluster RED",
    description:
      "Fails when the Elasticsearch Health Report API reports overall cluster status as red.",
    severityOnFail: "critical",
    surfaces: ["global"],
    dependsOn: ["healthReport"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/health-api",
    recommendation:
      "Review non-green indicators in the Health Report API response for details, including indicators without dedicated checks.",
    evaluate: (snapshot) => {
      if (snapshot.errors.healthReport) {
        return {
          status: "unknown",
          summary: "Health Report data could not be loaded.",
          reason: snapshot.errors.healthReport,
        };
      }
      const report = snapshot.data.healthReport?.healthReport;
      if (!report) {
        return {
          status: "unknown",
          summary: "Health Report data is unavailable (requires ES 8.7+).",
        };
      }
      if (report.status === "red") {
        const nonGreen = Object.entries(report.indicators ?? {})
          .filter(([, ind]) => ind.status !== "green")
          .map(([key]) => key);
        return {
          status: "fail",
          summary: `Elasticsearch Health Report status is RED. Non-green indicators: ${nonGreen.join(", ") || "none"}.`,
          observed: { status: report.status, nonGreenIndicators: nonGreen },
          recommendation:
            "Review non-green indicators in the Health Report API response for details, including indicators without dedicated checks.",
        };
      }
      if (report.status !== "green" && report.status !== "yellow") {
        return {
          status: "unknown",
          summary: "Health Report status is UNKNOWN.",
        };
      }
      return {
        status: "pass",
        summary: `Health Report status is ${(report.status ?? "unknown").toUpperCase()}.`,
      };
    },
  },
  {
    id: "cluster.health_report.yellow",
    domain: "cluster",
    title: "Health Report: cluster YELLOW",
    description:
      "Warns when the Elasticsearch Health Report API reports overall cluster status as yellow.",
    severityOnFail: "high",
    surfaces: ["global"],
    dependsOn: ["healthReport"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/health-api",
    recommendation:
      "Review non-green indicators in the Health Report API response for details, including indicators without dedicated checks.",
    evaluate: (snapshot) => {
      if (snapshot.errors.healthReport) {
        return {
          status: "unknown",
          summary: "Health Report data could not be loaded.",
          reason: snapshot.errors.healthReport,
        };
      }
      const report = snapshot.data.healthReport?.healthReport;
      if (!report) {
        return {
          status: "unknown",
          summary: "Health Report data is unavailable (requires ES 8.7+).",
        };
      }
      if (report.status === "yellow") {
        const nonGreen = Object.entries(report.indicators ?? {})
          .filter(([, ind]) => ind.status !== "green")
          .map(([key]) => key);
        return {
          status: "warn",
          summary: `Elasticsearch Health Report status is YELLOW. Non-green indicators: ${nonGreen.join(", ") || "none"}.`,
          observed: { status: report.status, nonGreenIndicators: nonGreen },
          recommendation:
            "Review non-green indicators in the Health Report API response for details, including indicators without dedicated checks.",
        };
      }
      if (report.status !== "green" && report.status !== "red") {
        return {
          status: "unknown",
          summary: "Health Report status is UNKNOWN.",
        };
      }
      return {
        status: "pass",
        summary: `Health Report status is ${(report.status ?? "unknown").toUpperCase()}.`,
      };
    },
  },
  // ── Per-indicator checks ─────────────────────────────────────────────
  ...(
    [
      {
        key: "master_is_stable",
        title: "Master stability",
        description: "Flags master node instability.",
        severityOnFail: "critical" as HealthSeverity,
      },
      {
        key: "shards_availability",
        title: "Shard availability",
        description: "Flags unavailable shards.",
        severityOnFail: "critical" as HealthSeverity,
      },
      {
        key: "disk",
        title: "Disk watermarks",
        description: "Flags breached disk watermarks.",
        severityOnFail: "high" as HealthSeverity,
      },
      {
        key: "repository_integrity",
        title: "Repository integrity",
        description: "Flags degraded snapshot repository integrity.",
        severityOnFail: "high" as HealthSeverity,
      },
      {
        key: "ilm",
        title: "ILM status",
        description: "Flags Index Lifecycle Management issues.",
        severityOnFail: "medium" as HealthSeverity,
      },
      {
        key: "slm",
        title: "SLM status",
        description: "Flags Snapshot Lifecycle Management issues.",
        severityOnFail: "medium" as HealthSeverity,
      },
      {
        key: "shards_capacity",
        title: "Shard capacity",
        description: "Flags when the cluster approaches shard limits.",
        severityOnFail: "medium" as HealthSeverity,
      },
    ] as const
  ).map(
    ({ key, title, description, severityOnFail }): HealthCheckDefinition => ({
      id: `cluster.health_report.indicator.${key}`,
      domain: "cluster",
      title: `Health Report: ${title}`,
      description,
      severityOnFail,
      surfaces: ["global"],
      dependsOn: ["healthReport"],
      docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/health-api",
      recommendation: `Review the ${title.toLowerCase()} indicator in the Elasticsearch Health Report API for details.`,
      evaluate: (snapshot) => {
        if (snapshot.errors.healthReport) {
          return {
            status: "unknown",
            summary: "Health Report data could not be loaded.",
            reason: snapshot.errors.healthReport,
          };
        }
        const report = snapshot.data.healthReport?.healthReport;
        if (!report) {
          return {
            status: "unknown",
            summary: "Health Report data is unavailable (requires ES 8.7+).",
          };
        }
        const indicator = report.indicators?.[key];
        if (!indicator) {
          return {
            status: "pass",
            summary: `Indicator "${key}" not present in Health Report.`,
          };
        }
        const indicatorStatus = indicator.status as string | undefined;
        if (indicatorStatus === "red") {
          return {
            status: "fail",
            summary: indicator.symptom ?? `${title} is RED.`,
            observed: { status: indicatorStatus },
          };
        }
        if (indicatorStatus === "yellow") {
          return {
            status: "warn",
            summary: indicator.symptom ?? `${title} is YELLOW.`,
            observed: { status: indicatorStatus },
          };
        }
        if (indicatorStatus === "unknown" || indicatorStatus === "unavailable") {
          return {
            status: "unknown",
            summary: indicator.symptom ?? `${title} status is ${indicatorStatus}.`,
            observed: { status: indicatorStatus },
          };
        }
        if (indicatorStatus === "green") {
          return {
            status: "pass",
            summary: indicator.symptom ?? `${title} is GREEN.`,
          };
        }
        return {
          status: "unknown",
          summary: indicator.symptom ?? `${title} status is ${indicatorStatus}.`,
          observed: { status: indicatorStatus },
        };
      },
    }),
  ),
];
