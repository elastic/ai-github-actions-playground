import { useMemo } from "react";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import SpeedIcon from "@mui/icons-material/Speed";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

import { OverviewInfoCard } from "../OverviewInfoCard";

import {
  type InsightIcon,
  type InsightSeverity,
  type ServiceRow,
  deriveServiceInsights,
} from "./serviceInventoryHelpers";

interface ServiceInsightsPanelProps {
  serviceRows: ServiceRow[];
}

const iconMap: Record<InsightIcon, React.ReactElement> = {
  speed: <SpeedIcon fontSize="small" />,
  error: <ErrorOutlineIcon fontSize="small" />,
  trending: <TrendingUpIcon fontSize="small" />,
};

const severityColors: Record<InsightSeverity, string> = {
  info: "info.main",
  warning: "warning.main",
  error: "error.main",
};

export default function ServiceInsightsPanel({ serviceRows }: ServiceInsightsPanelProps) {
  const insights = useMemo(() => deriveServiceInsights(serviceRows), [serviceRows]);

  if (insights.length === 0) return null;

  return (
    <OverviewInfoCard title="Actionable Insights">
      <Stack spacing={1.5}>
        {insights.map((insight) => (
          <Stack key={insight.label} direction="row" spacing={1} alignItems="flex-start">
            <Chip
              icon={iconMap[insight.icon]}
              label={insight.label}
              size="small"
              variant="outlined"
              sx={{ borderColor: "currentcolor", color: severityColors[insight.severity] }}
            />
            <Typography variant="body2" color="text.secondary">
              {insight.description}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </OverviewInfoCard>
  );
}
