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

export function paginateRows(values: unknown[][], page: number, rowsPerPage: number): unknown[][] {
  const start = page * rowsPerPage;
  return values.slice(start, start + rowsPerPage);
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const asString = String(value);
  if (/[",\n\r]/.test(asString)) {
    return `"${asString.replace(/"/g, '""')}"`;
  }
  return asString;
}

export function toCsv(data: EsqlResponse): string {
  const header = data.columns.map((column) => escapeCsvCell(column.name)).join(",");
  const rows = data.values.map((row) => row.map((cell) => escapeCsvCell(cell)).join(","));
  return [header, ...rows].join("\r\n");
}
