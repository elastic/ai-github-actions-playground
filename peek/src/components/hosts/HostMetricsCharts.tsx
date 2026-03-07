import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import type { HostQueryFilters } from "./hostQueryBuilder";
import LoadAverageChartCard from "./LoadAverageChartCard";
import MetricChartCard from "./MetricChartCard";

interface HostMetricsChartsProps {
  filters: HostQueryFilters;
}

export default function HostMetricsCharts({ filters }: HostMetricsChartsProps) {
  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
        Fleet Metrics
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2,
        }}
      >
        <MetricChartCard
          title="CPU Utilization"
          metricField="system.cpu.utilization"
          filters={filters}
          asPercent
          color="#4fc3f7"
        />
        <MetricChartCard
          title="Memory Utilization"
          metricField="system.memory.utilization"
          filters={filters}
          asPercent
          color="#ab47bc"
        />
        <MetricChartCard
          title="Disk I/O (bytes)"
          metricField="system.disk.io"
          filters={filters}
          color="#66bb6a"
        />
        <MetricChartCard
          title="Network I/O (bytes)"
          metricField="system.network.io"
          filters={filters}
          color="#ffa726"
        />
        <MetricChartCard
          title="Filesystem Utilization"
          metricField="system.filesystem.utilization"
          filters={filters}
          asPercent
          color="#ef5350"
        />
        <LoadAverageChartCard filters={filters} />
      </Box>
    </Box>
  );
}
