/** Types for the OTel Input Package Builder. */

export type FormatVersion = "3.5.0" | "3.6.0";
export type OwnerType = "elastic" | "partner" | "community";
export type SubscriptionLevel = "basic" | "gold" | "platinum" | "enterprise";
export type SignalType = "metrics" | "logs" | "traces" | "synthetics" | "profiles";

export type VariableType =
  | "bool"
  | "email"
  | "integer"
  | "password"
  | "select"
  | "text"
  | "textarea"
  | "time_zone"
  | "url"
  | "yaml"
  | "duration";

export interface SelectOption {
  text: string;
  value: string;
}

export interface PackageVariable {
  name: string;
  type: VariableType;
  title: string;
  description: string;
  default: string;
  required: boolean;
  showUser: boolean;
  multi: boolean;
  secret: boolean;
  options: SelectOption[]; // only used when type === "select"
}

export interface PackageIcon {
  name: string;
  dataUrl: string; // base64 data URL for preview
  rawBytes: Uint8Array;
  mimeType: string;
}

export interface PackageIdentity {
  name: string;
  title: string;
  description: string;
  version: string;
  formatVersion: FormatVersion;
  ownerGithub: string;
  ownerType: OwnerType;
  categories: string[];
  kibanaVersion: string;
  subscription: SubscriptionLevel;
  icon: PackageIcon | null;
}

export interface PolicyTemplate {
  name: string;
  title: string;
  description: string;
  signalTypes: SignalType[];
  dynamicSignalTypes: boolean;
}

export interface PackageBuilderData {
  identity: PackageIdentity;
  policyTemplate: PolicyTemplate;
  variables: PackageVariable[];
  templateContent: string;
  readmeContent: string;
}

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

/** Well-known categories from the Elastic integrations ecosystem. */
export const PACKAGE_CATEGORIES = [
  "opentelemetry",
  "web",
  "datastore",
  "monitoring",
  "os_system",
  "observability",
  "cloud",
  "containers",
  "kubernetes",
  "message_queue",
  "network",
  "security",
  "custom",
  "infrastructure",
  "productivity",
  "aws",
  "azure",
  "google_cloud",
  "languages",
  "load_balancer",
  "stream_processing",
  "ticketing",
  "version_control",
  "virtualization",
  "cdn_security",
  "dns_security",
  "email_security",
  "firewall_security",
  "iam",
  "ids_ips",
  "notification",
  "proxy_security",
  "threat_intel",
  "voip",
  "vpn_security",
  "vulnerability_management",
  "websphere",
] as const;

/** Secret name patterns that should auto-enable secret: true. */
const SECRET_PATTERNS = [/key$/i, /password/i, /token/i, /secret/i];
const SECRET_EXCLUDE_PATTERNS = [/_file$/i, /_url$/i];

export function shouldAutoSecret(name: string): boolean {
  if (SECRET_EXCLUDE_PATTERNS.some((p) => p.test(name))) return false;
  return SECRET_PATTERNS.some((p) => p.test(name));
}

export function createDefaultVariable(): PackageVariable {
  return {
    name: "",
    type: "text",
    title: "",
    description: "",
    default: "",
    required: false,
    showUser: true,
    multi: false,
    secret: false,
    options: [],
  };
}

export const VARIABLE_TYPE_LABELS: Record<VariableType, string> = {
  bool: "Boolean",
  email: "Email",
  integer: "Integer",
  password: "Password",
  select: "Select (dropdown)",
  text: "Text",
  textarea: "Text area",
  time_zone: "Time zone",
  url: "URL",
  yaml: "YAML",
  duration: "Duration",
};

/** Starter OTel Collector templates for common receivers. */
export const STARTER_TEMPLATES: Record<string, string> = {
  blank: `receivers:
  # Configure your OTel receiver here

processors:
  resourcedetection/system:
    detectors: ["system"]

service:
  pipelines:
    metrics:
      receivers: []
      processors: [resourcedetection/system]
`,
  apache: `receivers:
  apache:
    endpoint: {{yaml endpoint}}
    collection_interval: {{yaml collection_interval}}

processors:
  resourcedetection/system:
    detectors: ["system"]

service:
  pipelines:
    metrics:
      receivers: [apache]
      processors: [resourcedetection/system]
`,
  redis: `receivers:
  redis:
    endpoint: {{yaml endpoint}}
    collection_interval: {{yaml collection_interval}}
{{#if password}}
    password: {{yaml password}}
{{/if}}

processors:
  resourcedetection/system:
    detectors: ["system"]

service:
  pipelines:
    metrics:
      receivers: [redis]
      processors: [resourcedetection/system]
`,
  mysql: `receivers:
  mysql:
    endpoint: {{yaml endpoint}}
    username: {{yaml username}}
    password: {{yaml password}}
    collection_interval: {{yaml collection_interval}}
{{#if tls_enabled}}
    tls:
      insecure: false
{{#if tls_ca_file}}
      ca_file: {{yaml tls_ca_file}}
{{/if}}
{{/if}}

processors:
  resourcedetection/system:
    detectors: ["system"]

service:
  pipelines:
    metrics:
      receivers: [mysql]
      processors: [resourcedetection/system]
`,
  prometheus: `receivers:
  prometheus:
    config:
      scrape_configs:
        - job_name: {{yaml job_name}}
          scrape_interval: {{yaml scrape_interval}}
          static_configs:
            - targets: [{{yaml endpoint}}]

processors:
  resourcedetection/system:
    detectors: ["system"]

service:
  pipelines:
    metrics:
      receivers: [prometheus]
      processors: [resourcedetection/system]
`,
  hostmetrics: `receivers:
  hostmetrics:
    collection_interval: {{yaml collection_interval}}
    scrapers:
      cpu: {}
      disk: {}
      filesystem: {}
      load: {}
      memory: {}
      network: {}
      process: {}

processors:
  resourcedetection/system:
    detectors: ["system"]

service:
  pipelines:
    metrics:
      receivers: [hostmetrics]
      processors: [resourcedetection/system]
`,
};
