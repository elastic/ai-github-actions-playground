import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { EsqlResponse } from "../../types";
import { findNumericColumnIndices, formatNumber } from "./chartUtils";
import { CHART_COLORS } from "../../theme";

interface Props {
  data: EsqlResponse;
}

export default function StatPanel({ data }: Props) {
  const numericIdxs = findNumericColumnIndices(data);

  if (numericIdxs.length === 0 || data.values.length === 0) {
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

  const stats = numericIdxs.map((colIdx) => ({
    name: data.columns[colIdx]!.name,
    value: data.values[0]![colIdx],
  }));

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
      {stats.map((stat, i) => (
        <Box key={stat.name} sx={{ textAlign: "center" }}>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 700,
              color: CHART_COLORS[i % CHART_COLORS.length],
              lineHeight: 1.2,
            }}
          >
            {formatNumber(stat.value)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {stat.name}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
