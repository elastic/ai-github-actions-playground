import type { ElasticsearchConnection } from "../services/es";

export type { ElasticsearchConnection, EsqlColumn, EsqlResponse, EsqlError } from "../services/es";

export interface ConnectionProfile {
  id: string;
  name: string;
  connection: ElasticsearchConnection;
  /** When true, credentials are stored encrypted (AES-GCM) in localStorage and must be unlocked with a PIN each session. */
  encrypted?: boolean;
}

export type ProfileHealthStatus = "healthy" | "needs_attention" | "unknown";

export interface ProfileHealth {
  status: ProfileHealthStatus;
  checkedAt: string | null;
  errorSummary: string | null;
}
