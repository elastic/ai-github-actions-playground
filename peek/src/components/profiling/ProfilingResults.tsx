import { Fragment } from "react";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import type { EsqlResponse } from "../../types";
import EmptyState from "../EmptyState";
import ProfilingFlamegraph from "../visualizations/ProfilingFlamegraph";
import ProfilingFlamescope from "../visualizations/ProfilingFlamescope";
import TimeSeriesChart from "../visualizations/TimeSeriesChart";

import type { FlamegraphNode, SymbolizedStacktrace, TopFunctionRow } from "./profilingUtils";
import type { ViewMode } from "./useProfilingData";

interface ProfilingResultsProps {
  loading: boolean;
  hasRun: boolean;
  error: string | null;
  viewMode: ViewMode;
  topFunctionsRows: TopFunctionRow[];
  timelineResult: EsqlResponse | null;
  stacktraces: SymbolizedStacktrace[];
  flamegraphTree: FlamegraphNode;
  onFlamescopeWindowChange: (window: { from: string; to: string } | null) => void;
  handleFrameClick: (frameName: string) => void;
  expandedStacktraceIds: Set<string>;
  toggleExpandedStacktraceId: (id: string) => void;
}

export default function ProfilingResults({
  loading,
  hasRun,
  error,
  viewMode,
  topFunctionsRows,
  timelineResult,
  stacktraces,
  flamegraphTree,
  onFlamescopeWindowChange,
  handleFrameClick,
  expandedStacktraceIds,
  toggleExpandedStacktraceId,
}: ProfilingResultsProps) {
  if (loading) return null;

  return (
    <Paper variant="outlined" sx={{ flex: 1, minHeight: 320, overflow: "auto" }}>
      {hasRun &&
        !error &&
        topFunctionsRows.length === 0 &&
        stacktraces.length === 0 &&
        !timelineResult && (
          <EmptyState
            heading="No profiling data found"
            description="No samples matched the selected focus and time range."
            size="small"
          />
        )}
      {viewMode === "topFunctions" && topFunctionsRows.length > 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Function</TableCell>
              <TableCell align="right">Self count</TableCell>
              <TableCell align="right">Total count</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {topFunctionsRows.map((row, index) => (
              <TableRow key={`${row.functionName}-${index}`}>
                <TableCell>{row.functionName}</TableCell>
                <TableCell align="right">{row.selfCount ?? "—"}</TableCell>
                <TableCell align="right">{row.totalCount ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {viewMode === "timeline" && timelineResult && (
        <Box sx={{ height: 360 }}>
          <TimeSeriesChart data={timelineResult} options={{ smooth: true, showArea: false }} />
        </Box>
      )}
      {viewMode === "stacktraces" && stacktraces.length > 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Stacktrace ID</TableCell>
              <TableCell align="right">Count</TableCell>
              <TableCell>Service</TableCell>
              <TableCell>Host</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {stacktraces.map((stacktrace) => {
              const isExpanded = expandedStacktraceIds.has(stacktrace.stacktraceId);
              const detailsId = `stacktrace-details-${stacktrace.stacktraceId}`;
              return (
                <Fragment key={stacktrace.stacktraceId}>
                  <TableRow
                    hover
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    aria-controls={detailsId}
                    onClick={() => toggleExpandedStacktraceId(stacktrace.stacktraceId)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleExpandedStacktraceId(stacktrace.stacktraceId);
                      }
                    }}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell sx={{ fontSize: "0.75rem", fontFamily: "monospace" }}>
                      {stacktrace.stacktraceId}
                    </TableCell>
                    <TableCell align="right">{stacktrace.count}</TableCell>
                    <TableCell>{stacktrace.serviceName || "—"}</TableCell>
                    <TableCell>{stacktrace.hostName || "—"}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={4} sx={{ py: 0 }}>
                      <Collapse in={isExpanded}>
                        <Box id={detailsId} sx={{ p: 1 }}>
                          {stacktrace.frames.map((frame) => (
                            <Typography
                              key={`${stacktrace.stacktraceId}-${frame.frameId}`}
                              variant="caption"
                              sx={{ display: "block", fontFamily: "monospace" }}
                            >
                              {frame.functionName}{" "}
                              {frame.fileName
                                ? `(${frame.fileName}${frame.lineNumber ? `:${frame.lineNumber}` : ""})`
                                : ""}
                            </Typography>
                          ))}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      )}
      {viewMode === "flamegraph" && stacktraces.length > 0 && (
        <Box sx={{ height: 480 }}>
          <ProfilingFlamegraph tree={flamegraphTree} onFrameClick={handleFrameClick} />
        </Box>
      )}
      {viewMode === "flamescope" && stacktraces.length > 0 && (
        <ProfilingFlamescope
          stacktraces={stacktraces}
          onWindowChange={onFlamescopeWindowChange}
          onFrameClick={handleFrameClick}
        />
      )}
    </Paper>
  );
}
