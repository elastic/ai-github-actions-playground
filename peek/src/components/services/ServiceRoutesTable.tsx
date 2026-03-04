import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";

import InsightSlot from "../InsightSlot";

import { formatLatency, formatErrorRate } from "./serviceInventoryHelpers";
import type {
  RouteRow,
  RouteSparklineData,
  RouteSortField,
  SortDirection,
} from "./serviceDashboardHelpers";
import ServiceSparklineCell from "./ServiceSparklineCell";

interface ServiceRoutesTableProps {
  routeRows: RouteRow[];
  sortField: RouteSortField;
  sortDirection: SortDirection;
  onSort: (field: RouteSortField) => void;
  sparklineData?: Record<string, RouteSparklineData>;
  routeInsightSlotIds?: Record<string, string>;
}

export default function ServiceRoutesTable({
  routeRows,
  sortField,
  sortDirection,
  onSort,
  sparklineData,
  routeInsightSlotIds,
}: ServiceRoutesTableProps) {
  const theme = useTheme();
  const renderMetricWithSparkline = (
    value: ReactNode,
    data: RouteSparklineData["requests"],
    color?: string,
  ) => (
    <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", alignItems: "center" }}>
      <Typography variant="body2">{value}</Typography>
      <Box sx={{ width: { sm: 88, xs: 64 }, minWidth: { sm: 88, xs: 64 } }}>
        <ServiceSparklineCell data={data} color={color} />
      </Box>
    </Box>
  );

  return (
    <Table
      size="small"
      aria-label="Top routes"
      sx={{
        minWidth: { sm: 520, xs: "100%" },
        "& td, & th": { py: 1, px: 1.5 },
      }}
    >
      <TableHead>
        <TableRow>
          <TableCell>
            <TableSortLabel
              active={sortField === "route"}
              direction={sortField === "route" ? sortDirection : "asc"}
              onClick={() => onSort("route")}
            >
              Route
            </TableSortLabel>
          </TableCell>
          <TableCell align="right">
            <TableSortLabel
              active={sortField === "requestCount"}
              direction={sortField === "requestCount" ? sortDirection : "desc"}
              onClick={() => onSort("requestCount")}
            >
              Requests
            </TableSortLabel>
          </TableCell>
          <TableCell align="right">
            <TableSortLabel
              active={sortField === "avgLatencyMs"}
              direction={sortField === "avgLatencyMs" ? sortDirection : "desc"}
              onClick={() => onSort("avgLatencyMs")}
            >
              Avg Latency
            </TableSortLabel>
          </TableCell>
          <TableCell align="right">
            <TableSortLabel
              active={sortField === "errorRate"}
              direction={sortField === "errorRate" ? sortDirection : "desc"}
              onClick={() => onSort("errorRate")}
            >
              Error Rate
            </TableSortLabel>
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {routeRows.map((row) => {
          const sparkline = sparklineData?.[row.route];
          const routeLink = (
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {row.route}
            </Typography>
          );
          const routeSlotId = routeInsightSlotIds?.[row.route];
          return (
            <TableRow key={row.route} hover>
              <TableCell>
                {routeSlotId ? (
                  <InsightSlot slotId={routeSlotId}>{routeLink}</InsightSlot>
                ) : (
                  routeLink
                )}
              </TableCell>
              <TableCell align="right">
                {renderMetricWithSparkline(
                  row.requestCount.toLocaleString(),
                  sparkline?.requests ?? [],
                )}
              </TableCell>
              <TableCell align="right">
                {renderMetricWithSparkline(
                  formatLatency(row.avgLatencyMs),
                  sparkline?.latency ?? [],
                  theme.palette.warning.main,
                )}
              </TableCell>
              <TableCell align="right">
                <Box
                  sx={{ display: "flex", gap: 1, justifyContent: "flex-end", alignItems: "center" }}
                >
                  <Chip
                    size="small"
                    label={formatErrorRate(row.errorRate)}
                    color={row.errorRate > 0.05 ? "error" : "default"}
                    variant={row.errorRate > 0.05 ? "filled" : "outlined"}
                  />
                  <Box sx={{ width: { sm: 88, xs: 64 }, minWidth: { sm: 88, xs: 64 } }}>
                    <ServiceSparklineCell
                      data={sparkline?.errorRate ?? []}
                      color={theme.palette.error.main}
                    />
                  </Box>
                </Box>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
