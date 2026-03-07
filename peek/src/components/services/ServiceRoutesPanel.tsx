import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import type { RouteRow, RouteSparklineData, RouteSortField } from "./serviceDashboardHelpers";
import ServiceRoutesTable from "./ServiceRoutesTable";

interface ServiceRoutesPanelProps {
  routeRows: RouteRow[];
  getSortLabelProps: (field: RouteSortField) => {
    active: boolean;
    direction: "asc" | "desc";
    onClick: () => void;
  };
  sparklineData?: Record<string, RouteSparklineData>;
  routeInsightSlotIds?: Record<string, string>;
}

export default function ServiceRoutesPanel({
  routeRows,
  getSortLabelProps,
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
            <Box
              component="span"
              aria-label="About top routes"
              sx={{ display: "inline-flex", color: "text.secondary" }}
            >
              <InfoOutlinedIcon fontSize="small" />
            </Box>
          </Tooltip>
        </Box>
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <ServiceRoutesTable
          routeRows={routeRows}
          getSortLabelProps={getSortLabelProps}
          sparklineData={sparklineData}
          routeInsightSlotIds={routeInsightSlotIds}
        />
      </Box>
    </Paper>
  );
}
