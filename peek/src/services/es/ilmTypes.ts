// ---------------------------------------------------------------------------
// ILM (Index Lifecycle Management) API types
// ---------------------------------------------------------------------------

/** Phase definition inside an ILM policy. */
export interface IlmPhaseDefinition {
  min_age?: string;
  actions?: Record<string, unknown>;
}

/** A single ILM policy. */
export interface IlmPolicy {
  version?: number;
  modified_date?: string;
  modified_date_string?: string;
  policy?: {
    phases?: Record<string, IlmPhaseDefinition>;
    _meta?: Record<string, unknown>;
  };
  in_use_by?: {
    indices?: string[];
    data_streams?: string[];
    composable_templates?: string[];
  };
}

/** Response from GET /_ilm/policy */
export type GetIlmPoliciesResponse = Record<string, IlmPolicy>;

/** Extended ILM explain status per index (richer than the clusterTypes version). */
export interface IlmExplainIndexDetail {
  index?: string;
  managed?: boolean;
  policy?: string;
  phase?: string;
  action?: string;
  step?: string;
  failed_step?: string;
  is_auto_retryable_error?: boolean;
  failed_step_retry_count?: number;
  step_info?: {
    reason?: string;
    type?: string;
    [key: string]: unknown;
  };
  phase_time_millis?: number;
  age?: string;
  phase_execution?: {
    policy?: string;
    version?: number;
    phase_definition?: IlmPhaseDefinition;
    modified_date_in_millis?: number;
  };
  lifecycle_date_millis?: number;
  time_since_index_creation?: string;
}

/** Response from GET /{index}/_ilm/explain */
export interface IlmExplainDetailResponse {
  indices?: Record<string, IlmExplainIndexDetail>;
}

/** Flattened ILM index row for the table. */
export interface IlmIndexRow {
  index: string;
  policy: string;
  phase: string;
  action: string;
  step: string;
  age: string;
  failedStep: string;
  isError: boolean;
  stepReason: string;
  raw?: IlmExplainIndexDetail;
}

/** Flattened ILM policy row for the policies table. */
export interface IlmPolicyRow {
  name: string;
  version: number;
  modifiedDate: string;
  phases: string[];
  indexCount: number;
  dataStreamCount: number;
  templateCount: number;
  raw?: IlmPolicy;
}
