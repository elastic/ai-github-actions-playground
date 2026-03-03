export const INVESTIGATE_TIMELINE_FIELDS = [
  "@timestamp",
  "event.category",
  "event.action",
  "event.outcome",
  "user.name",
  "host.name",
  "source.ip",
  "message",
  "_index",
] as const;
