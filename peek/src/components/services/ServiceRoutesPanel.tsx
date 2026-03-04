import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

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
}

export default function ServiceRoutesPanel({
  routeRows,
  sortField,
  sortDirection,
  onSort,
  sparklineData,
}: ServiceRoutesPanelProps) {
  return (
    <Paper variant="outlined" sx={{ minHeight: 120, overflow: "auto" }}>
      <Box sx={{ p: 1, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Top Routes
        </Typography>
      </Box>
      <ServiceRoutesTable
        routeRows={routeRows}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={onSort}
        sparklineData={sparklineData}
      />
    </Paper>
  );
}
