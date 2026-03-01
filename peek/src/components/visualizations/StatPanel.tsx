import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { formatValue } from "@perses-dev/core";

import type { EsqlResponse, FormatOptions, StatPanelOptions } from "../../types";
import { toStatData } from "../../services/perses/dataTransformers";
import { CHART_COLORS } from "../../theme";

import { resolveThresholdColor, THRESHOLD_PALETTE } from "./thresholdUtils";

function formatStatValue(value: unknown, format?: FormatOptions): string {
  if (value == null) return "—";
  return formatValue(Number(value), format ?? { unit: "decimal" });
}

interface Props {
  data: EsqlResponse;
  options?: StatPanelOptions;
}

export default function StatPanel({ data, options }: Props) {
  const stats = toStatData(data);
  const format = options?.format;

  if (stats.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}
      >
        <Typography color="text.secondary">No numeric data</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 4,
        p: 2,
      }}
    >
      {stats.map((stat, i) => {
        const numericValue = stat.value != null ? Number(stat.value) : NaN;
        const thresholdColor =
          options?.thresholds && !Number.isNaN(numericValue)
            ? resolveThresholdColor(numericValue, options.thresholds)
            : undefined;
        const color = thresholdColor
          ? THRESHOLD_PALETTE[thresholdColor]
          : CHART_COLORS[i % CHART_COLORS.length];
        return (
          <Box key={stat.name} sx={{ textAlign: "center" }}>
            <Typography
              variant="h3"
              component="div"
              sx={{
                fontWeight: 700,
                color,
                lineHeight: 1.2,
              }}
            >
              {formatStatValue(stat.value, format)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {stat.name}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
