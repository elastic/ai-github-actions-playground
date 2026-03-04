/**
 * catalog.data.mjs
 *
 * Plain-JS data shared between the TypeScript app (catalog.ts) and the
 * Playwright screenshot scripts (screenshot-all.mjs, screenshot-add-data.mjs).
 *
 * Keep this file free of TypeScript syntax so .mjs scripts can import it.
 */

export const ADD_DATA_EXPERIENCE_LABELS = {
  cloud_providers: "Cloud Providers",
  kubernetes: "Kubernetes",
  servers: "Servers, Desktops & Laptops",
  saas_databases: "SaaS & Databases",
  advanced: "Advanced",
};

export const ADD_DATA_EXPERIENCE_DESCRIPTIONS = {
  cloud_providers: "Monitor AWS cloud workloads and VPC flow logs",
  kubernetes: "Collect cluster, node, and workload telemetry",
  servers: "Monitor Linux, Windows, or macOS hosts and VMs",
  saas_databases: "Connect databases and services with OTel receivers",
  advanced: "Configure custom collectors, FluentBit, or APM agents",
};

export const ADD_DATA_PRIMARY_EXPERIENCES = [
  "cloud_providers",
  "kubernetes",
  "servers",
  "saas_databases",
];

/**
 * Minimal technology entries (id, technology, experience, guideType).
 * The full catalog in catalog.ts enriches these with summary, defaultPlatform,
 * supportedEnvironments, expectedSignals, and recommendedNextSteps.
 */
export const ADD_DATA_TECHNOLOGY_ENTRIES = [
  { id: "aws", technology: "AWS", experience: "cloud_providers", guideType: "aws_cloud_deploy" },
  {
    id: "vpc-flow-logs",
    technology: "VPC Flow Logs",
    experience: "cloud_providers",
    guideType: "edot_collector",
  },
  {
    id: "kubernetes",
    technology: "Kubernetes",
    experience: "kubernetes",
    guideType: "edot_collector",
  },
  { id: "docker", technology: "Docker", experience: "kubernetes", guideType: "edot_collector" },
  {
    id: "linux-host",
    technology: "Linux Host",
    experience: "servers",
    guideType: "edot_collector",
  },
  {
    id: "windows-host",
    technology: "Windows Host",
    experience: "servers",
    guideType: "edot_collector",
  },
  {
    id: "macos-host",
    technology: "macOS Host",
    experience: "servers",
    guideType: "edot_collector",
  },
  { id: "nginx", technology: "Nginx", experience: "saas_databases", guideType: "otel_receiver" },
  {
    id: "postgresql",
    technology: "PostgreSQL",
    experience: "saas_databases",
    guideType: "otel_receiver",
  },
  { id: "redis", technology: "Redis", experience: "saas_databases", guideType: "otel_receiver" },
  { id: "mysql", technology: "MySQL", experience: "saas_databases", guideType: "otel_receiver" },
  {
    id: "mongodb",
    technology: "MongoDB",
    experience: "saas_databases",
    guideType: "otel_receiver",
  },
  { id: "java-apm", technology: "Java", experience: "advanced", guideType: "apm" },
  { id: "python-apm", technology: "Python", experience: "advanced", guideType: "apm" },
  { id: "nodejs-apm", technology: "Node.js", experience: "advanced", guideType: "apm" },
  { id: "go-apm", technology: "Go", experience: "advanced", guideType: "apm" },
  { id: "dotnet-apm", technology: ".NET", experience: "advanced", guideType: "apm" },
  { id: "ruby-apm", technology: "Ruby", experience: "advanced", guideType: "apm" },
  { id: "php-apm", technology: "PHP", experience: "advanced", guideType: "apm" },
  { id: "fluent-bit", technology: "Fluent Bit", experience: "advanced", guideType: "fluent_bit" },
];
