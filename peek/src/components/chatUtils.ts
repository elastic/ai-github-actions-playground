export interface ToolActivity {
  toolCallId: string;
  name: string;
  result?: string;
}

export function formatToolLabel(toolName: string): string {
  switch (toolName) {
    case "run_esql_query":
      return "Running query";
    case "get_screen_context":
      return "Reading screen";
    case "navigate_to_page":
      return "Navigating";
    case "set_query_lab_query":
      return "Setting query";
    case "set_time_range":
      return "Setting time range";
    case "get_cluster_health":
      return "Checking cluster health";
    case "get_index_info":
      return "Fetching index info";
    case "run_raw_es_request":
      return "Running ES request";
    case "explain_ingest_pipeline":
      return "Explaining pipeline";
    case "generate_esql_query":
      return "Drafting query";
    default:
      return toolName.replace(/_/g, " ");
  }
}

export function formatToolResult(toolName: string, result: unknown): string {
  if (toolName === "run_esql_query" && typeof result === "object" && result !== null) {
    const r = result as Record<string, unknown>;
    if (typeof r.rowCount === "number") {
      return `Found ${r.rowCount} rows`;
    }
  }
  if (toolName === "navigate_to_page" && typeof result === "object" && result !== null) {
    const r = result as Record<string, unknown>;
    if (typeof r.label === "string") {
      return `Navigated to ${r.label}`;
    }
  }
  if (toolName === "get_cluster_health" && typeof result === "object" && result !== null) {
    const r = result as Record<string, unknown>;
    const health = r.health as Record<string, unknown> | undefined;
    if (health && typeof health.status === "string") {
      return `Cluster status: ${health.status}`;
    }
  }
  if (toolName === "get_index_info" && typeof result === "object" && result !== null) {
    const r = result as Record<string, unknown>;
    if (typeof r.index === "string") {
      return `Fetched info for ${r.index}`;
    }
  }
  if (toolName === "run_raw_es_request" && typeof result === "object" && result !== null) {
    const r = result as Record<string, unknown>;
    if (typeof r.status === "number") {
      return `Response: ${r.status}${r.truncated ? " (truncated)" : ""}`;
    }
  }
  if (toolName === "explain_ingest_pipeline" && typeof result === "object" && result !== null) {
    const r = result as Record<string, unknown>;
    if (typeof r.error === "string") {
      return r.error;
    }
    if (typeof r.pipeline_name === "string") {
      return `Explained ${r.pipeline_name}${r.simulation ? " (with simulation)" : ""}`;
    }
  }
  if (toolName === "generate_esql_query" && typeof result === "object" && result !== null) {
    const r = result as Record<string, unknown>;
    if (r.set === true) {
      return r.navigatedTo ? "Query set in Query Lab" : "Query drafted";
    }
  }
  return "Done";
}
