import type { SnapshotRow, SlmPolicyRow, RepositoryRow } from "../hooks/useSnapshotData";

export type SortDirection = "asc" | "desc";
export type SnapshotSortField =
  | "state"
  | "name"
  | "repository"
  | "indexCount"
  | "startTime"
  | "duration";
export type PolicySortField =
  | "name"
  | "repository"
  | "nextRun"
  | "taken"
  | "failed"
  | "lastSuccess"
  | "lastFailure";
export type RepositorySortField = "name" | "type";

const dir = (d: SortDirection) => (d === "asc" ? 1 : -1);

export function compareSnapshots(
  a: SnapshotRow,
  b: SnapshotRow,
  field: SnapshotSortField,
  direction: SortDirection,
): number {
  const m = dir(direction);
  switch (field) {
    case "state":
      return m * a.state.localeCompare(b.state);
    case "name":
      return m * a.name.localeCompare(b.name);
    case "repository":
      return m * a.repository.localeCompare(b.repository);
    case "indexCount":
      return m * (a.indexCount - b.indexCount);
    case "startTime":
      return m * (a.startTimeMs - b.startTimeMs);
    case "duration":
      return m * (a.duration - b.duration);
    default:
      return 0;
  }
}

export function comparePolicies(
  a: SlmPolicyRow,
  b: SlmPolicyRow,
  field: PolicySortField,
  direction: SortDirection,
): number {
  const m = dir(direction);
  switch (field) {
    case "name":
      return m * a.name.localeCompare(b.name);
    case "repository":
      return m * a.repository.localeCompare(b.repository);
    case "nextRun":
      return m * (a.nextExecutionMs - b.nextExecutionMs);
    case "taken":
      return m * (a.snapshotsTaken - b.snapshotsTaken);
    case "failed":
      return m * (a.snapshotsFailed - b.snapshotsFailed);
    case "lastSuccess":
      return m * (a.lastSuccessTime - b.lastSuccessTime);
    case "lastFailure":
      return m * (a.lastFailureTime - b.lastFailureTime);
    default:
      return 0;
  }
}

export function compareRepositories(
  a: RepositoryRow,
  b: RepositoryRow,
  field: RepositorySortField,
  direction: SortDirection,
): number {
  const m = dir(direction);
  switch (field) {
    case "name":
      return m * a.name.localeCompare(b.name);
    case "type":
      return m * a.type.localeCompare(b.type);
    default:
      return 0;
  }
}
