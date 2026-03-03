export type AddDataGuideType =
  | "edot_collector"
  | "aws_cloud_deploy"
  | "otel_receiver"
  | "fluent_bit"
  | "apm";

export type AddDataTechnologyCategory =
  | "cloud"
  | "containers"
  | "databases"
  | "applications"
  | "operating_systems"
  | "network";

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
  readonly category: AddDataTechnologyCategory;
  readonly guideType: AddDataGuideType;
  readonly summary: string;
  readonly defaultPlatform: AddDataInstallPlatform;
  readonly recommended: boolean;
  supportedEnvironments: readonly AddDataEnvironment[];
  expectedSignals: readonly AddDataExpectedSignal[];
  recommendedNextSteps: readonly AddDataRecommendedNextStep[];
}

export const ADD_DATA_CATEGORY_LABELS: Readonly<Record<AddDataTechnologyCategory, string>> = {
  cloud: "Cloud",
  containers: "Containers",
  databases: "Databases",
  applications: "Applications",
  operating_systems: "Operating Systems",
  network: "Network",
};

export const ADD_DATA_TECHNOLOGY_CATALOG = [
  {
    id: "aws",
    technology: "AWS",
    category: "cloud",
    guideType: "edot_collector",
    summary: "Collect service metrics, logs, and traces from AWS workloads.",
    defaultPlatform: "linux",
    recommended: false,
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
    category: "network",
    guideType: "edot_collector",
    summary: "Track network flow telemetry and connection patterns.",
    defaultPlatform: "linux",
    recommended: false,
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
    category: "containers",
    guideType: "edot_collector",
    summary: "Collect cluster, node, and workload telemetry.",
    defaultPlatform: "kubernetes",
    recommended: true,
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
    category: "containers",
    guideType: "edot_collector",
    summary: "Collect container and host telemetry with Docker Compose.",
    defaultPlatform: "docker",
    recommended: true,
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
    category: "operating_systems",
    guideType: "edot_collector",
    summary: "Install EDOT Collector on Linux hosts/VMs.",
    defaultPlatform: "linux",
    recommended: true,
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
    category: "operating_systems",
    guideType: "edot_collector",
    summary: "Install EDOT Collector on Windows hosts/VMs.",
    defaultPlatform: "windows",
    recommended: false,
    supportedEnvironments: ["windows", "on_prem", "aws", "azure", "gcp"],
    expectedSignals: ["logs", "metrics"],
    recommendedNextSteps: [
      { id: "view-host-overview", label: "Explore metrics", path: "/explore" },
      { id: "inspect-system-logs", label: "Open Query Lab", path: "/discover" },
    ],
  },
  {
    id: "nginx",
    technology: "Nginx",
    category: "applications",
    guideType: "edot_collector",
    summary: "Capture request logs and latency metrics.",
    defaultPlatform: "linux",
    recommended: false,
    supportedEnvironments: ["kubernetes", "docker", "linux", "on_prem"],
    expectedSignals: ["logs", "metrics", "traces"],
    recommendedNextSteps: [
      { id: "inspect-nginx-traffic", label: "Open Query Lab", path: "/discover" },
      { id: "check-http-latency", label: "Open traces", path: "/traces" },
    ],
  },
  {
    id: "postgresql",
    technology: "PostgreSQL",
    category: "databases",
    guideType: "edot_collector",
    summary: "Capture query performance and resource telemetry.",
    defaultPlatform: "linux",
    recommended: false,
    supportedEnvironments: ["kubernetes", "docker", "linux", "aws", "gcp", "azure", "on_prem"],
    expectedSignals: ["logs", "metrics"],
    recommendedNextSteps: [
      { id: "inspect-db-health", label: "Explore metrics", path: "/explore" },
      { id: "inspect-db-logs", label: "Open Query Lab", path: "/discover" },
    ],
  },
] as const satisfies readonly AddDataTechnologyCatalogEntry[];

export const ADD_DATA_TECHNOLOGY_BY_ID: ReadonlyMap<string, AddDataTechnologyCatalogEntry> =
  new Map(ADD_DATA_TECHNOLOGY_CATALOG.map((entry) => [entry.id, entry] as const));

export function getAddDataTechnologiesByCategory(
  category: AddDataTechnologyCategory,
): readonly AddDataTechnologyCatalogEntry[] {
  return ADD_DATA_TECHNOLOGY_CATALOG.filter((entry) => entry.category === category);
}
