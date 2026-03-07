export type LogsFocusDimension = "service.name" | "host.name" | "process.name" | "log.file.path";

export const LOGS_DIMENSION_LABELS: Record<
  LogsFocusDimension,
  { singular: string; plural: string }
> = {
  "service.name": { singular: "Service", plural: "Services" },
  "host.name": { singular: "Host", plural: "Hosts" },
  "process.name": { singular: "Process", plural: "Processes" },
  "log.file.path": { singular: "File", plural: "Files" },
};
