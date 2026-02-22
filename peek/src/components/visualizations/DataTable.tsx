import { useMemo, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { EsqlResponse } from "../../types";
import { paginateRows } from "../discoverUtils";
import { isNumericType } from "./chartUtils";
import RowInspectorFlyout from "./RowInspectorFlyout";

interface Props {
  data: EsqlResponse;
}

export default function DataTable({ data }: Props) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [inspectedRow, setInspectedRow] = useState<unknown[] | null>(null);

  const visibleRows = useMemo(
    () => paginateRows(data.values, page, rowsPerPage),
    [data.values, page, rowsPerPage],
  );

  const handleRowClick = useCallback((row: unknown[]) => {
    setInspectedRow(row);
  }, []);

  const handleCloseInspector = useCallback(() => {
    setInspectedRow(null);
  }, []);

  if (data.columns.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
        No data
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TableContainer sx={{ flex: 1, minHeight: 0 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {data.columns.map((col) => (
                <TableCell
                  key={col.name}
                  sx={{
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    fontSize: "0.75rem",
                  }}
                >
                  {col.name}
                  <Typography component="span" variant="caption" sx={{ ml: 0.5, opacity: 0.5 }}>
                    {col.type}
                  </Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleRows.map((row, rowIdx) => (
              <Tooltip
                key={page * rowsPerPage + rowIdx}
                title="Click to inspect row"
                placement="left"
                enterDelay={600}
              >
                <TableRow hover onClick={() => handleRowClick(row)} sx={{ cursor: "pointer" }}>
                  {row.map((cell, cellIdx) => {
                    const col = data.columns[cellIdx];
                    const numeric = col ? isNumericType(col.type) : false;
                    return (
                      <TableCell
                        key={cellIdx}
                        sx={{
                          whiteSpace: "nowrap",
                          fontSize: "0.75rem",
                          fontFamily: numeric ? "monospace" : "inherit",
                          textAlign: numeric ? "right" : "left",
                        }}
                      >
                        {cell === null ? (
                          <Typography component="span" variant="caption" sx={{ opacity: 0.3 }}>
                            null
                          </Typography>
                        ) : (
                          String(cell)
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </Tooltip>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={data.values.length}
        page={page}
        onPageChange={(_, nextPage) => setPage(nextPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(event) => {
          setRowsPerPage(parseInt(event.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[25, 50, 100]}
      />
      <RowInspectorFlyout
        open={inspectedRow !== null}
        onClose={handleCloseInspector}
        columns={data.columns}
        row={inspectedRow}
      />
    </Box>
  );
}
