import type { HealthCheckDefinition } from "../types";

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
    evaluate: (snapshot) => {
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
          summary: "Elasticsearch Health Report status is RED.",
          observed: { status: report.status, nonGreenIndicators: nonGreen },
          recommendation: "Open Cluster Diagnostics to review impacted indicators and diagnoses.",
          links: [{ label: "Cluster Diagnostics", to: "/cluster-diagnostics" }],
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
    evaluate: (snapshot) => {
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
          summary: "Elasticsearch Health Report status is YELLOW.",
          observed: { status: report.status, nonGreenIndicators: nonGreen },
          recommendation: "Open Cluster Diagnostics to review impacted indicators and diagnoses.",
          links: [{ label: "Cluster Diagnostics", to: "/cluster-diagnostics" }],
        };
      }
      return {
        status: "pass",
        summary: `Health Report status is ${(report.status ?? "unknown").toUpperCase()}.`,
      };
    },
  },
];
