import { useId, useState } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Collapse from "@mui/material/Collapse";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";

import type { PerSignalDelta } from "../../services/addData/ingestionQueries";
import { formatNumber } from "../visualizations/chartUtils";

import { SIGNAL_COLORS } from "./addDataTechnologyConstants";

const SIGNAL_LABELS: Record<string, string> = {
  logs: "Logs",
  metrics: "Metrics",
  traces: "Traces",
};

interface SignalVerificationCardProps {
  delta: PerSignalDelta;
  isPolling: boolean;
}

export default function SignalVerificationCard({ delta, isPolling }: SignalVerificationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const baseId = useId();
  const toggleId = `${baseId}-toggle`;
  const detailsId = `${baseId}-details`;

  const detected =
    delta.dataStreamAppeared ||
    delta.isDataFlowing ||
    delta.newHostsDetected > 0 ||
    delta.newAgentsDetected > 0;
  const label = SIGNAL_LABELS[delta.signal] ?? delta.signal;
  const color = SIGNAL_COLORS[delta.signal] ?? "info";

  const summaryText = detected ? "Detected" : isPolling ? "Checking..." : "Not yet";

  return (
    <Paper
      variant="outlined"
      sx={{
        display: "flex",
        flex: "1 1 0",
        flexDirection: "column",
        minWidth: 140,
        overflow: "hidden",
      }}
    >
      {/* Collapsed header — always visible */}
      <ButtonBase
        id={toggleId}
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-controls={detailsId}
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          p: 1.5,
          textAlign: "left",
        }}
      >
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", minWidth: 0 }}>
          <Typography variant="body2" color={`${color}.main`} sx={{ fontWeight: 600 }}>
            {label}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {summaryText}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", flexShrink: 0, gap: 0.5, alignItems: "center" }}>
          <StatusIcon detected={detected} isPolling={isPolling} />
          <ExpandMoreIcon
            fontSize="small"
            sx={{
              color: "text.secondary",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
            }}
          />
        </Box>
      </ButtonBase>

      {/* Expandable detail */}
      <Collapse in={expanded}>
        <Box
          id={detailsId}
          role="region"
          aria-labelledby={toggleId}
          sx={{ display: "flex", flexDirection: "column", gap: 0.5, pb: 1.5, px: 1.5 }}
        >
          {/* Data stream */}
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
            {delta.dataStreamAppeared ? (
              <CheckCircleIcon color="success" sx={{ fontSize: 14 }} />
            ) : (
              <RadioButtonUncheckedIcon color="disabled" sx={{ fontSize: 14 }} />
            )}
            <Typography variant="caption" color="text.secondary">
              {delta.dataStreamAppeared ? "Stream exists" : "No stream yet"}
            </Typography>
          </Box>

          {/* Doc count */}
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "baseline" }}>
            <Typography
              variant="body2"
              sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}
            >
              {formatNumber(delta.currentDocCount)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              docs
            </Typography>
            {delta.docCountDelta > 0 && (
              <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>
                +{formatNumber(delta.docCountDelta)}
              </Typography>
            )}
          </Box>

          {/* Host count */}
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "baseline" }}>
            <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
              {delta.currentHostCount > 0
                ? `${delta.currentHostCount} host${delta.currentHostCount !== 1 ? "s" : ""}`
                : "--"}
            </Typography>
            {delta.newHostsDetected > 0 && (
              <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>
                +{delta.newHostsDetected} new!
              </Typography>
            )}
          </Box>

          {/* Last seen */}
          <Typography variant="caption" color="text.secondary">
            {delta.latestTimestamp
              ? `Last: ${formatRelativeTime(delta.latestTimestamp)}`
              : "Last: never"}
          </Typography>
        </Box>
      </Collapse>
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// Sub-components & helpers
// ---------------------------------------------------------------------------

function StatusIcon({ detected, isPolling }: { detected: boolean; isPolling: boolean }) {
  if (detected) {
    return <CheckCircleIcon color="success" fontSize="small" />;
  }
  if (isPolling) {
    return (
      <RadioButtonCheckedIcon
        color="info"
        sx={{
          animation: "pulse 1.5s ease-in-out infinite",
          fontSize: 18,
          "@keyframes pulse": {
            "0%, 100%": { opacity: 1 },
            "50%": { opacity: 0.3 },
          },
        }}
      />
    );
  }
  return <RadioButtonUncheckedIcon color="disabled" fontSize="small" />;
}

function formatRelativeTime(isoTimestamp: string): string {
  const parsed = Date.parse(isoTimestamp);
  if (Number.isNaN(parsed)) return "just now";
  const deltaMs = Date.now() - parsed;
  if (deltaMs < 0) return "just now";
  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
