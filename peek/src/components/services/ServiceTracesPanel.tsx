import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import type { RecentTrace, TraceSortField, SortDirection } from "./serviceDashboardHelpers";
import ServiceTracesTable from "./ServiceTracesTable";

interface ServiceTracesPanelProps {
  traces: RecentTrace[];
  sortField: TraceSortField;
  sortDirection: SortDirection;
  onSort: (field: TraceSortField) => void;
  onViewTrace: (traceId: string) => void;
  onViewAllTraces: () => void;
}

export default function ServiceTracesPanel({
  traces,
  sortField,
  sortDirection,
  onSort,
  onViewTrace,
  onViewAllTraces,
}: ServiceTracesPanelProps) {
  return (
    <Paper variant="outlined" sx={{ overflow: "auto" }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          p: 1.5,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Recent Traces
        </Typography>
        <Button size="small" variant="text" onClick={onViewAllTraces}>
          View All Traces →
        </Button>
      </Box>
      <ServiceTracesTable
        traces={traces}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={onSort}
        onViewTrace={onViewTrace}
      />
    </Paper>
  );
}
