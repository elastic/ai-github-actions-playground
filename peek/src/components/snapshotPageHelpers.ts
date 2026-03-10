import type { SnapshotRow, SlmPolicyRow, RepositoryRow } from "../hooks/useSnapshotData";

import {
  compareSnapshots,
  comparePolicies,
  compareRepositories,
  type SnapshotSortField,
  type PolicySortField,
  type RepositorySortField,
  type SortDirection,
} from "./snapshotSortUtils";

export const SNAPSHOT_TABS: Array<"snapshots" | "policies" | "repositories"> = [
  "snapshots",
  "policies",
  "repositories",
];

export const SNAPSHOT_SORT_FIELDS: SnapshotSortField[] = [
  "state",
  "name",
  "repository",
  "indexCount",
  "startTime",
  "duration",
];

export const POLICY_SORT_FIELDS: PolicySortField[] = [
  "name",
  "repository",
  "nextRun",
  "taken",
  "failed",
  "lastSuccess",
  "lastFailure",
];

export const REPO_SORT_FIELDS: RepositorySortField[] = ["name", "type"];

export const SORT_DIRECTIONS: SortDirection[] = ["asc", "desc"];

export function filterSnapshots(
  snapshots: SnapshotRow[],
  search: string,
  sortField: SnapshotSortField,
  sortDir: SortDirection,
): SnapshotRow[] {
  const term = search.trim().toLowerCase();
  return [...snapshots]
    .filter(
      (s) =>
        !term ||
        s.name.toLowerCase().includes(term) ||
        s.repository.toLowerCase().includes(term) ||
        s.state.toLowerCase().includes(term),
    )
    .sort((a, b) => compareSnapshots(a, b, sortField, sortDir));
}

export function filterPolicies(
  policies: SlmPolicyRow[],
  search: string,
  sortField: PolicySortField,
  sortDir: SortDirection,
): SlmPolicyRow[] {
  const term = search.trim().toLowerCase();
  return [...policies]
    .filter(
      (p) =>
        !term || p.name.toLowerCase().includes(term) || p.repository.toLowerCase().includes(term),
    )
    .sort((a, b) => comparePolicies(a, b, sortField, sortDir));
}

export function filterRepositories(
  repositories: RepositoryRow[],
  search: string,
  sortField: RepositorySortField,
  sortDir: SortDirection,
): RepositoryRow[] {
  const term = search.trim().toLowerCase();
  return [...repositories]
    .filter(
      (r) => !term || r.name.toLowerCase().includes(term) || r.type.toLowerCase().includes(term),
    )
    .sort((a, b) => compareRepositories(a, b, sortField, sortDir));
}
