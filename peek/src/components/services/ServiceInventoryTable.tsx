import { Link as RouterLink } from "react-router-dom";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Typography from "@mui/material/Typography";

import {
  type ServiceRow,
  type SortField,
  type SortDirection,
  formatLatency,
  formatErrorRate,
} from "./serviceInventoryHelpers";

interface ServiceInventoryTableProps {
  serviceRows: ServiceRow[];
  sortField: SortField;
  sortDirection: SortDirection;
  handleSort: (field: SortField) => void;
  handleViewTraces: (serviceName: string) => void;
}

export default function ServiceInventoryTable({
  serviceRows,
  sortField,
  sortDirection,
  handleSort,
  handleViewTraces,
}: ServiceInventoryTableProps) {
  return (
    <Table size="small" aria-label="Service inventory">
      <TableHead>
        <TableRow>
          <TableCell>
            <TableSortLabel
              active={sortField === "serviceName"}
              direction={sortField === "serviceName" ? sortDirection : "asc"}
              onClick={() => handleSort("serviceName")}
            >
              Service Name
            </TableSortLabel>
          </TableCell>
          <TableCell align="right">
            <TableSortLabel
              active={sortField === "requestCount"}
              direction={sortField === "requestCount" ? sortDirection : "desc"}
              onClick={() => handleSort("requestCount")}
            >
              Requests
            </TableSortLabel>
          </TableCell>
          <TableCell align="right">
            <TableSortLabel
              active={sortField === "avgLatencyMs"}
              direction={sortField === "avgLatencyMs" ? sortDirection : "desc"}
              onClick={() => handleSort("avgLatencyMs")}
            >
              Avg Latency
            </TableSortLabel>
          </TableCell>
          <TableCell align="right">
            <TableSortLabel
              active={sortField === "errorRate"}
              direction={sortField === "errorRate" ? sortDirection : "desc"}
              onClick={() => handleSort("errorRate")}
            >
              Error Rate
            </TableSortLabel>
          </TableCell>
          <TableCell>Language</TableCell>
          <TableCell>Environment</TableCell>
          <TableCell align="right">Routes</TableCell>
          <TableCell align="right">Span Names</TableCell>
          <TableCell>Top Route</TableCell>
          <TableCell>Top Span</TableCell>
          <TableCell>Top Error</TableCell>
          <TableCell align="right">Actions</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {serviceRows.map((row) => (
          <TableRow key={row.serviceName} hover>
            <TableCell>
              <Link
                component={RouterLink}
                to={`/services/${encodeURIComponent(row.serviceName)}`}
                underline="hover"
                sx={{ fontWeight: 500 }}
              >
                {row.serviceName}
              </Link>
            </TableCell>
            <TableCell align="right">
              <Typography variant="body2">{row.requestCount.toLocaleString()}</Typography>
            </TableCell>
            <TableCell align="right">
              <Typography variant="body2">{formatLatency(row.avgLatencyMs)}</Typography>
            </TableCell>
            <TableCell align="right">
              <Chip
                size="small"
                label={formatErrorRate(row.errorRate)}
                color={row.errorRate > 0.05 ? "error" : "default"}
                variant={row.errorRate > 0.05 ? "filled" : "outlined"}
                data-testid={row.errorRate > 0.05 ? "error-rate-chip" : undefined}
              />
            </TableCell>
            <TableCell>
              <Typography variant="body2">{row.language}</Typography>
            </TableCell>
            <TableCell>
              <Typography variant="body2">{row.environment}</Typography>
            </TableCell>
            <TableCell align="right">
              <Typography variant="body2">{row.uniqueRoutes.toLocaleString()}</Typography>
            </TableCell>
            <TableCell align="right">
              <Typography variant="body2">{row.uniqueSpanNames.toLocaleString()}</Typography>
            </TableCell>
            <TableCell>
              <Typography variant="body2">{row.topRoute}</Typography>
            </TableCell>
            <TableCell>
              <Typography variant="body2">{row.topSpanName}</Typography>
            </TableCell>
            <TableCell>
              <Typography variant="body2">{row.topError}</Typography>
            </TableCell>
            <TableCell align="right">
              <Button
                size="small"
                variant="text"
                aria-label={`View traces for ${row.serviceName}`}
                onClick={() => handleViewTraces(row.serviceName)}
              >
                View Traces
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
