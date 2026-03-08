import type {
  CatIndexRecord,
  CatShardRecord,
  ClusterAllocationExplainResponse,
  ClusterHealthResponse,
  ClusterPendingTasksResponse,
  GetApiKeysResponse,
  IlmExplainResponse,
  IlmPolicyResponse,
  NodesStatsResponse,
  RecoveryResponse,
  TasksListResponse,
} from "../services/es";

export type HealthStatus = "pass" | "warn" | "fail" | "unknown";
export type HealthSeverity = "low" | "medium" | "high" | "critical";
export type HealthSurface = "global" | "local";

export type HealthQueryGroup =
  | "clusterCore"
  | "shards"
  | "allocationSample"
  | "nodesCore"
  | "tasksCore"
  | "indicesCore"
  | "indexSettings"
  | "ilmCore"
  | "templatesCore"
  | "recoveryCore"
  | "securityCore";

export interface HealthSnapshot {
  fetchedAt: string;
  data: Partial<{
    clusterCore: {
      clusterHealth: ClusterHealthResponse | null;
      pendingTasks: ClusterPendingTasksResponse | null;
    };
    shards: {
      catShards: CatShardRecord[] | null;
    };
    allocationSample: {
      allocationExplain: ClusterAllocationExplainResponse | null;
    };
    nodesCore: {
      nodeStats: NodesStatsResponse | null;
    };
    tasksCore: {
      tasks: TasksListResponse | null;
    };
    indicesCore: {
      catIndices: CatIndexRecord[] | null;
    };
    indexSettings: unknown | null;
    ilmCore: {
      ilmExplain: IlmExplainResponse | null;
      ilmPolicies: IlmPolicyResponse | null;
    };
    templatesCore: unknown | null;
    recoveryCore: {
      recovery: RecoveryResponse | null;
    };
    securityCore: {
      apiKeys: GetApiKeysResponse | null;
    };
  }>;
  errors: Partial<Record<HealthQueryGroup, string>>;
}

export interface HealthLink {
  label: string;
  to: string;
}

export interface HealthCheckResult {
  status: HealthStatus;
  summary: string;
  reason?: string;
  observed?: Record<string, unknown>;
  recommendation?: string;
  links?: HealthLink[];
}

export interface HealthCheckDefinition {
  id: string;
  domain: "cluster" | "nodes" | "indices" | "ilm" | "tasks" | string;
  title: string;
  description: string;
  severityOnFail: HealthSeverity;
  surfaces: HealthSurface[];
  requiredPrivileges?: string[];
  dependsOn: HealthQueryGroup[];
  docsUrl?: string;
  recommendation?: string;
  evaluate: (snapshot: HealthSnapshot) => HealthCheckResult;
}

export interface EvaluatedHealthCheck extends HealthCheckResult {
  id: string;
  domain: string;
  title: string;
  description: string;
  severity: HealthSeverity | null;
  docsUrl?: string;
  definitionRecommendation?: string;
}
