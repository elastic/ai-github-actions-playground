import { Link as RouterLink } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import { visuallyHidden } from "@mui/utils";

import InsightSlot from "../InsightSlot";

import {
  type ServiceRow,
  type ServiceSparklineData,
  type SortField,
  type SortDirection,
  formatLatency,
  formatErrorRate,
} from "./serviceInventoryHelpers";
import ServiceLanguageBadge from "./ServiceLanguageBadge";
import ServiceSparklineCell from "./ServiceSparklineCell";

interface ServiceInventoryTableProps {
  serviceRows: ServiceRow[];
  sortField: SortField;
  sortDirection: SortDirection;
  handleSort: (field: SortField) => void;
  handleViewTraces: (serviceName: string) => void;
  sparklineData?: Record<string, ServiceSparklineData>;
  rowInsightSlotIds?: Record<string, string>;
}

export default function ServiceInventoryTable({
  serviceRows,
  sortField,
  sortDirection,
  handleSort,
  handleViewTraces,
  sparklineData,
  rowInsightSlotIds,
}: ServiceInventoryTableProps) {
  const theme = useTheme();
  const renderSparklineHeaderCell = (label: string) => (
    <TableCell sx={{ width: 88, px: 0.5 }}>
      <Box component="span" sx={visuallyHidden}>
        {label}
      </Box>
    </TableCell>
  );

  return (
    <Table size="medium" aria-label="Service inventory">
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
          {renderSparklineHeaderCell("Requests trend")}
          <TableCell align="right">
            <TableSortLabel
              active={sortField === "avgLatencyMs"}
              direction={sortField === "avgLatencyMs" ? sortDirection : "desc"}
              onClick={() => handleSort("avgLatencyMs")}
            >
              Avg Latency
            </TableSortLabel>
          </TableCell>
          {renderSparklineHeaderCell("Latency trend")}
          <TableCell align="right">
            <TableSortLabel
              active={sortField === "errorRate"}
              direction={sortField === "errorRate" ? sortDirection : "desc"}
              onClick={() => handleSort("errorRate")}
            >
              Error Rate
            </TableSortLabel>
          </TableCell>
          {renderSparklineHeaderCell("Error rate trend")}
          <TableCell>Language</TableCell>
          <TableCell>Environment</TableCell>
          <TableCell>Version</TableCell>
          <TableCell align="right">Routes</TableCell>
          <TableCell align="right">Span Names</TableCell>
          <TableCell>Top Route</TableCell>
          <TableCell>Top Span</TableCell>
          <TableCell>Top Error</TableCell>
          <TableCell align="right">Actions</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {serviceRows.map((row) => {
          const sparkline = sparklineData?.[row.serviceName];
          const slotId = rowInsightSlotIds?.[row.serviceName];
          const serviceLink = (
            <Tooltip title={row.serviceName} enterDelay={300}>
              <Link
                component={RouterLink}
                to={`/services/${encodeURIComponent(row.serviceName)}`}
                underline="hover"
                sx={{
                  fontWeight: 500,
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {row.serviceName}
              </Link>
            </Tooltip>
          );
          return (
            <TableRow key={row.serviceName} hover>
              <TableCell sx={{ maxWidth: 260 }}>
                {slotId != null ? (
                  <InsightSlot slotId={slotId}>{serviceLink}</InsightSlot>
                ) : (
                  serviceLink
                )}
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2">{row.requestCount.toLocaleString()}</Typography>
              </TableCell>
              <TableCell sx={{ width: 88, px: 0.5 }}>
                <ServiceSparklineCell data={sparkline?.requests ?? []} />
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2">{formatLatency(row.avgLatencyMs)}</Typography>
              </TableCell>
              <TableCell sx={{ width: 88, px: 0.5 }}>
                <ServiceSparklineCell
                  data={sparkline?.latency ?? []}
                  color={theme.palette.warning.main}
                />
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
              <TableCell sx={{ width: 88, px: 0.5 }}>
                <ServiceSparklineCell
                  data={sparkline?.errorRate ?? []}
                  color={theme.palette.error.main}
                />
              </TableCell>
              <TableCell>
                <ServiceLanguageBadge language={row.language} />
              </TableCell>
              <TableCell>
                <Typography variant="body2">{row.environment}</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {row.version}
                  {row.uniqueVersions > 1 ? ` (+${row.uniqueVersions - 1})` : ""}
                </Typography>
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
          );
        })}
      </TableBody>
    </Table>
  );
}
