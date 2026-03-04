export const DEFAULT_TOOL_ROW_LIMIT = 50;
export const MAX_TOOL_ROW_LIMIT = 200;
export const MAX_TOOL_ROWS_RETURNED = 50;
export const MAX_TOOL_COLUMNS_RETURNED = 20;
export const MAX_TOOL_CELL_LENGTH = 500;
export const MAX_RAW_RESPONSE_LENGTH = 50_000;
export const CHAT_TOOL_TIMEOUT_MS = 12_000;

export function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function clampToolRowLimit(rowLimit?: number): number {
  if (typeof rowLimit !== "number" || Number.isNaN(rowLimit)) {
    return DEFAULT_TOOL_ROW_LIMIT;
  }
  return Math.max(1, Math.min(MAX_TOOL_ROW_LIMIT, Math.floor(rowLimit)));
}

export function ensureQueryLimit(query: string, rowLimit: number): string {
  const normalized = query.replace(/\s*;\s*$/, "");
  const hadSemicolon = normalized.length !== query.length;
  const trailingLimit = /\|\s*LIMIT\s+(\d+)\s*$/i;
  const match = normalized.match(trailingLimit);

  let boundedQuery = normalized;
  if (!match) {
    boundedQuery = `${normalized} | LIMIT ${rowLimit}`;
  } else {
    const existing = Number.parseInt(match[1] ?? "", 10);
    if (Number.isNaN(existing) || existing > rowLimit) {
      boundedQuery = normalized.replace(trailingLimit, `| LIMIT ${rowLimit}`);
    }
  }
  return hadSemicolon ? `${boundedQuery};` : boundedQuery;
}

export function truncateCellValue(value: unknown): { value: unknown; truncated: boolean } {
  if (typeof value !== "string" || value.length <= MAX_TOOL_CELL_LENGTH) {
    return { value, truncated: false };
  }
  return {
    value: `${value.slice(0, MAX_TOOL_CELL_LENGTH)}…`,
    truncated: true,
  };
}

export async function runWithToolTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  return operation(AbortSignal.timeout(CHAT_TOOL_TIMEOUT_MS));
}
