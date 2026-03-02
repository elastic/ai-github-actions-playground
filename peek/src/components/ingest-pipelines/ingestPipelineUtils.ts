/**
 * Attempt to extract a human-readable message from a raw Elasticsearch error
 * string. Returns `null` when the error doesn't match a known pattern.
 */
export function humanizeEsError(raw: string): string | null {
  if (/unauthorized.*read_pipeline|manage_ingest_pipelines|manage_pipeline/i.test(raw)) {
    return "Permission denied — your user role does not include the read_pipeline privilege required to view ingest pipelines.";
  }
  if (/unauthorized/i.test(raw)) {
    const match = raw.match(/this action is granted by the cluster privileges \[([^\]]+)\]/);
    const privileges = match?.[1];
    return privileges
      ? `Permission denied — this action requires one of: ${privileges}`
      : "Permission denied — insufficient cluster privileges.";
  }
  if (/security_exception/i.test(raw)) {
    return "Permission denied — a security exception occurred.";
  }
  return null;
}

/**
 * Parse the simulate input field into an array of Elasticsearch docs.
 * Accepts a single JSON object, a JSON array of objects, or NDJSON.
 * Returns null when the input cannot be parsed.
 */
export function parseSimulateInput(input: string): Array<Record<string, unknown>> | null {
  const trimmed = input.trim();

  // Attempt standard JSON parse first (handles object and array inputs)
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((doc) =>
          doc !== null && typeof doc === "object" && "_source" in (doc as object)
            ? (doc as Record<string, unknown>)
            : { _source: doc },
        );
      }
      const doc = parsed as Record<string, unknown>;
      return ["_source" in doc ? doc : { _source: doc }];
    } catch {
      // fall through to NDJSON attempt
    }
  }

  // Attempt NDJSON: one JSON object per non-empty line
  const lines = trimmed.split("\n").filter((l) => l.trim());
  if (lines.length > 1) {
    try {
      return lines.map((line) => {
        const doc = JSON.parse(line.trim()) as Record<string, unknown>;
        return "_source" in doc ? doc : { _source: doc };
      });
    } catch {
      // fall through
    }
  }

  return null;
}
