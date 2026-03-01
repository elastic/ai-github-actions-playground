import type { ApiKeyInfo } from "../services/es";

export type RiskLevel = "error" | "warning" | "default";

const HIGH_PRIVILEGE_CLUSTER_PRIVILEGES = new Set([
  "all",
  "manage",
  "manage_security",
  "manage_api_key",
]);

function hasHighPrivilege(key: ApiKeyInfo): boolean {
  const descriptors = Object.values(key.role_descriptors ?? {});
  return descriptors.some((descriptor) => {
    const clusterPrivileges = descriptor.cluster ?? [];
    if (clusterPrivileges.some((p) => HIGH_PRIVILEGE_CLUSTER_PRIVILEGES.has(p))) return true;
    const indexPrivileges = descriptor.indices ?? [];
    return indexPrivileges.some((entry) => (entry.privileges ?? []).includes("all"));
  });
}

function isOrphaned(key: ApiKeyInfo): boolean {
  return key.username.trim().length === 0;
}

export function ageDays(creationMs: number): number {
  return Math.floor((Date.now() - creationMs) / 86_400_000);
}

export function ageLabel(creationMs: number): string {
  const days = ageDays(creationMs);
  if (days < 1) return "< 1 day";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function riskLevel(key: ApiKeyInfo): RiskLevel {
  if (key.invalidated) return "default";
  if (isOrphaned(key)) return "error";
  if (hasHighPrivilege(key)) return "error";
  if (key.expiration == null) return "error";
  if (ageDays(key.creation) > 90) return "warning";
  return "default";
}

export function riskLabel(key: ApiKeyInfo): string {
  if (key.invalidated) return "Invalidated";
  if (isOrphaned(key)) return "Orphaned (no owner)";
  if (hasHighPrivilege(key)) return "High privilege";
  if (key.expiration == null) return "Never expires";
  if (ageDays(key.creation) > 90) return "Stale (>90 days)";
  return "";
}
