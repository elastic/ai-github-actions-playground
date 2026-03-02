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
  return "Done";
}
