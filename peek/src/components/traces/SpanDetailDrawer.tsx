import { useMemo, useCallback, useState } from "react";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import Typography from "@mui/material/Typography";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";
import type { Span } from "./traceUtils";
import { formatSpanDuration } from "./traceUtils";
import { getServiceColor } from "./traceColors";

const DEFAULT_FIELD_MAPPING_SERVICE = "service.name";

interface SpanDetailDrawerProps {
  span: Span | null;
  open: boolean;
  onClose: () => void;
  onFilterBy: (key: string, value: string) => void;
  onExclude: (key: string, value: string) => void;
}

function KeyValueRow({
  label,
  value,
  onFilterBy,
  onExclude,
  onCopy,
}: {
  label: string;
  value: string;
  onFilterBy?: () => void;
  onExclude?: () => void;
  onCopy?: () => void;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        py: 0.5,
        px: 1,
        "&:hover": { bgcolor: "action.hover" },
        gap: 1,
      }}
    >
      <Typography
        variant="caption"
        sx={{ fontWeight: 600, minWidth: 140, flexShrink: 0, wordBreak: "break-all" }}
      >
        {label}
      </Typography>
      <Typography
        variant="caption"
        sx={{ flex: 1, fontFamily: "monospace", wordBreak: "break-all" }}
      >
        {value}
      </Typography>
      <Box sx={{ display: "flex", gap: 0.25, flexShrink: 0 }}>
        {onFilterBy && (
          <Tooltip title="Filter by this value">
            <IconButton size="small" onClick={onFilterBy}>
              <FilterAltIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}
        {onExclude && (
          <Tooltip title="Exclude this value">
            <IconButton size="small" onClick={onExclude}>
              <FilterAltOffIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}
        {onCopy && (
          <Tooltip title="Copy value">
            <IconButton size="small" onClick={onCopy}>
              <ContentCopyIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}

export default function SpanDetailDrawer({
  span,
  open,
  onClose,
  onFilterBy,
  onExclude,
}: SpanDetailDrawerProps) {
  const [tabIndex, setTabIndex] = useState(0);

  const handleCopy = useCallback((value: string) => {
    void navigator.clipboard.writeText(value);
  }, []);

  const attributes = useMemo(() => {
    if (!span) return [];
    return Object.entries(span.attributes).map(([key, value]) => ({
      key,
      value: String(value),
    }));
  }, [span]);

  // Separate resource attributes (service.*, host.*, k8s.*, container.*)
  const { resourceAttrs, spanAttrs } = useMemo(() => {
    const resourcePrefixes = ["service.", "host.", "k8s.", "container.", "telemetry.", "process."];
    const resource: Array<{ key: string; value: string }> = [];
    const regular: Array<{ key: string; value: string }> = [];
    for (const attr of attributes) {
      if (resourcePrefixes.some((p) => attr.key.startsWith(p))) {
        resource.push(attr);
      } else {
        regular.push(attr);
      }
    }
    return { resourceAttrs: resource, spanAttrs: regular };
  }, [attributes]);

  if (!span) return null;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{ "& .MuiDrawer-paper": { width: 440 } }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 2,
            py: 1,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              bgcolor: getServiceColor(span.serviceName),
              flexShrink: 0,
            }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap>
              {span.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {span.serviceName} • {formatSpanDuration(span.durationUs)}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Tabs */}
        <Tabs
          value={tabIndex}
          onChange={(_, v: number) => setTabIndex(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: "divider", minHeight: 36 }}
        >
          <Tab label="Overview" sx={{ minHeight: 36, py: 0 }} />
          <Tab label="Attributes" sx={{ minHeight: 36, py: 0 }} />
          <Tab label="Resource" sx={{ minHeight: 36, py: 0 }} />
          {/* TODO: wire up Events tab when span event data is available */}
          {/* TODO: wire up Links tab when span link data is available */}
        </Tabs>

        {/* Tab content */}
        <Box sx={{ flex: 1, overflow: "auto" }}>
          {tabIndex === 0 && (
            <Box sx={{ p: 1 }}>
              <KeyValueRow
                label="Service"
                value={span.serviceName}
                onCopy={() => handleCopy(span.serviceName)}
              />
              <KeyValueRow
                label="Operation"
                value={span.name}
                onCopy={() => handleCopy(span.name)}
              />
              <KeyValueRow
                label="Span Kind"
                value={span.kind}
                onCopy={() => handleCopy(span.kind)}
              />
              <KeyValueRow
                label="Duration"
                value={formatSpanDuration(span.durationUs)}
                onCopy={() => handleCopy(String(span.durationUs))}
              />
              <KeyValueRow
                label="Status"
                value={span.status}
                onCopy={() => handleCopy(span.status)}
              />
              <KeyValueRow
                label="Trace ID"
                value={span.traceId}
                onCopy={() => handleCopy(span.traceId)}
              />
              <KeyValueRow
                label="Span ID"
                value={span.spanId}
                onCopy={() => handleCopy(span.spanId)}
              />
              {span.parentSpanId && (
                <KeyValueRow
                  label="Parent Span ID"
                  value={span.parentSpanId}
                  onCopy={() => handleCopy(span.parentSpanId!)}
                />
              )}
              {(() => {
                const tsDisplay = span.timestamp ? new Date(span.timestamp).toISOString() : "—";
                return (
                  <KeyValueRow
                    label="Timestamp"
                    value={tsDisplay}
                    onCopy={span.timestamp ? () => handleCopy(tsDisplay) : undefined}
                  />
                );
              })()}
            </Box>
          )}

          {tabIndex === 1 && (
            <Box sx={{ p: 1 }}>
              {spanAttrs.length === 0 ? (
                <Typography variant="caption" color="text.secondary" sx={{ p: 1 }}>
                  No span attributes
                </Typography>
              ) : (
                spanAttrs.map((attr) => (
                  <KeyValueRow
                    key={attr.key}
                    label={attr.key}
                    value={attr.value}
                    onFilterBy={() => onFilterBy(attr.key, attr.value)}
                    onExclude={() => onExclude(attr.key, attr.value)}
                    onCopy={() => handleCopy(attr.value)}
                  />
                ))
              )}
            </Box>
          )}

          {tabIndex === 2 && (
            <Box sx={{ p: 1 }}>
              {resourceAttrs.length === 0 ? (
                <Typography variant="caption" color="text.secondary" sx={{ p: 1 }}>
                  No resource attributes
                </Typography>
              ) : (
                resourceAttrs.map((attr) => (
                  <KeyValueRow
                    key={attr.key}
                    label={attr.key}
                    value={attr.value}
                    onFilterBy={() => onFilterBy(attr.key, attr.value)}
                    onExclude={() => onExclude(attr.key, attr.value)}
                    onCopy={() => handleCopy(attr.value)}
                  />
                ))
              )}
            </Box>
          )}
        </Box>

        {/* Footer actions */}
        <Box sx={{ p: 1, borderTop: 1, borderColor: "divider", display: "flex", gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<FilterAltIcon />}
            onClick={() => onFilterBy(DEFAULT_FIELD_MAPPING_SERVICE, span.serviceName)}
          >
            Filter by service
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}
