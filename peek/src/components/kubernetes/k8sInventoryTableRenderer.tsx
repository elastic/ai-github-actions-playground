import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Typography from "@mui/material/Typography";

import type { ColumnDef } from "./k8sInventoryColumns";
import type { K8sSortDirection } from "./useK8sInventorySearch";

export function renderTable<T>(
  columns: ColumnDef<T>[],
  rows: T[],
  sortField: string,
  sortDirection: K8sSortDirection,
  handleSort: (field: string) => void,
  ariaLabel: string,
  rowKey: (row: T, index: number) => string,
) {
  return (
    <Table size="medium" aria-label={ariaLabel}>
      <TableHead>
        <TableRow>
          {columns.map((col) => (
            <TableCell key={col.key} align={col.align ?? "left"}>
              {col.sortable ? (
                <TableSortLabel
                  active={sortField === col.key}
                  direction={sortField === col.key ? sortDirection : "asc"}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                </TableSortLabel>
              ) : (
                col.label
              )}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={rowKey(row, index)} hover>
            {columns.map((col) => (
              <TableCell key={col.key} align={col.align ?? "left"}>
                <Typography variant="body2">{col.render(row)}</Typography>
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
