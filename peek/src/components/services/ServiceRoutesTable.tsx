import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";

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
}

export default function ServiceRoutesTable({
  routeRows,
  sortField,
  sortDirection,
  onSort,
  sparklineData,
}: ServiceRoutesTableProps) {
  const theme = useTheme();
  const hasSparklines = sparklineData && Object.keys(sparklineData).length > 0;

  return (
    <Table size="small" aria-label="Top routes">
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
          {hasSparklines && <TableCell>Requests trend</TableCell>}
          <TableCell align="right">
            <TableSortLabel
              active={sortField === "avgLatencyMs"}
              direction={sortField === "avgLatencyMs" ? sortDirection : "desc"}
              onClick={() => onSort("avgLatencyMs")}
            >
              Avg Latency
            </TableSortLabel>
          </TableCell>
          {hasSparklines && <TableCell>Latency trend</TableCell>}
          <TableCell align="right">
            <TableSortLabel
              active={sortField === "errorRate"}
              direction={sortField === "errorRate" ? sortDirection : "desc"}
              onClick={() => onSort("errorRate")}
            >
              Error Rate
            </TableSortLabel>
          </TableCell>
          {hasSparklines && <TableCell>Error rate trend</TableCell>}
        </TableRow>
      </TableHead>
      <TableBody>
        {routeRows.map((row) => {
          const sparkline = sparklineData?.[row.route];
          return (
            <TableRow key={row.route} hover>
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {row.route}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2">{row.requestCount.toLocaleString()}</Typography>
              </TableCell>
              {hasSparklines && (
                <TableCell>
                  <ServiceSparklineCell data={sparkline?.requests ?? []} />
                </TableCell>
              )}
              <TableCell align="right">
                <Typography variant="body2">{formatLatency(row.avgLatencyMs)}</Typography>
              </TableCell>
              {hasSparklines && (
                <TableCell>
                  <ServiceSparklineCell
                    data={sparkline?.latency ?? []}
                    color={theme.palette.warning.main}
                  />
                </TableCell>
              )}
              <TableCell align="right">
                <Chip
                  size="small"
                  label={formatErrorRate(row.errorRate)}
                  color={row.errorRate > 0.05 ? "error" : "default"}
                  variant={row.errorRate > 0.05 ? "filled" : "outlined"}
                />
              </TableCell>
              {hasSparklines && (
                <TableCell>
                  <ServiceSparklineCell
                    data={sparkline?.errorRate ?? []}
                    color={theme.palette.error.main}
                  />
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
