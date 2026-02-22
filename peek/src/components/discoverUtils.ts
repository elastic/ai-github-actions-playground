import type { EsqlColumn, EsqlResponse } from "../types";

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
    values: result.values.map((row) => selectedIndices.map((idx) => row[idx])),
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
  const emptySet = new Set<number>();
  for (let colIdx = 0; colIdx < data.columns.length; colIdx++) {
    if (data.values.every((row) => row[colIdx] === null || row[colIdx] === undefined)) {
      emptySet.add(colIdx);
    }
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
  // Prevent CSV formula injection in spreadsheet software.
  if (/^[\t\r ]*[=+\-@]/.test(asString)) {
    asString = `'${asString}`;
  }
  if (/[",\n\r]/.test(asString)) {
    return `"${asString.replace(/"/g, '""')}"`;
  }
  return asString;
}

/**
 * Splits an ES|QL query on top-level pipe characters, respecting double-quoted
 * strings (`"..."` with `""` escaping), triple-quoted strings (`"""..."""`),
 * and backtick-quoted identifiers (`` `...` ``).
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

    if (ch === '"') {
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
  const header = data.columns.map((column) => escapeCsvCell(column.name)).join(",");
  const rows = data.values.map((row) => row.map((cell) => escapeCsvCell(cell)).join(","));
  return [header, ...rows].join("\r\n");
}
