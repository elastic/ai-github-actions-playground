import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import {
  buildFlamegraphTree,
  buildFlamescopeHeatmap,
  type FlamescopeWindow,
  type SymbolizedStacktrace,
} from "../profiling/profilingUtils";

import EChartWrapper from "./EChartWrapper";
import ProfilingFlamegraph from "./ProfilingFlamegraph";

interface Props {
  stacktraces: SymbolizedStacktrace[];
  onWindowChange?: (window: FlamescopeWindow | null) => void;
  onFrameClick?: (frameName: string) => void;
}

export default function ProfilingFlamescope({ stacktraces, onWindowChange, onFrameClick }: Props) {
  const model = useMemo(() => buildFlamescopeHeatmap(stacktraces), [stacktraces]);
  const [selectedBucket, setSelectedBucket] = useState(0);
  const activeBucket =
    model.bucketWindows.length > 0 ? Math.min(selectedBucket, model.bucketWindows.length - 1) : 0;

  useEffect(() => {
    if (model.bucketWindows.length === 0) {
      onWindowChange?.(null);
      return;
    }
    onWindowChange?.(model.bucketWindows[activeBucket] ?? null);
  }, [activeBucket, model.bucketWindows, onWindowChange]);

  const selectedStacktraces = useMemo(
    () => model.bucketStacktraces[activeBucket] ?? [],
    [activeBucket, model.bucketStacktraces],
  );
  const selectedTree = useMemo(
    () => buildFlamegraphTree(selectedStacktraces),
    [selectedStacktraces],
  );

  const option = useMemo(() => {
    if (model.points.length === 0) return null;
    const values = model.points.map((point) => point[2]);
    return {
      grid: { left: 260, right: 24, top: 16, bottom: 80 },
      tooltip: { position: "top" as const },
      xAxis: {
        type: "category" as const,
        name: "Time",
        data: model.xLabels,
      },
      yAxis: {
        type: "category" as const,
        data: model.yLabels,
      },
      visualMap: {
        min: Math.min(...values),
        max: Math.max(...values),
        calculable: true,
        orient: "horizontal" as const,
        left: "center",
        bottom: 0,
      },
      series: [
        {
          type: "heatmap" as const,
          data: model.points,
          emphasis: {
            itemStyle: {
              borderColor: "#fff",
              borderWidth: 1,
            },
          },
        },
      ],
    };
  }, [model.points, model.xLabels, model.yLabels]);

  if (!option) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary">
          No flamescope data available. Run a query to load profiling data.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 560 }}>
      <Box sx={{ height: "42%", minHeight: 220 }}>
        <EChartWrapper
          option={option}
          onClick={(params) => {
            const data = params.data as [number, number, number] | undefined;
            if (!data) return;
            setSelectedBucket(data[0] ?? 0);
          }}
        />
      </Box>
      <Box sx={{ flex: 1, minHeight: 280, borderTop: 1, borderColor: "divider" }}>
        <ProfilingFlamegraph tree={selectedTree} onFrameClick={onFrameClick} />
      </Box>
    </Box>
  );
}
