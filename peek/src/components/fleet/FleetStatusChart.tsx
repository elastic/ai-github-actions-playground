import { useMemo } from "react";

import type { FleetServerStatusMetrics } from "../../services/fleet";
import { useEChartTheme } from "../visualizations/useEChartTheme";
import PersesEChartWrapper from "../perses/PersesEChartWrapper";

interface Props {
  status: FleetServerStatusMetrics;
}

const STATUS_COLORS: Record<string, string> = {
  Healthy: "#4caf50",
  Unhealthy: "#ff9800",
  Offline: "#9e9e9e",
  Updating: "#2196f3",
  Inactive: "#607d8b",
};

export default function FleetStatusChart({ status }: Props) {
  const theme = useEChartTheme();

  const option = useMemo(() => {
    const items = [
      { name: "Healthy", value: status.healthy },
      { name: "Unhealthy", value: status.unhealthy },
      { name: "Offline", value: status.offline },
      { name: "Updating", value: status.updating },
      { name: "Inactive", value: status.inactive },
    ].filter((d) => d.value > 0);

    return {
      ...theme,
      tooltip: { ...theme.tooltip, trigger: "item", formatter: "{b}: {c} ({d}%)" },
      legend: { ...theme.legend, orient: "vertical", right: 10, top: "center" },
      series: [
        {
          type: "pie",
          radius: ["45%", "70%"],
          center: ["35%", "50%"],
          avoidLabelOverlap: true,
          label: { show: false },
          data: items.map((d) => ({
            name: d.name,
            value: d.value,
            itemStyle: { color: STATUS_COLORS[d.name] ?? theme.color?.[0] },
          })),
        },
      ],
    };
  }, [status, theme]);

  return <PersesEChartWrapper option={option} style={{ width: "100%", height: "100%" }} />;
}
