import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import type {
  RouteRow,
  RouteSparklineData,
  RouteSortField,
  SortDirection,
} from "./serviceDashboardHelpers";
import ServiceRoutesTable from "./ServiceRoutesTable";

interface ServiceRoutesPanelProps {
  routeRows: RouteRow[];
  sortField: RouteSortField;
  sortDirection: SortDirection;
  onSort: (field: RouteSortField) => void;
  sparklineData?: Record<string, RouteSparklineData>;
  routeInsightSlotIds?: Record<string, string>;
}

export default function ServiceRoutesPanel({
  routeRows,
  sortField,
  sortDirection,
  onSort,
  sparklineData,
  routeInsightSlotIds,
}: ServiceRoutesPanelProps) {
  return (
    <Paper variant="outlined" sx={{ minHeight: 120, overflow: "hidden" }}>
      <Box
        sx={{
          display: "flex",
          gap: 0.5,
          alignItems: "center",
          py: 1,
          px: 1,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Top Routes
          </Typography>
          <Tooltip title="Request volume, latency, and error rate by route.">
            <IconButton size="small" aria-label="About top routes">
              <InfoOutlinedIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <ServiceRoutesTable
          routeRows={routeRows}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={onSort}
          sparklineData={sparklineData}
          routeInsightSlotIds={routeInsightSlotIds}
        />
      </Box>
    </Paper>
  );
}
