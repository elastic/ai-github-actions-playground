import { useMemo } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

import { splitEsqlPipeline } from "./discoverUtils";
import { formatDuration } from "./formatDuration";

interface QueryPipelineStepsProps {
  query: string;
  loading: boolean;
  activeStep: number | null;
  stepDurationsMs?: Record<number, number>;
  onRunStep: (cumulativeQuery: string, stepIndex: number) => void;
}

/**
 * Renders a row of chips below the ES|QL editor — one chip per pipeline stage.
 * Clicking a chip runs the cumulative query up to and including that stage,
 * which makes it easy to debug a multi-step ES|QL query incrementally.
 *
 * Returns null when the query has one stage or fewer (nothing to decompose).
 */
export default function QueryPipelineSteps({
  query,
  loading,
  activeStep,
  stepDurationsMs,
  onRunStep,
}: QueryPipelineStepsProps) {
  const steps = useMemo(() => splitEsqlPipeline(query), [query]);

  if (steps.length <= 1) return null;

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75, mt: 0.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
        Run to step:
      </Typography>
      {steps.map((step, idx) => {
        const cumulativeQuery = steps.slice(0, idx + 1).join("\n| ");
        const isRunning = loading && activeStep === idx;
        const durationMs = stepDurationsMs?.[idx];
        return (
          <Tooltip
            key={idx}
            title={
              durationMs !== undefined ? (
                <>
                  {cumulativeQuery}
                  <br />
                  <br />
                  Duration: {formatDuration(durationMs)}
                </>
              ) : (
                cumulativeQuery
              )
            }
            placement="bottom-start"
          >
            <span>
              <Chip
                size="small"
                icon={
                  isRunning ? (
                    <CircularProgress size={12} color="inherit" />
                  ) : (
                    <PlayArrowIcon sx={{ fontSize: "1rem !important" }} />
                  )
                }
                label={`${idx + 1}. ${step}${durationMs !== undefined ? ` • ${formatDuration(durationMs)}` : ""}`}
                onClick={() => onRunStep(cumulativeQuery, idx)}
                disabled={loading}
                variant="outlined"
                color={isRunning ? "primary" : "default"}
                sx={{
                  maxWidth: 200,
                  "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" },
                }}
              />
            </span>
          </Tooltip>
        );
      })}
    </Box>
  );
}
