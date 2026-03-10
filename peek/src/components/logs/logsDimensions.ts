export type LogsFocusDimension =
  | "service.name"
  | "host.name"
  | "process.name"
  | "user.name"
  | "event.dataset"
  | "log.file.path";

export const LOGS_DIMENSION_LABELS: Record<
  LogsFocusDimension,
  { singular: string; plural: string }
> = {
  "service.name": { singular: "Service", plural: "Services" },
  "host.name": { singular: "Host", plural: "Hosts" },
  "process.name": { singular: "Process", plural: "Processes" },
  "user.name": { singular: "User", plural: "Users" },
  "event.dataset": { singular: "Dataset", plural: "Datasets" },
  "log.file.path": { singular: "File", plural: "Files" },
};
