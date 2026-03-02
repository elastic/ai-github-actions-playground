import { useMemo } from "react";

import type { FleetServerStatusMetrics } from "../../services/fleet";
import { STATUS_COLORS } from "../../types/tokens";
import { useEChartTheme } from "../visualizations/useEChartTheme";
import EChartWrapper from "../visualizations/EChartWrapper";

interface Props {
  status: FleetServerStatusMetrics;
}

const FLEET_STATUS_COLORS: Record<string, string> = {
  Healthy: STATUS_COLORS.success,
  Unhealthy: STATUS_COLORS.warning,
  Offline: STATUS_COLORS.unknown,
  Updating: STATUS_COLORS.inProgress,
  Inactive: STATUS_COLORS.unknown,
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
            itemStyle: { color: FLEET_STATUS_COLORS[d.name] ?? theme.color?.[0] },
          })),
        },
      ],
    };
  }, [status, theme]);

  return <EChartWrapper option={option} sx={{ width: "100%", height: "100%" }} />;
}
