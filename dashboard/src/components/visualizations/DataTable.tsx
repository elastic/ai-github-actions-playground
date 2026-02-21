import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { EsqlResponse } from "../../types";
import { isNumericType } from "./chartUtils";

interface Props {
  data: EsqlResponse;
}

export default function DataTable({ data }: Props) {
  if (data.columns.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
        No data
      </Typography>
    );
  }

  return (
    <TableContainer sx={{ maxHeight: "100%" }}>
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
          {data.values.map((row, rowIdx) => (
            <TableRow key={rowIdx} hover>
              {row.map((cell, cellIdx) => (
                <TableCell
                  key={cellIdx}
                  sx={{
                    whiteSpace: "nowrap",
                    fontSize: "0.75rem",
                    fontFamily: isNumericType(data.columns[cellIdx]!.type)
                      ? "monospace"
                      : "inherit",
                    textAlign: isNumericType(data.columns[cellIdx]!.type) ? "right" : "left",
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
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
