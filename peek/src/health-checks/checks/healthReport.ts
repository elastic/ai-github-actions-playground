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
    recommendation: "Review the non-green indicators below for details.",
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
          recommendation: "Review the non-green indicator checks below for details.",
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
    recommendation: "Review the non-green indicator checks below for details.",
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
          recommendation: "Review the non-green indicator checks below for details.",
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
        description: "Warns when the master node is unstable.",
        severityOnFail: "critical" as HealthSeverity,
      },
      {
        key: "shards_availability",
        title: "Shard availability",
        description: "Warns when shards are unavailable.",
        severityOnFail: "critical" as HealthSeverity,
      },
      {
        key: "disk",
        title: "Disk watermarks",
        description: "Warns when disk watermarks are breached.",
        severityOnFail: "high" as HealthSeverity,
      },
      {
        key: "repository_integrity",
        title: "Repository integrity",
        description: "Warns when snapshot repository integrity is degraded.",
        severityOnFail: "high" as HealthSeverity,
      },
      {
        key: "ilm",
        title: "ILM status",
        description: "Warns when Index Lifecycle Management reports issues.",
        severityOnFail: "medium" as HealthSeverity,
      },
      {
        key: "slm",
        title: "SLM status",
        description: "Warns when Snapshot Lifecycle Management reports issues.",
        severityOnFail: "medium" as HealthSeverity,
      },
      {
        key: "shards_capacity",
        title: "Shard capacity",
        description: "Warns when the cluster is approaching its shard limits.",
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
            status: "unknown",
            summary: `Indicator "${key}" not present in Health Report.`,
          };
        }
        if (indicator.status === "red") {
          return {
            status: "fail",
            summary: indicator.symptom ?? `${title} is RED.`,
            observed: { status: indicator.status },
          };
        }
        if (indicator.status === "yellow") {
          return {
            status: "warn",
            summary: indicator.symptom ?? `${title} is YELLOW.`,
            observed: { status: indicator.status },
          };
        }
        if (indicator.status === "unknown") {
          return {
            status: "unknown",
            summary: indicator.symptom ?? `${title} status is unknown.`,
            observed: { status: indicator.status },
          };
        }
        return {
          status: "pass",
          summary: indicator.symptom ?? `${title} is GREEN.`,
        };
      },
    }),
  ),
];
