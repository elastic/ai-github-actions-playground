import {
  isElasticsearchError,
  type ElasticsearchClient,
  type UserCapabilities,
} from "../services/es";

export interface SecurityResourceResult<T> {
  data: T | null;
  notice: string | null;
  error: string | null;
}

/**
 * Shared orchestration for security resource pages (Users, Roles).
 * Runs `getCapabilities` and the provided `fetchResource` in parallel,
 * then normalises capability warnings, 401/403 auth denials, and other
 * errors into a single result object.
 */
export async function loadSecurityResource<T>({
  client,
  fetchResource,
  canRead,
  authDeniedNotice,
}: {
  client: ElasticsearchClient;
  fetchResource: (client: ElasticsearchClient) => Promise<T>;
  canRead: (caps: UserCapabilities) => boolean;
  authDeniedNotice: string;
}): Promise<SecurityResourceResult<T>> {
  const [capsResult, dataResult] = await Promise.allSettled([
    client.getCapabilities(),
    fetchResource(client),
  ]);

  let notice: string | null = null;
  if (capsResult.status === "fulfilled" && !canRead(capsResult.value)) {
    notice = "Your credentials may have partial access to security APIs.";
  }

  if (dataResult.status === "fulfilled") {
    return { data: dataResult.value, notice, error: null };
  }

  const reason = dataResult.reason;
  if (isElasticsearchError(reason) && (reason.status === 401 || reason.status === 403)) {
    return { data: null, notice: authDeniedNotice, error: null };
  }
  return {
    data: null,
    notice,
    error: isElasticsearchError(reason) ? reason.message : String(reason),
  };
}
