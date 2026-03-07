import Box from "@mui/material/Box";

import type { HostQueryFilters } from "./hostQueryBuilder";
import { HostDetailMetricChart, HostDetailLoadChart } from "./HostDetailCharts";

interface HostDetailMetricsGridProps {
  hostId: string;
  filters: HostQueryFilters;
}

export default function HostDetailMetricsGrid({ hostId, filters }: HostDetailMetricsGridProps) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        gap: 2,
      }}
    >
      <HostDetailMetricChart
        title="CPU Utilization"
        hostId={hostId}
        metricField="system.cpu.utilization"
        filters={filters}
        asPercent
        color="#4fc3f7"
      />
      <HostDetailMetricChart
        title="Memory Utilization"
        hostId={hostId}
        metricField="system.memory.utilization"
        filters={filters}
        asPercent
        color="#ab47bc"
      />
      <HostDetailMetricChart
        title="Disk I/O (bytes/s)"
        hostId={hostId}
        metricField="system.disk.io"
        filters={filters}
        color="#66bb6a"
      />
      <HostDetailMetricChart
        title="Network I/O (bytes/s)"
        hostId={hostId}
        metricField="system.network.io"
        filters={filters}
        color="#ffa726"
      />
      <HostDetailLoadChart hostId={hostId} filters={filters} />
    </Box>
  );
}
