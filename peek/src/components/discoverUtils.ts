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

/**
 * Returns a backtick-quoted ES|QL identifier, escaping any literal backticks
 * inside the name as `\`` (the ES|QL escape sequence for backtick identifiers).
 */
function quoteEsqlIdentifier(name: string): string {
  // If the name is a simple identifier (letters, digits, _, @, .) it doesn't need quoting.
  if (/^[A-Za-z_@][A-Za-z0-9_@.]*$/.test(name)) return name;
  // Escape backslashes first, then backticks, to produce a valid backtick-quoted identifier.
  return "`" + name.replace(/\\/g, "\\\\").replace(/`/g, "\\`") + "`";
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

  const sortStep = `SORT ${quoteEsqlIdentifier(columnName)} ${direction.toUpperCase()}`;

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
