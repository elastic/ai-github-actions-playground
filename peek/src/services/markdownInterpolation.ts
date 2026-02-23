import type { DashboardParameter, EsqlResponse } from "../types";

/**
 * Replace `{{name}}` tokens in a markdown template with matching dashboard
 * parameter values.  Unknown tokens (no matching parameter) are left as-is so
 * existing markdown panels are never broken.
 */
export function interpolateParameters(
  content: string,
  parameters: DashboardParameter[] | undefined,
): string {
  if (!parameters || parameters.length === 0) return content;

  return content.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    const param = parameters.find((p) => p.name === name);
    return param !== undefined ? String(param.value) : match;
  });
}

// ---------------------------------------------------------------------------
// Embedded ES|QL queries — `${FROM index | ...}` syntax
// ---------------------------------------------------------------------------

/** A single ES|QL block extracted from markdown content. */
export interface EsqlBlock {
  /** The full `${...}` match including delimiters. */
  raw: string;
  /** The ES|QL query text inside the delimiters. */
  query: string;
}

const ESQL_BLOCK_RE = /\$\{((?:[^}"']|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')+)\}/g;

/** Extract all `${...}` ES|QL blocks from markdown content. */
export function extractEsqlBlocks(content: string): EsqlBlock[] {
  const blocks: EsqlBlock[] = [];
  let m: RegExpExecArray | null;
  while ((m = ESQL_BLOCK_RE.exec(content)) !== null) {
    blocks.push({ raw: m[0], query: (m[1] ?? "").trim() });
  }
  return blocks;
}

/**
 * Format an ES|QL result as a markdown fragment.
 *
 * - **1 row, 1 column** → inline value (the cell text)
 * - **N rows, 1 column** → bulleted list of the single column
 * - **N rows, M columns** → markdown table with headers
 *
 * Empty results render as `_No results_`.
 */
export function formatEsqlResult(data: EsqlResponse): string {
  const { columns, values } = data;
  if (values.length === 0) return "_No results_";

  // Single value → inline
  if (values.length === 1 && columns.length === 1) {
    const firstRow = values[0];
    return String(firstRow?.[0] ?? "");
  }

  // Single column → bulleted list
  if (columns.length === 1) {
    return values.map((row) => `- ${String(row[0] ?? "")}`).join("\n");
  }

  // Multiple columns → markdown table
  const header = columns.map((c) => c.name);
  const separator = columns.map(() => "---");
  const rows = values.map((row) => row.map((v) => String(v ?? "")).join(" | "));
  return [header.join(" | "), separator.join(" | "), ...rows].join("\n");
}

/**
 * Replace all resolved `${...}` blocks in the markdown content with their
 * formatted ES|QL results.  The `results` map is keyed by the raw `${...}`
 * string.
 */
export function replaceEsqlBlocks(
  content: string,
  results: ReadonlyMap<string, EsqlResponse>,
): string {
  return content.replace(ESQL_BLOCK_RE, (raw) => {
    const data = results.get(raw);
    if (!data) return raw;
    return formatEsqlResult(data);
  });
}
