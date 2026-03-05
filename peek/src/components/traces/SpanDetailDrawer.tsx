import { useMemo, useCallback, useState } from "react";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import Typography from "@mui/material/Typography";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TimelineIcon from "@mui/icons-material/Timeline";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import ScheduleIcon from "@mui/icons-material/Schedule";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

import { copyToClipboard } from "../../utils/copyToClipboard";
import EmptyState from "../EmptyState";
import { COMPONENT_HEIGHTS } from "../../types/tokens";

import type { Span, SpanLink } from "./traceUtils";
import { formatSpanDuration, formatStatusLabel } from "./traceUtils";
import { getServiceColor } from "./traceColors";

const DEFAULT_FIELD_MAPPING_SERVICE = "service.name";

function formatEventTimestamp(ts: string): string {
  const parsedMs = Date.parse(ts);
  return Number.isNaN(parsedMs) ? ts : new Date(parsedMs).toISOString();
}

function shortId(id: string, head = 8, tail = 6): string {
  if (!id) return "—";
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}...${id.slice(-tail)}`;
}

interface SpanDetailDrawerProps {
  span: Span | null;
  open: boolean;
  onClose: () => void;
  onSelectSpan?: (spanId: string) => void;
  onFilterBy: (key: string, value: string) => void;
  onExclude: (key: string, value: string) => void;
  onOpenInQueryLab?: (span: Pick<Span, "traceId" | "spanId" | "timestamp">) => void;
  selectedSpanId?: string | null;
  traceSpans?: Span[];
  searchSpans?: Span[];
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
  const [actionAnchorEl, setActionAnchorEl] = useState<HTMLElement | null>(null);
  const actionsOpen = Boolean(actionAnchorEl);
  const hasActions = Boolean(onFilterBy || onExclude || onCopy);

  return (
    <Box
      sx={{
        display: "flex",
        gap: 1,
        alignItems: "center",
        py: 0.5,
        px: 1,
        "& .kv-actions-trigger": {
          opacity: 0,
          pointerEvents: "none",
        },
        "&:hover": { bgcolor: "action.hover" },
        "&:hover .kv-actions-trigger, &:focus-within .kv-actions-trigger": {
          opacity: 1,
          pointerEvents: "auto",
        },
        "@media (hover: none)": {
          "& .kv-actions-trigger": {
            opacity: 1,
            pointerEvents: "auto",
          },
        },
      }}
    >
      <Typography
        variant="caption"
        sx={{ flexShrink: 0, minWidth: 140, wordBreak: "break-all", fontWeight: 600 }}
      >
        {label}
      </Typography>
      <Typography
        variant="caption"
        sx={{ flex: 1, wordBreak: "break-all", fontFamily: "monospace" }}
      >
        {value}
      </Typography>
      {hasActions ? (
        <>
          <Box sx={{ display: "flex", flexShrink: 0, justifyContent: "flex-end", width: 28 }}>
            <Tooltip title="Row actions">
              <IconButton
                className="kv-actions-trigger"
                size="small"
                aria-label="Row actions"
                onClick={(event) => setActionAnchorEl(event.currentTarget)}
              >
                <MoreHorizIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
          <Menu
            anchorEl={actionAnchorEl}
            open={actionsOpen}
            onClose={() => setActionAnchorEl(null)}
            anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
            transformOrigin={{ horizontal: "right", vertical: "top" }}
          >
            {onFilterBy && (
              <MenuItem
                onClick={() => {
                  onFilterBy();
                  setActionAnchorEl(null);
                }}
              >
                <ListItemIcon>
                  <FilterAltIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Filter by this value</ListItemText>
              </MenuItem>
            )}
            {onExclude && (
              <MenuItem
                onClick={() => {
                  onExclude();
                  setActionAnchorEl(null);
                }}
              >
                <ListItemIcon>
                  <FilterAltOffIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Exclude this value</ListItemText>
              </MenuItem>
            )}
            {onCopy && (
              <MenuItem
                onClick={() => {
                  onCopy();
                  setActionAnchorEl(null);
                }}
              >
                <ListItemIcon>
                  <ContentCopyIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Copy value</ListItemText>
              </MenuItem>
            )}
          </Menu>
        </>
      ) : null}
    </Box>
  );
}

export default function SpanDetailDrawer({
  span,
  open,
  onClose,
  onSelectSpan,
  onFilterBy,
  onExclude,
  onOpenInQueryLab,
  selectedSpanId,
  traceSpans = [],
  searchSpans = [],
}: SpanDetailDrawerProps) {
  const [tabIndex, setTabIndex] = useState(0);

  const handleCopy = useCallback((value: string) => {
    void copyToClipboard(value);
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

  const timelineSpans = useMemo(() => {
    if (!span) return [];
    const fromDetail = traceSpans.filter((traceSpan) => traceSpan.traceId === span.traceId);
    const base =
      fromDetail.length > 0
        ? fromDetail
        : searchSpans.filter((traceSpan) => traceSpan.traceId === span.traceId);
    return [...base].sort((a, b) => a.startTimeUs - b.startTimeUs || a.durationUs - b.durationUs);
  }, [traceSpans, searchSpans, span]);
  if (!span) return null;
  const tsDisplay = span.timestamp ? formatEventTimestamp(span.timestamp) : "—";
  const selectedTimelineSpanId = selectedSpanId ?? span.spanId;
  const selectedTimelineIndex = timelineSpans.findIndex(
    (timelineSpan) => timelineSpan.spanId === selectedTimelineSpanId,
  );
  const canSelectTimelineSpan = Boolean(onSelectSpan);
  const canSelectPrevTimelineSpan = canSelectTimelineSpan && selectedTimelineIndex > 0;
  const canSelectNextTimelineSpan =
    canSelectTimelineSpan &&
    selectedTimelineIndex >= 0 &&
    selectedTimelineIndex < timelineSpans.length - 1;
  const traceStartUs = timelineSpans.reduce(
    (min, traceSpan) => Math.min(min, traceSpan.startTimeUs),
    Number.POSITIVE_INFINITY,
  );
  const traceEndUs = timelineSpans.reduce(
    (max, traceSpan) => Math.max(max, traceSpan.startTimeUs + traceSpan.durationUs),
    Number.NEGATIVE_INFINITY,
  );
  const traceDurationUs =
    Number.isFinite(traceStartUs) && Number.isFinite(traceEndUs)
      ? Math.max(traceEndUs - traceStartUs, 1)
      : 1;

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
            gap: 1,
            alignItems: "center",
            py: 1,
            px: 2,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Box
            sx={{
              flexShrink: 0,
              width: 10,
              height: 10,
              borderRadius: "50%",
              bgcolor: getServiceColor(span.serviceName),
            }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" noWrap>
              {span.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {span.serviceName} • {formatSpanDuration(span.durationUs)}
            </Typography>
          </Box>
          <IconButton size="small" aria-label="Close span detail" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Tabs */}
        <Tabs
          value={tabIndex}
          onChange={(_, v: number) => setTabIndex(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: COMPONENT_HEIGHTS.tab, borderBottom: 1, borderColor: "divider" }}
        >
          <Tab label="Overview" sx={{ minHeight: COMPONENT_HEIGHTS.tab, py: 0 }} />
          <Tab label="Attributes" sx={{ minHeight: COMPONENT_HEIGHTS.tab, py: 0 }} />
          <Tab label="Resource Attributes" sx={{ minHeight: COMPONENT_HEIGHTS.tab, py: 0 }} />
          <Tab label="Links" sx={{ minHeight: COMPONENT_HEIGHTS.tab, py: 0 }} />
          <Tab label="Events" sx={{ minHeight: COMPONENT_HEIGHTS.tab, py: 0 }} />
        </Tabs>

        {/* Tab content */}
        <Box sx={{ flex: 1, overflow: "auto" }}>
          {tabIndex === 0 && (
            <Box sx={{ p: 1 }}>
              <Box sx={{ py: 0.5, px: 1 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mb: 1 }}
                >
                  Quick facts
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  <Tooltip title={span.traceId}>
                    <Chip
                      size="small"
                      variant="outlined"
                      icon={<TimelineIcon />}
                      label={`Trace ${shortId(span.traceId)}`}
                      onClick={() => handleCopy(span.traceId)}
                    />
                  </Tooltip>
                  <Tooltip title={span.spanId}>
                    <Chip
                      size="small"
                      variant="outlined"
                      icon={<FingerprintIcon />}
                      label={`Span ${shortId(span.spanId)}`}
                      onClick={() => handleCopy(span.spanId)}
                    />
                  </Tooltip>
                  {span.parentSpanId && (
                    <Tooltip title={span.parentSpanId}>
                      <Chip
                        size="small"
                        variant="outlined"
                        icon={<AccountTreeIcon />}
                        label={`Parent ${shortId(span.parentSpanId)}`}
                        onClick={() => handleCopy(span.parentSpanId!)}
                      />
                    </Tooltip>
                  )}
                  <Chip
                    size="small"
                    variant="outlined"
                    icon={<ScheduleIcon />}
                    label={formatSpanDuration(span.durationUs)}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    icon={<CheckCircleOutlineIcon />}
                    label={formatStatusLabel(span.status)}
                  />
                </Box>
              </Box>
              {timelineSpans.length > 0 && (
                <Box sx={{ py: 0.5, px: 1 }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mb: 0.5 }}
                  >
                    Trace timeline
                  </Typography>
                  <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                    <Tooltip title="Previous span">
                      <span>
                        <IconButton
                          size="small"
                          aria-label="Select previous span"
                          disabled={!canSelectPrevTimelineSpan}
                          onClick={() =>
                            onSelectSpan?.(timelineSpans[selectedTimelineIndex - 1]!.spanId)
                          }
                          sx={{ p: 0.5 }}
                        >
                          <ChevronLeftIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Box
                      sx={{
                        position: "relative",
                        flex: 1,
                        height: COMPONENT_HEIGHTS.sidebarNavItem,
                        overflow: "hidden",
                        borderRadius: 1,
                        bgcolor: "action.hover",
                      }}
                    >
                      {timelineSpans.map((traceSpan) => {
                        const leftPct =
                          ((traceSpan.startTimeUs - traceStartUs) / traceDurationUs) * 100;
                        const widthPct = Math.max(
                          (traceSpan.durationUs / traceDurationUs) * 100,
                          0.5,
                        );
                        const isSelected = traceSpan.spanId === selectedTimelineSpanId;
                        return (
                          <Tooltip
                            key={traceSpan.spanId}
                            title={`${traceSpan.serviceName} / ${traceSpan.name} • ${formatSpanDuration(traceSpan.durationUs)}`}
                          >
                            <ButtonBase
                              component="button"
                              disabled={!canSelectTimelineSpan}
                              aria-label={`Select span ${traceSpan.name} from service ${traceSpan.serviceName}`}
                              sx={{
                                position: "absolute",
                                top: isSelected ? 8 : 10,
                                left: `${Math.min(Math.max(leftPct, 0), 100)}%`,
                                width: `${Math.min(widthPct, 100)}%`,
                                minWidth: 0,
                                height: isSelected ? 16 : 12,
                                p: 0,
                                outline: isSelected ? "2px solid" : "none",
                                outlineColor: "primary.main",
                                borderRadius: 0.5,
                                bgcolor: getServiceColor(traceSpan.serviceName),
                                opacity: isSelected ? 0.95 : 0.65,
                                cursor: canSelectTimelineSpan ? "pointer" : "default",
                              }}
                              onClick={() => onSelectSpan?.(traceSpan.spanId)}
                            />
                          </Tooltip>
                        );
                      })}
                    </Box>
                    <Tooltip title="Next span">
                      <span>
                        <IconButton
                          size="small"
                          aria-label="Select next span"
                          disabled={!canSelectNextTimelineSpan}
                          onClick={() =>
                            onSelectSpan?.(timelineSpans[selectedTimelineIndex + 1]!.spanId)
                          }
                          sx={{ p: 0.5 }}
                        >
                          <ChevronRightIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </Box>
              )}
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
                value={formatStatusLabel(span.status)}
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
              <KeyValueRow
                label="Timestamp"
                value={tsDisplay}
                onCopy={span.timestamp ? () => handleCopy(tsDisplay) : undefined}
              />
            </Box>
          )}

          {tabIndex === 1 && (
            <Box sx={{ p: 1 }}>
              {spanAttrs.length === 0 ? (
                <EmptyState size="small" heading="No span attributes" />
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
                <EmptyState size="small" heading="No resource attributes" />
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

          {tabIndex === 3 && (
            <Box sx={{ p: 1 }}>
              {!span.links || span.links.length === 0 ? (
                <Typography variant="caption" color="text.secondary" sx={{ p: 1 }}>
                  No span links
                </Typography>
              ) : (
                span.links.map((link: SpanLink, i: number) => (
                  <Box
                    key={`${link.traceId}-${link.spanId}`}
                    sx={{ mb: 1, border: 1, borderColor: "divider", borderRadius: 1 }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ display: "block", pt: 0.5, px: 1, fontWeight: 600 }}
                    >
                      Link {i + 1}
                    </Typography>
                    <KeyValueRow
                      label="trace.id"
                      value={link.traceId}
                      onCopy={() => handleCopy(link.traceId)}
                    />
                    <KeyValueRow
                      label="span.id"
                      value={link.spanId}
                      onCopy={() => handleCopy(link.spanId)}
                    />
                    {Object.entries(link.attributes).map(([k, v]) => (
                      <KeyValueRow
                        key={k}
                        label={k}
                        value={String(v)}
                        onCopy={() => handleCopy(String(v))}
                      />
                    ))}
                  </Box>
                ))
              )}
            </Box>
          )}

          {tabIndex === 4 && (
            <Box sx={{ p: 1 }}>
              {!span.events || span.events.length === 0 ? (
                <Typography variant="caption" color="text.secondary" sx={{ p: 1 }}>
                  No events
                </Typography>
              ) : (
                span.events.map((event) => (
                  <Box
                    key={`${event.name}-${event.timestamp}`}
                    sx={{ mb: 1, border: 1, borderColor: "divider", borderRadius: 1 }}
                  >
                    <Box sx={{ py: 0.5, px: 1, borderBottom: 1, borderColor: "divider" }}>
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {event.name || "(unnamed event)"}
                      </Typography>
                      {event.timestamp && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ ml: 1, fontFamily: "monospace" }}
                        >
                          {formatEventTimestamp(event.timestamp)}
                        </Typography>
                      )}
                    </Box>
                    {Object.keys(event.attributes).length > 0 ? (
                      Object.entries(event.attributes).map(([key, value]) => (
                        <KeyValueRow
                          key={key}
                          label={key}
                          value={String(value)}
                          onCopy={() => handleCopy(String(value))}
                        />
                      ))
                    ) : (
                      <Typography variant="caption" color="text.secondary" sx={{ py: 0.5, px: 1 }}>
                        No attributes
                      </Typography>
                    )}
                  </Box>
                ))
              )}
            </Box>
          )}
        </Box>

        {/* Footer actions */}
        <Box sx={{ display: "flex", gap: 1, p: 1, borderTop: 1, borderColor: "divider" }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<FilterAltIcon />}
            onClick={() => onFilterBy(DEFAULT_FIELD_MAPPING_SERVICE, span.serviceName)}
          >
            Filter by service
          </Button>
          {onOpenInQueryLab && (
            <Button
              size="small"
              variant="contained"
              onClick={() =>
                onOpenInQueryLab({
                  traceId: span.traceId,
                  spanId: span.spanId,
                  timestamp: span.timestamp,
                })
              }
            >
              Open in Query Lab
            </Button>
          )}
        </Box>
      </Box>
    </Drawer>
  );
}
