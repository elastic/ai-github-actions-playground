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

export interface AddDataRecommendedNextStep {
  readonly id: string;
  readonly label: string;
  readonly path: string;
}

export interface AddDataTechnologyCatalogEntry {
  readonly id: string;
  readonly technology: string;
  readonly category: AddDataTechnologyCategory;
  supportedEnvironments: readonly AddDataEnvironment[];
  expectedSignals: readonly AddDataExpectedSignal[];
  recommendedNextSteps: readonly AddDataRecommendedNextStep[];
}

export const ADD_DATA_TECHNOLOGY_CATALOG = [
  {
    id: "aws",
    technology: "AWS",
    category: "cloud",
    supportedEnvironments: ["aws"],
    expectedSignals: ["logs", "metrics", "traces"],
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
    supportedEnvironments: ["kubernetes", "aws", "gcp", "azure", "on_prem"],
    expectedSignals: ["logs", "metrics", "traces"],
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
    technology: "Linux host",
    category: "operating_systems",
    supportedEnvironments: ["linux", "on_prem", "aws", "gcp", "azure"],
    expectedSignals: ["logs", "metrics"],
    recommendedNextSteps: [
      { id: "view-host-overview", label: "Explore metrics", path: "/explore" },
      { id: "inspect-system-logs", label: "Open Query Lab", path: "/discover" },
    ],
  },
  {
    id: "windows-host",
    technology: "Windows host",
    category: "operating_systems",
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
