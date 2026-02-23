import { useCallback } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import BarChartIcon from "@mui/icons-material/BarChart";
import CloseIcon from "@mui/icons-material/Close";

import type { EsqlResponse } from "../../types";

import { isNumericType } from "./chartUtils";

interface Props {
  open: boolean;
  onClose: () => void;
  columnName: string;
  columnType: string;
  loading: boolean;
  error: string | null;
  data: EsqlResponse | null;
}

export default function ColumnInsightsFlyout({
  open,
  onClose,
  columnName,
  columnType,
  loading,
  error,
  data,
}: Props) {
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const isNumeric = isNumericType(columnType);

  const getColValue = (result: EsqlResponse, row: unknown[], name: string): unknown => {
    const idx = result.columns.findIndex((c) => c.name === name);
    return idx >= 0 ? (row[idx] ?? null) : null;
  };

  const numericRow =
    isNumeric && data !== null && data.values.length > 0 ? (data.values[0] ?? null) : null;

  const minValue = numericRow && data ? getColValue(data, numericRow, "min_value") : null;
  const maxValue = numericRow && data ? getColValue(data, numericRow, "max_value") : null;
  const avgValue = numericRow && data ? getColValue(data, numericRow, "avg_value") : null;
  const totalCount = numericRow && data ? getColValue(data, numericRow, "total_count") : null;
  const nullCount = numericRow && data ? getColValue(data, numericRow, "null_count") : null;

  const nullRate =
    totalCount !== null &&
    totalCount !== undefined &&
    Number(totalCount) > 0 &&
    nullCount !== null &&
    nullCount !== undefined
      ? ((Number(nullCount) / Number(totalCount)) * 100).toFixed(1) + "%"
      : null;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: { width: { xs: "100%", sm: 400 }, display: "flex", flexDirection: "column" },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
          <BarChartIcon fontSize="small" color="action" />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              Column Insights
            </Typography>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5 }}>
              <Typography variant="caption" fontWeight={600} noWrap>
                {columnName}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.6 }}>
                {columnType}
              </Typography>
            </Box>
          </Box>
        </Box>
        <IconButton size="small" onClick={handleClose} aria-label="Close insights">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", pt: 4 }}>
            <CircularProgress size={32} />
          </Box>
        )}

        {!loading && error && <Alert severity="error">{error}</Alert>}

        {!loading && !error && data && isNumeric && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1 }}>
              {[
                { label: "Min", value: minValue },
                { label: "Avg", value: avgValue },
                { label: "Max", value: maxValue },
              ].map(({ label, value }) => (
                <Box
                  key={label}
                  sx={{
                    textAlign: "center",
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    p: 1,
                  }}
                >
                  <Typography variant="caption" color="text.secondary" display="block">
                    {label}
                  </Typography>
                  <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                    {value === null || value === undefined ? "—" : String(value)}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Divider />
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2" color="text.secondary">
                Total count
              </Typography>
              <Typography variant="body2" fontFamily="monospace">
                {totalCount === null || totalCount === undefined ? "—" : String(totalCount)}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2" color="text.secondary">
                Null count
              </Typography>
              <Typography variant="body2" fontFamily="monospace">
                {nullCount === null || nullCount === undefined ? "—" : String(nullCount)}
              </Typography>
            </Box>
            {nullRate !== null && (
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" color="text.secondary">
                  Null rate
                </Typography>
                <Typography variant="body2" fontFamily="monospace">
                  {nullRate}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {!loading && !error && data && !isNumeric && (
          <Box>
            {data.values.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No data
              </Typography>
            ) : (
              <>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mb: 1 }}
                >
                  Top {data.values.length} value{data.values.length !== 1 ? "s" : ""}
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem" }}>Value</TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem" }} align="right">
                        Count
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.values.map((row, i) => {
                      const value = getColValue(data, row, columnName);
                      const count = getColValue(data, row, "count");
                      return (
                        <TableRow key={i}>
                          <TableCell sx={{ fontSize: "0.75rem", fontFamily: "monospace" }}>
                            {value === null || value === undefined ? (
                              <Typography
                                component="span"
                                variant="caption"
                                sx={{ opacity: 0.4, fontStyle: "italic" }}
                              >
                                null
                              </Typography>
                            ) : (
                              String(value)
                            )}
                          </TableCell>
                          <TableCell
                            sx={{ fontSize: "0.75rem", fontFamily: "monospace" }}
                            align="right"
                          >
                            {count === null || count === undefined ? "—" : String(count)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {data.values.length >= 10 && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 1 }}
                  >
                    Showing top 10 values only
                  </Typography>
                )}
              </>
            )}
          </Box>
        )}

        {!loading && !error && !data && (
          <Typography variant="body2" color="text.secondary">
            No data available
          </Typography>
        )}
      </Box>
    </Drawer>
  );
}
