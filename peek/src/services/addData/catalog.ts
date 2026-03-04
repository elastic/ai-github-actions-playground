import {
  ADD_DATA_EXPERIENCE_LABELS as _LABELS,
  ADD_DATA_EXPERIENCE_DESCRIPTIONS as _DESCRIPTIONS,
} from "./catalog.data.mjs";

export type AddDataGuideType =
  | "edot_collector"
  | "aws_cloud_deploy"
  | "otel_receiver"
  | "fluent_bit"
  | "apm";

export type AddDataGuidedExperience =
  | "cloud_providers"
  | "kubernetes"
  | "servers"
  | "saas_databases"
  | "advanced";

export type AddDataEnvironment =
  | "kubernetes"
  | "docker"
  | "linux"
  | "macos"
  | "windows"
  | "aws"
  | "gcp"
  | "azure"
  | "on_prem";

export type AddDataExpectedSignal = "logs" | "metrics" | "traces";
export type AddDataInstallPlatform = "kubernetes" | "docker" | "linux" | "macos" | "windows";

export interface AddDataRecommendedNextStep {
  readonly id: string;
  readonly label: string;
  readonly path: string;
}

export interface AddDataTechnologyCatalogEntry {
  readonly id: string;
  readonly technology: string;
  readonly experience: AddDataGuidedExperience;
  readonly guideType: AddDataGuideType;
  readonly summary: string;
  readonly defaultPlatform: AddDataInstallPlatform;
  supportedEnvironments: readonly AddDataEnvironment[];
  expectedSignals: readonly AddDataExpectedSignal[];
  recommendedNextSteps: readonly AddDataRecommendedNextStep[];
}

// Re-export from the shared .mjs data file (single source of truth for labels).
export const ADD_DATA_EXPERIENCE_LABELS = _LABELS as Readonly<
  Record<AddDataGuidedExperience, string>
>;

export const ADD_DATA_EXPERIENCE_DESCRIPTIONS = _DESCRIPTIONS as Readonly<
  Record<AddDataGuidedExperience, string>
>;

export const ADD_DATA_TECHNOLOGY_CATALOG = [
  {
    id: "aws",
    technology: "AWS",
    experience: "cloud_providers",
    guideType: "aws_cloud_deploy",
    summary: "Collect service metrics, logs, and traces from AWS workloads.",
    defaultPlatform: "linux",
    supportedEnvironments: ["aws"],
    expectedSignals: ["metrics", "logs", "traces"],
    recommendedNextSteps: [
      { id: "inspect-aws-health", label: "Explore metrics", path: "/explore" },
      { id: "inspect-aws-logs", label: "Open Query Lab", path: "/discover" },
      { id: "inspect-aws-traces", label: "Open traces", path: "/traces" },
    ],
  },
  {
    id: "vpc-flow-logs",
    technology: "VPC Flow Logs",
    experience: "cloud_providers",
    guideType: "edot_collector",
    summary: "Track network flow telemetry and connection patterns.",
    defaultPlatform: "linux",
    supportedEnvironments: ["aws", "gcp", "azure", "on_prem"],
    expectedSignals: ["logs", "metrics"],
    recommendedNextSteps: [
      { id: "inspect-network-traffic", label: "Open Query Lab", path: "/discover" },
      { id: "inspect-network-metrics", label: "Explore metrics", path: "/explore" },
    ],
  },
  {
    id: "kubernetes",
    technology: "Kubernetes",
    experience: "kubernetes",
    guideType: "edot_collector",
    summary: "Collect cluster, node, and workload telemetry.",
    defaultPlatform: "kubernetes",
    supportedEnvironments: ["kubernetes", "aws", "gcp", "azure", "on_prem"],
    expectedSignals: ["metrics", "logs", "traces"],
    recommendedNextSteps: [
      { id: "view-cluster-metrics", label: "Explore metrics", path: "/explore" },
      { id: "inspect-pod-logs", label: "Open Query Lab", path: "/discover" },
      { id: "review-service-traces", label: "Open traces", path: "/traces" },
    ],
  },
  {
    id: "docker",
    technology: "Docker",
    experience: "kubernetes",
    guideType: "edot_collector",
    summary: "Collect container and host telemetry with Docker Compose.",
    defaultPlatform: "docker",
    supportedEnvironments: ["docker", "linux", "macos", "windows", "on_prem"],
    expectedSignals: ["logs", "metrics", "traces"],
    recommendedNextSteps: [
      { id: "view-host-metrics", label: "Explore metrics", path: "/explore" },
      { id: "inspect-container-logs", label: "Open Query Lab", path: "/discover" },
      { id: "review-container-traces", label: "Open traces", path: "/traces" },
    ],
  },
  {
    id: "linux-host",
    technology: "Linux Host",
    experience: "servers",
    guideType: "edot_collector",
    summary: "Install EDOT Collector on Linux hosts/VMs.",
    defaultPlatform: "linux",
    supportedEnvironments: ["linux", "on_prem", "aws", "gcp", "azure"],
    expectedSignals: ["logs", "metrics"],
    recommendedNextSteps: [
      { id: "view-host-overview", label: "Explore metrics", path: "/explore" },
      { id: "inspect-system-logs", label: "Open Query Lab", path: "/discover" },
    ],
  },
  {
    id: "windows-host",
    technology: "Windows Host",
    experience: "servers",
    guideType: "edot_collector",
    summary: "Install EDOT Collector on Windows hosts/VMs.",
    defaultPlatform: "windows",
    supportedEnvironments: ["windows", "on_prem", "aws", "azure", "gcp"],
    expectedSignals: ["logs", "metrics"],
    recommendedNextSteps: [
      { id: "view-host-overview", label: "Explore metrics", path: "/explore" },
      { id: "inspect-system-logs", label: "Open Query Lab", path: "/discover" },
    ],
  },
  {
    id: "macos-host",
    technology: "macOS Host",
    experience: "servers",
    guideType: "edot_collector",
    summary: "Install EDOT Collector on macOS.",
    defaultPlatform: "macos",
    supportedEnvironments: ["macos", "on_prem"],
    expectedSignals: ["logs", "metrics"],
    recommendedNextSteps: [
      { id: "view-host-overview", label: "Explore metrics", path: "/explore" },
      { id: "inspect-system-logs", label: "Open Query Lab", path: "/discover" },
    ],
  },
  {
    id: "nginx",
    technology: "Nginx",
    experience: "saas_databases",
    guideType: "otel_receiver",
    summary: "Capture request logs and latency metrics.",
    defaultPlatform: "linux",
    supportedEnvironments: ["kubernetes", "docker", "linux", "on_prem"],
    expectedSignals: ["logs", "metrics"],
    recommendedNextSteps: [
      { id: "inspect-nginx-traffic", label: "Open Query Lab", path: "/discover" },
      { id: "check-http-latency", label: "Explore metrics", path: "/explore" },
    ],
  },
  {
    id: "postgresql",
    technology: "PostgreSQL",
    experience: "saas_databases",
    guideType: "otel_receiver",
    summary: "Capture query performance and resource telemetry.",
    defaultPlatform: "linux",
    supportedEnvironments: ["kubernetes", "docker", "linux", "aws", "gcp", "azure", "on_prem"],
    expectedSignals: ["logs", "metrics"],
    recommendedNextSteps: [
      { id: "inspect-db-health", label: "Explore metrics", path: "/explore" },
      { id: "inspect-db-logs", label: "Open Query Lab", path: "/discover" },
    ],
  },
  {
    id: "redis",
    technology: "Redis",
    experience: "saas_databases",
    guideType: "otel_receiver",
    summary: "Monitor Redis performance and memory usage.",
    defaultPlatform: "linux",
    supportedEnvironments: ["kubernetes", "docker", "linux", "aws", "gcp", "azure", "on_prem"],
    expectedSignals: ["metrics"],
    recommendedNextSteps: [
      { id: "inspect-redis-health", label: "Explore metrics", path: "/explore" },
    ],
  },
  {
    id: "mysql",
    technology: "MySQL",
    experience: "saas_databases",
    guideType: "otel_receiver",
    summary: "Monitor MySQL query performance and server status.",
    defaultPlatform: "linux",
    supportedEnvironments: ["kubernetes", "docker", "linux", "aws", "gcp", "azure", "on_prem"],
    expectedSignals: ["metrics"],
    recommendedNextSteps: [
      { id: "inspect-mysql-health", label: "Explore metrics", path: "/explore" },
    ],
  },
  {
    id: "mongodb",
    technology: "MongoDB",
    experience: "saas_databases",
    guideType: "otel_receiver",
    summary: "Monitor MongoDB performance and replica set status.",
    defaultPlatform: "linux",
    supportedEnvironments: ["kubernetes", "docker", "linux", "aws", "gcp", "azure", "on_prem"],
    expectedSignals: ["metrics"],
    recommendedNextSteps: [
      { id: "inspect-mongodb-health", label: "Explore metrics", path: "/explore" },
    ],
  },
  {
    id: "java-apm",
    technology: "Java",
    experience: "advanced",
    guideType: "apm",
    summary: "Auto-instrument Java applications with the Elastic APM agent.",
    defaultPlatform: "linux",
    supportedEnvironments: ["kubernetes", "docker", "linux", "macos", "windows", "on_prem"],
    expectedSignals: ["traces", "metrics"],
    recommendedNextSteps: [
      { id: "view-java-traces", label: "Open traces", path: "/traces" },
      { id: "view-java-metrics", label: "Explore metrics", path: "/explore" },
    ],
  },
  {
    id: "python-apm",
    technology: "Python",
    experience: "advanced",
    guideType: "apm",
    summary: "Auto-instrument Python applications with the Elastic APM agent.",
    defaultPlatform: "linux",
    supportedEnvironments: ["kubernetes", "docker", "linux", "macos", "windows", "on_prem"],
    expectedSignals: ["traces", "metrics"],
    recommendedNextSteps: [
      { id: "view-python-traces", label: "Open traces", path: "/traces" },
      { id: "view-python-metrics", label: "Explore metrics", path: "/explore" },
    ],
  },
  {
    id: "nodejs-apm",
    technology: "Node.js",
    experience: "advanced",
    guideType: "apm",
    summary: "Auto-instrument Node.js applications with the Elastic APM agent.",
    defaultPlatform: "linux",
    supportedEnvironments: ["kubernetes", "docker", "linux", "macos", "windows", "on_prem"],
    expectedSignals: ["traces", "metrics"],
    recommendedNextSteps: [
      { id: "view-nodejs-traces", label: "Open traces", path: "/traces" },
      { id: "view-nodejs-metrics", label: "Explore metrics", path: "/explore" },
    ],
  },
  {
    id: "go-apm",
    technology: "Go",
    experience: "advanced",
    guideType: "apm",
    summary: "Instrument Go applications with the Elastic APM Go agent.",
    defaultPlatform: "linux",
    supportedEnvironments: ["kubernetes", "docker", "linux", "macos", "windows", "on_prem"],
    expectedSignals: ["traces", "metrics"],
    recommendedNextSteps: [
      { id: "view-go-traces", label: "Open traces", path: "/traces" },
      { id: "view-go-metrics", label: "Explore metrics", path: "/explore" },
    ],
  },
  {
    id: "dotnet-apm",
    technology: ".NET",
    experience: "advanced",
    guideType: "apm",
    summary: "Auto-instrument .NET applications with the Elastic APM agent.",
    defaultPlatform: "linux",
    supportedEnvironments: ["kubernetes", "docker", "linux", "macos", "windows", "on_prem"],
    expectedSignals: ["traces", "metrics"],
    recommendedNextSteps: [
      { id: "view-dotnet-traces", label: "Open traces", path: "/traces" },
      { id: "view-dotnet-metrics", label: "Explore metrics", path: "/explore" },
    ],
  },
  {
    id: "ruby-apm",
    technology: "Ruby",
    experience: "advanced",
    guideType: "apm",
    summary: "Auto-instrument Ruby applications with the Elastic APM agent.",
    defaultPlatform: "linux",
    supportedEnvironments: ["kubernetes", "docker", "linux", "macos", "windows", "on_prem"],
    expectedSignals: ["traces", "metrics"],
    recommendedNextSteps: [
      { id: "view-ruby-traces", label: "Open traces", path: "/traces" },
      { id: "view-ruby-metrics", label: "Explore metrics", path: "/explore" },
    ],
  },
  {
    id: "php-apm",
    technology: "PHP",
    experience: "advanced",
    guideType: "apm",
    summary: "Auto-instrument PHP applications with the Elastic APM agent.",
    defaultPlatform: "linux",
    supportedEnvironments: ["kubernetes", "docker", "linux", "macos", "windows", "on_prem"],
    expectedSignals: ["traces", "metrics"],
    recommendedNextSteps: [
      { id: "view-php-traces", label: "Open traces", path: "/traces" },
      { id: "view-php-metrics", label: "Explore metrics", path: "/explore" },
    ],
  },
  {
    id: "fluent-bit",
    technology: "Fluent Bit",
    experience: "advanced",
    guideType: "fluent_bit",
    summary: "Forward logs to Elasticsearch or OTLP endpoints using Fluent Bit.",
    defaultPlatform: "linux",
    supportedEnvironments: ["kubernetes", "docker", "linux", "on_prem"],
    expectedSignals: ["logs"],
    recommendedNextSteps: [
      { id: "inspect-fluent-bit-logs", label: "Open Query Lab", path: "/discover" },
    ],
  },
] as const satisfies readonly AddDataTechnologyCatalogEntry[];

export const ADD_DATA_TECHNOLOGY_BY_ID: ReadonlyMap<string, AddDataTechnologyCatalogEntry> =
  new Map(ADD_DATA_TECHNOLOGY_CATALOG.map((entry) => [entry.id, entry] as const));
