import { useMemo } from "react";

import type { FleetAgentVersionCount } from "../../services/fleet";
import { useEChartTheme } from "../visualizations/useEChartTheme";
import EChartWrapper from "../visualizations/EChartWrapper";

interface Props {
  versions: FleetAgentVersionCount[];
}

export default function FleetVersionChart({ versions }: Props) {
  const theme = useEChartTheme();

  const option = useMemo(() => {
    const sorted = [...versions].sort((a, b) => a.count - b.count);
    const categories = sorted.map((v) => v.version);
    const values = sorted.map((v) => v.count);

    return {
      ...theme,
      tooltip: { ...theme.tooltip, trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 80, right: 20, top: 10, bottom: 30 },
      xAxis: { ...theme.xAxis, type: "value" },
      yAxis: { ...theme.yAxis, type: "category", data: categories },
      series: [
        {
          type: "bar",
          data: values,
          barMaxWidth: 24,
          itemStyle: { borderRadius: [0, 3, 3, 0] },
        },
      ],
    };
  }, [versions, theme]);

  if (versions.length === 0) return null;
  return <EChartWrapper option={option} sx={{ width: "100%", height: "100%" }} />;
}
