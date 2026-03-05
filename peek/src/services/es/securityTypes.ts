// ---------------------------------------------------------------------------
// Security types — users, roles, API keys, capabilities
// ---------------------------------------------------------------------------

export interface SecurityUser {
  username: string;
  enabled?: boolean;
  roles?: string[];
  full_name?: string | null;
  email?: string | null;
  metadata?: Record<string, unknown>;
}

export interface SecurityRoleIndexPrivilege {
  names?: string[];
  privileges?: string[];
}

export interface SecurityRole {
  cluster?: string[];
  indices?: SecurityRoleIndexPrivilege[];
  run_as?: string[];
  metadata?: Record<string, unknown>;
}

export type GetSecurityUsersResponse = Record<string, SecurityUser>;
export type GetSecurityRolesResponse = Record<string, SecurityRole>;

/** One API key entry returned by GET /_security/api_key */
export interface ApiKeyInfo {
  id: string;
  name: string;
  username: string;
  creation: number;
  expiration?: number | null;
  invalidated: boolean;
  role_descriptors?: Record<
    string,
    {
      cluster?: string[];
      indices?: Array<{ privileges?: string[] }>;
    }
  >;
  metadata?: Record<string, unknown>;
  realm?: string;
}

export interface GetApiKeysResponse {
  api_keys: ApiKeyInfo[];
}

/**
 * Capabilities derived from the user's API key / credentials.
 * Used to gate UI features based on what the user is allowed to do.
 */
export interface UserCapabilities {
  /** Whether the user can manage data streams (create, delete, rollover, etc.) */
  canManageDataStreams: boolean;
  /** Whether the user can create API keys for collector onboarding flows. */
  canCreateApiKeys: boolean;
  /** Whether the user can read user definitions from the security API. */
  canReadSecurityUsers: boolean;
  /** Whether the user can read role definitions from the security API. */
  canReadSecurityRoles: boolean;
  /** Whether the user can list/query API keys for audit. */
  canReadApiKeys: boolean;
  /** Whether the user can read ingest pipeline definitions. */
  canReadIngestPipelines: boolean;
}
