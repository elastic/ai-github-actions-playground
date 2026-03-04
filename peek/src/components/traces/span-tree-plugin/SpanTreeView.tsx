/**
 * Main span tree view container.
 * Composes toolbar + virtualized list of span/group rows.
 */
import { useCallback, useMemo } from "react";
import Box from "@mui/material/Box";
import { Virtuoso } from "react-virtuoso";

import { getTraceTimeBounds } from "../traceUtils";
import ContentSkeleton from "../../ContentSkeleton";
import EmptyState from "../../EmptyState";

import { useSpanTree } from "./useSpanTree";
import { SpanTreeRow } from "./SpanTreeRow";
import { SpanTreeGroupRow } from "./SpanTreeGroupRow";
import SpanTreeToolbar from "./SpanTreeToolbar";
import type { SpanTreeViewProps, SpanTreeRowItem } from "./spanTreeTypes";

const ROW_HEIGHT = 32;

export default function SpanTreeView({
  spans,
  options,
  showToolbar = true,
  selectedTraceId,
  selectedSpanId,
  onSelectTrace,
  onSelectSpan,
  onBack,
  onOpenInQueryLab,
  maxDuration,
  loading,
}: SpanTreeViewProps) {
  const visual = options?.visual;
  const autoCollapseThreshold = visual?.autoCollapseThreshold ?? 3;
  const defaultExpandDepth = visual?.defaultExpandDepth ?? 2;

  const { flatRows, searchMode, toggleExpand, toggleGroup, expandAll, collapseAll } = useSpanTree(
    spans,
    { autoCollapseThreshold, defaultExpandDepth },
  );

  const traceBounds = useMemo(
    () => (searchMode ? null : getTraceTimeBounds(spans)),
    [spans, searchMode],
  );
  const traceDuration = traceBounds ? traceBounds.endUs - traceBounds.startUs : 0;
  const traceBoundsByTraceId = useMemo(() => {
    const boundsByTrace = new Map<string, { startUs: number; endUs: number }>();
    for (const span of spans) {
      const existing = boundsByTrace.get(span.traceId);
      const endUs = span.startTimeUs + span.durationUs;
      if (!existing) {
        boundsByTrace.set(span.traceId, { startUs: span.startTimeUs, endUs });
      } else {
        existing.startUs = Math.min(existing.startUs, span.startTimeUs);
        existing.endUs = Math.max(existing.endUs, endUs);
      }
    }
    return boundsByTrace;
  }, [spans]);

  const effectiveMaxDuration = maxDuration ?? spans.reduce((m, s) => Math.max(m, s.durationUs), 1);

  const showTimestamp = visual?.showTimestamp ?? searchMode;
  const showTimeline = visual?.showTimeline ?? true;

  const handleRowClick = useCallback(
    (spanId: string) => {
      if (searchMode && onSelectTrace) {
        const span = spans.find((s) => s.spanId === spanId);
        if (span) {
          onSelectTrace(span.traceId, span.spanId, span.timestamp);
        }
      } else if (onSelectSpan) {
        onSelectSpan(spanId);
      }
    },
    [searchMode, onSelectTrace, onSelectSpan, spans],
  );

  const computeTimelineProps = useCallback(
    (item: SpanTreeRowItem) => {
      if (item.type === "span") {
        const { span } = item.node;
        if (searchMode) {
          return {
            timelineOffset: null as number | null,
            timelineFraction: effectiveMaxDuration > 0 ? span.durationUs / effectiveMaxDuration : 0,
          };
        }
        const bounds = traceBoundsByTraceId.get(span.traceId) ?? traceBounds;
        const boundsDuration = bounds ? bounds.endUs - bounds.startUs : traceDuration;
        if (bounds && boundsDuration > 0) {
          return {
            timelineOffset: (span.startTimeUs - bounds.startUs) / boundsDuration,
            timelineFraction: span.durationUs / boundsDuration,
          };
        }
        return { timelineOffset: null as number | null, timelineFraction: 0 };
      }
      // Group row
      const groupTraceId = item.spans[0]?.span.traceId;
      const bounds = (groupTraceId ? traceBoundsByTraceId.get(groupTraceId) : null) ?? traceBounds;
      const boundsDuration = bounds ? bounds.endUs - bounds.startUs : traceDuration;
      if (bounds && boundsDuration > 0) {
        const firstStart = Math.min(...item.spans.map((n) => n.span.startTimeUs));
        const lastEnd = Math.max(...item.spans.map((n) => n.span.startTimeUs + n.span.durationUs));
        return {
          timelineOffset: (firstStart - bounds.startUs) / boundsDuration,
          timelineFraction: (lastEnd - firstStart) / boundsDuration,
        };
      }
      return {
        timelineOffset: null as number | null,
        timelineFraction:
          effectiveMaxDuration > 0 ? item.stats.totalDurationUs / effectiveMaxDuration : 0,
      };
    },
    [searchMode, traceBoundsByTraceId, traceBounds, traceDuration, effectiveMaxDuration],
  );

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <ContentSkeleton variant="table" />
      </Box>
    );
  }

  if (spans.length === 0) {
    return (
      <EmptyState
        heading={
          searchMode ? "No traces matched the current filters." : "No spans found for this trace."
        }
        description={
          searchMode
            ? "Adjust filters or widen the time range."
            : "The trace may have expired or the query returned no results."
        }
      />
    );
  }

  const renderRow = (_index: number, item: SpanTreeRowItem) => {
    const timeline = computeTimelineProps(item);

    if (item.type === "group") {
      const isTraceRootGroup = item.spans.every(
        (groupNode) => !groupNode.span.parentSpanId || groupNode.span.parentSpanId === "",
      );
      return (
        <SpanTreeGroupRow
          groupKey={item.groupKey}
          representativeSpanId={item.spans[0]?.span.spanId ?? ""}
          isTraceRootGroup={isTraceRootGroup}
          depth={item.depth}
          stats={item.stats}
          expanded={item.expanded}
          onToggle={toggleGroup}
          onClick={handleRowClick}
          timelineOffset={timeline.timelineOffset}
          timelineFraction={timeline.timelineFraction}
          showTimeline={showTimeline}
        />
      );
    }

    return (
      <SpanTreeRow
        node={item.node}
        isTraceRoot={!item.node.span.parentSpanId || item.node.span.parentSpanId === ""}
        expanded={item.expanded}
        hasChildren={item.hasChildren}
        selected={item.node.span.spanId === selectedSpanId}
        onToggle={toggleExpand}
        onClick={handleRowClick}
        timelineOffset={timeline.timelineOffset}
        timelineFraction={timeline.timelineFraction}
        showTimeline={showTimeline}
        showTimestamp={showTimestamp}
      />
    );
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {showToolbar && (
        <SpanTreeToolbar
          searchMode={searchMode}
          spanCount={spans.length}
          traceId={searchMode ? null : selectedTraceId}
          onBack={searchMode ? undefined : onBack}
          onExpandAll={searchMode ? undefined : expandAll}
          onCollapseAll={searchMode ? undefined : collapseAll}
          onOpenInQueryLab={searchMode ? undefined : onOpenInQueryLab}
        />
      )}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <Virtuoso
          data={flatRows}
          fixedItemHeight={ROW_HEIGHT}
          itemContent={renderRow}
          style={{ height: "100%" }}
        />
      </Box>
    </Box>
  );
}
