import type { EsqlColumn, EsqlResponse } from "../types";
import { escapeEsqlIdentifier } from "../services/es/esqlUtils";

import { isNumericType } from "./visualizations/chartUtils";

export function filterEsqlResult(
  result: EsqlResponse | null,
  selectedFields: Set<string>,
): EsqlResponse | null {
  if (!result) return null;

  const selectedIndices: number[] = [];
  const selectedColumns: EsqlColumn[] = [];

  for (let i = 0; i < result.columns.length; i += 1) {
    const column = result.columns[i]!;
    if (selectedFields.has(column.name)) {
      selectedIndices.push(i);
      selectedColumns.push(column);
    }
  }

  return {
    columns: selectedColumns,
    values: result.values.map((row) => selectedIndices.map((idx) => row[idx] ?? null)),
  };
}

export function filterColumnsByName(columns: EsqlColumn[], query: string): EsqlColumn[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return columns;
  return columns.filter((column) => column.name.toLowerCase().includes(normalizedQuery));
}

/**
 * Returns a set of column indices where every row value is null or undefined.
 * Returns an empty set when there are no rows so that column headers stay visible.
 */
export function getEmptyColumnIndices(data: EsqlResponse): Set<number> {
  if (data.values.length === 0) return new Set();
  const emptyColumns = new Array<boolean>(data.columns.length).fill(true);
  let remainingEmpty = data.columns.length;
  for (let rowIdx = 0; rowIdx < data.values.length && remainingEmpty > 0; rowIdx += 1) {
    const row = data.values[rowIdx];
    if (!row) continue;
    for (let colIdx = 0; colIdx < data.columns.length; colIdx += 1) {
      if (!emptyColumns[colIdx]) continue;
      const value = row[colIdx];
      if (value !== null && value !== undefined) {
        emptyColumns[colIdx] = false;
        remainingEmpty -= 1;
      }
    }
  }
  const emptySet = new Set<number>();
  for (let colIdx = 0; colIdx < emptyColumns.length; colIdx += 1) {
    if (emptyColumns[colIdx]) emptySet.add(colIdx);
  }
  return emptySet;
}

export function paginateRows(values: unknown[][], page: number, rowsPerPage: number): unknown[][] {
  const start = page * rowsPerPage;
  return values.slice(start, start + rowsPerPage);
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let asString = String(value);
  const len = asString.length;

  // Single-pass scan: detect a leading formula trigger and any CSV-special characters.
  // Formula trigger: /^[\t\r ]*[=+\-@]/ — leading tabs/CR/spaces followed by =, +, -, or @.
  // CSV-special: any of  "  ,  \n  \r  that require the cell to be quoted.
  let isFormula = false;
  let needsQuote = false;
  let seenNonLeadingWhitespace = false;
  for (let i = 0; i < len; i++) {
    const c = asString.charCodeAt(i);
    if (!seenNonLeadingWhitespace) {
      if (c === 9 /* \t */ || c === 13 /* \r */ || c === 32 /* space */) {
        // still in leading whitespace — keep scanning
      } else {
        seenNonLeadingWhitespace = true;
        if (c === 61 /* = */ || c === 43 /* + */ || c === 45 /* - */ || c === 64 /* @ */) {
          isFormula = true;
        }
      }
    }
    if (c === 34 /* " */ || c === 44 /* , */ || c === 10 /* \n */ || c === 13 /* \r */) {
      needsQuote = true;
    }
    if (isFormula && needsQuote) break; // both flags set — no need to scan further
  }

  // Prevent CSV formula injection in spreadsheet software.
  if (isFormula) asString = `'${asString}`;
  if (needsQuote) return `"${asString.replace(/"/g, '""')}"`;
  return asString;
}

/**
 * Splits an ES|QL query on top-level pipe characters, respecting double-quoted
 * strings (`"..."` with `""` escaping), single-quoted strings (`'...'` with
 * `''` escaping), triple-quoted strings (`"""..."""`),
 * backtick-quoted identifiers (`` `...` ``), and line/block comments.
 *
 * Returns an array of trimmed pipeline stage strings.  Returns an empty array
 * for a blank query, and a single-element array when no pipes are present.
 */
export function splitEsqlPipeline(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const steps: string[] = [];
  let current = "";
  let i = 0;

  while (i < trimmed.length) {
    const ch = trimmed[i]!;

    if (ch === "'") {
      // Single-quoted string — '' is the escape sequence for a literal '
      current += ch;
      i++;
      while (i < trimmed.length) {
        const c = trimmed[i]!;
        current += c;
        i++;
        if (c === "'") {
          if (trimmed[i] === "'") {
            current += "'";
            i++;
          } else {
            break;
          }
        }
      }
    } else if (ch === '"') {
      if (trimmed[i + 1] === '"' && trimmed[i + 2] === '"') {
        // Triple-quoted string: """..."""
        current += '"""';
        i += 3;
        while (i < trimmed.length) {
          if (trimmed[i] === '"' && trimmed[i + 1] === '"' && trimmed[i + 2] === '"') {
            current += '"""';
            i += 3;
            break;
          }
          current += trimmed[i++]!;
        }
      } else {
        // Regular double-quoted string — "" is the escape sequence for a literal "
        current += ch;
        i++;
        while (i < trimmed.length) {
          const c = trimmed[i]!;
          current += c;
          i++;
          if (c === '"') {
            if (trimmed[i] === '"') {
              current += '"';
              i++;
            } else {
              break;
            }
          }
        }
      }
    } else if (ch === "`") {
      // Backtick-quoted identifier (e.g. `field name`).  ES|QL does not allow
      // a literal backtick inside a backtick-quoted identifier, so no escape
      // sequences need to be handled here.
      current += ch;
      i++;
      while (i < trimmed.length) {
        const c = trimmed[i]!;
        current += c;
        i++;
        if (c === "`") break;
      }
    } else if (ch === "/" && trimmed[i + 1] === "/") {
      // Line comment: // ...
      current += "//";
      i += 2;
      while (i < trimmed.length) {
        const c = trimmed[i]!;
        current += c;
        i++;
        if (c === "\n") break;
      }
    } else if (ch === "/" && trimmed[i + 1] === "*") {
      // Block comment: /* ... */
      current += "/*";
      i += 2;
      while (i < trimmed.length) {
        const c = trimmed[i]!;
        current += c;
        i++;
        if (c === "*" && trimmed[i] === "/") {
          current += "/";
          i++;
          break;
        }
      }
    } else if (ch === "|") {
      const step = current.trim();
      if (step) steps.push(step);
      current = "";
      i++;
    } else {
      current += ch;
      i++;
    }
  }

  const last = current.trim();
  if (last) steps.push(last);

  return steps;
}

export function toCsv(data: EsqlResponse): string {
  // Pre-allocate the lines array (1 header + N data rows) to avoid dynamic resizing
  // and eliminate the [header, ...rows] spread copy.
  const lines = new Array<string>(data.values.length + 1);
  const cols = data.columns;
  const headerCells = new Array<string>(cols.length);
  for (let j = 0; j < cols.length; j++) {
    headerCells[j] = escapeCsvCell(cols[j]?.name);
  }
  lines[0] = headerCells.join(",");
  for (let i = 0; i < data.values.length; i++) {
    const row = data.values[i] ?? [];
    const cells = new Array<string>(row.length);
    for (let j = 0; j < row.length; j++) {
      cells[j] = escapeCsvCell(row[j]);
    }
    lines[i + 1] = cells.join(",");
  }
  return lines.join("\r\n");
}

/** Maximum number of top values returned by a keyword column insights query. */
const COLUMN_INSIGHTS_TOP_N = 10;

/** Maximum number of rows sampled for column insights (keeps queries fast). */
const COLUMN_INSIGHTS_SAMPLE_LIMIT = 500;

/**
 * Builds an ES|QL query to profile a specific column's value distribution.
 *
 * For numeric columns: returns min / max / avg / total_count / null_count statistics.
 * For all other column types: returns the top-N values with their occurrence counts.
 *
 * Any existing SORT, LIMIT, and STATS steps are stripped from the base query.
 * A sample LIMIT of 500 rows is added before the aggregation to keep queries fast.
 */
export function buildColumnInsightsQuery(
  baseQuery: string,
  columnName: string,
  columnType: string,
): string {
  const steps = splitEsqlPipeline(baseQuery);
  if (steps.length === 0) return "";

  // Strip SORT/LIMIT and stop at STATS so post-aggregation stages are not preserved.
  const filteredSteps: string[] = [];
  for (const step of steps) {
    if (/^SORT\s+/i.test(step) || /^LIMIT\s+/i.test(step)) continue;
    if (/^STATS\s+/i.test(step)) break;
    filteredSteps.push(step);
  }

  const quotedCol = escapeEsqlIdentifier(columnName);
  const sampledSteps = [...filteredSteps, `LIMIT ${COLUMN_INSIGHTS_SAMPLE_LIMIT}`];

  if (isNumericType(columnType)) {
    return [
      ...sampledSteps,
      `STATS MIN(${quotedCol}) AS min_value, MAX(${quotedCol}) AS max_value, AVG(${quotedCol}) AS avg_value, COUNT(*) AS total_count, COUNT(*) - COUNT(${quotedCol}) AS null_count`,
    ].join(" | ");
  }

  return [
    ...sampledSteps,
    `STATS value_count = COUNT(*) BY ${quotedCol}`,
    "SORT value_count DESC",
    `LIMIT ${COLUMN_INSIGHTS_TOP_N}`,
  ].join(" | ");
}

/**
 * Formats an ES|QL query into a clean, consistent style:
 * - Uppercases the leading command keyword of each pipeline stage.
 * - Joins multiple stages with a newline + "| " prefix for readability.
 *
 * Returns the original query unchanged if it has no pipeline steps.
 */
export function formatEsqlQuery(query: string): string {
  const steps = splitEsqlPipeline(query);
  if (steps.length === 0) return query;

  const formattedSteps = steps.map((step) =>
    step.replace(/^([A-Za-z]+)/, (match) => match.toUpperCase()),
  );

  return formattedSteps.join("\n| ");
}

/**
 * Modifies an ES|QL query to add, update, or remove a top-level SORT clause.
 *
 * - Any existing top-level `SORT` steps are removed.
 * - If `direction` is non-null, a new `SORT <column> ASC|DESC` step is inserted
 *   immediately before the last `LIMIT` step (if one exists), otherwise appended.
 * - If `direction` is null all SORT steps are simply removed.
 */
export function applyEsqlSort(
  query: string,
  columnName: string,
  direction: "asc" | "desc" | null,
): string {
  const steps = splitEsqlPipeline(query);
  if (steps.length === 0) return query;

  // Remove any existing SORT commands (case-insensitive).
  const withoutSort = steps.filter((s) => !/^SORT\s+/i.test(s));

  if (!direction) {
    return withoutSort.join(" | ");
  }

  const sortStep = `SORT ${escapeEsqlIdentifier(columnName)} ${direction.toUpperCase()}`;

  // Insert before the last LIMIT step if one exists.
  const lastLimitIdx = [...withoutSort].reduceRight(
    (found, s, i) => (found === -1 && /^LIMIT\s+/i.test(s) ? i : found),
    -1,
  );

  if (lastLimitIdx !== -1) {
    const result = [...withoutSort];
    result.splice(lastLimitIdx, 0, sortStep);
    return result.join(" | ");
  }

  return [...withoutSort, sortStep].join(" | ");
}
