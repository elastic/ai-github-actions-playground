import { useId, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Collapse from "@mui/material/Collapse";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import { useNavigate } from "react-router-dom";

import type { PerSignalDelta } from "../../services/addData/ingestionQueries";
import { useOpenInDiscover } from "../../hooks/useOpenInDiscover";
import { escapeEsqlString } from "../../services/es/esqlUtils";
import { formatNumber } from "../visualizations/chartUtils";

import { SIGNAL_COLORS } from "./addDataTechnologyConstants";
import { PULSE_KEYFRAMES } from "./guides/sharedStyles";

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
  const navigate = useNavigate();
  const openInDiscover = useOpenInDiscover();
  const baseId = useId();
  const toggleId = `${baseId}-toggle`;
  const detailsId = `${baseId}-details`;

  const detected = delta.signalDetected;
  const label = SIGNAL_LABELS[delta.signal] ?? delta.signal;
  const color = SIGNAL_COLORS[delta.signal] ?? "info";
  const relativeLatest = delta.latestTimestamp ? formatRelativeTime(delta.latestTimestamp) : null;

  const summaryText = detected ? "Detected" : isPolling ? "Checking..." : "Not yet";
  const shouldOpenServices = delta.signal === "traces" && delta.newServicesDetected > 0;
  const ctaLabel = shouldOpenServices ? "See in Service Inventory" : "See in Query Lab";
  const targetServiceName = delta.newServiceNames[0] ?? null;

  const handleOpen = () => {
    if (shouldOpenServices) {
      if (targetServiceName) {
        navigate(`/services/${encodeURIComponent(targetServiceName)}`);
      } else {
        navigate("/services");
      }
      return;
    }
    openInDiscover(buildSignalQuery(delta));
  };

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
                (+{formatNumber(delta.docCountDelta)}
                {relativeLatest ? `, ${relativeLatest}` : ""})
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
                (+{delta.newHostsDetected} new{relativeLatest ? `, ${relativeLatest}` : ""})
              </Typography>
            )}
          </Box>

          {/* Service count (traces-oriented signal) */}
          {delta.signal === "traces" && (
            <Box sx={{ display: "flex", gap: 0.5, alignItems: "baseline" }}>
              <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
                {delta.currentServiceCount > 0
                  ? `${delta.currentServiceCount} service${delta.currentServiceCount !== 1 ? "s" : ""}`
                  : "--"}
              </Typography>
              {delta.newServicesDetected > 0 && (
                <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>
                  (+{delta.newServicesDetected} new{relativeLatest ? `, ${relativeLatest}` : ""})
                </Typography>
              )}
            </Box>
          )}
          <Typography variant="caption" color="text.secondary">
            Last: {relativeLatest ?? "never"}
          </Typography>
          {detected && (
            <Button
              size="small"
              variant="text"
              onClick={handleOpen}
              sx={{ alignSelf: "flex-start", px: 0 }}
            >
              {ctaLabel}
            </Button>
          )}
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
          ...PULSE_KEYFRAMES,
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

function buildSignalQuery(delta: PerSignalDelta): string {
  const sourceBySignal: Record<PerSignalDelta["signal"], string> = {
    logs: "FROM logs-*",
    metrics: "FROM metrics-*",
    traces: "FROM traces-*",
  };
  const keepBySignal: Record<PerSignalDelta["signal"], string> = {
    logs: "KEEP @timestamp, host.name, service.name, message, data_stream.dataset",
    metrics: "KEEP @timestamp, host.name, service.name, metricset.name, data_stream.dataset",
    traces: "KEEP @timestamp, host.name, service.name, trace.id, span.id",
  };
  const source = sourceBySignal[delta.signal] ?? "FROM logs-*";
  const keep = keepBySignal[delta.signal] ?? "KEEP @timestamp";
  const escapedHostName = escapeEsqlString(delta.newHostNames[0] ?? "");
  const escapedServiceName = escapeEsqlString(delta.newServiceNames[0] ?? "");
  const where =
    delta.newHostsDetected > 0 && escapedHostName.length > 0
      ? `WHERE host.name == "${escapedHostName}"`
      : delta.newServicesDetected > 0 && escapedServiceName.length > 0
        ? `WHERE service.name == "${escapedServiceName}"`
        : delta.newHostsDetected > 0
          ? "WHERE host.name IS NOT NULL"
          : delta.newServicesDetected > 0
            ? "WHERE service.name IS NOT NULL"
            : null;
  const parts = [source, where, keep, "SORT @timestamp DESC", "LIMIT 200"].filter(
    (part): part is string => Boolean(part),
  );
  return parts.join(" | ");
}
