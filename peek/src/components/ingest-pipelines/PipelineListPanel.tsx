import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import type { PipelineEntry } from "../../hooks/useIngestPipelines";
import { formatMs } from "../../utils/formatDuration";
import EmptyState from "../EmptyState";

type SortField = "name" | "processors" | "docs" | "failed" | "timeMs" | "avgMsPerDoc" | "nodes";
type SortDirection = "asc" | "desc";

interface PipelineRuntimeSummary {
  count: number;
  failed: number;
  current: number;
  timeMs: number;
  nodes: number;
}

interface PipelineListPanelProps {
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  showSystemPipelines: boolean;
  onShowSystemPipelinesChange: (value: boolean) => void;
  filteredPipelines: PipelineEntry[];
  runtimeStatus: "idle" | "loading" | "success" | "error";
  runtimeByPipelineName: Record<string, PipelineRuntimeSummary>;
  totalPipelineCount: number;
  selectedName: string | null;
  onSelect: (name: string) => void;
}

function avgMsPerDoc(timeMs: number, count: number): string {
  if (count <= 0) return "n/a";
  const avg = timeMs / count;
  return avg < 1 ? avg.toFixed(3) : avg.toFixed(2);
}

export default function PipelineListPanel({
  loading,
  search,
  onSearchChange,
  showSystemPipelines,
  onShowSystemPipelinesChange,
  filteredPipelines,
  runtimeStatus,
  runtimeByPipelineName,
  totalPipelineCount,
  selectedName,
  onSelect,
}: PipelineListPanelProps) {
  const [sortField, setSortField] = useState<SortField>("timeMs");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedPipelines = useMemo(() => {
    const rows = [...filteredPipelines];
    rows.sort((a, b) => {
      const aRuntime = runtimeByPipelineName[a.name] ?? {
        count: 0,
        failed: 0,
        current: 0,
        timeMs: 0,
        nodes: 0,
      };
      const bRuntime = runtimeByPipelineName[b.name] ?? {
        count: 0,
        failed: 0,
        current: 0,
        timeMs: 0,
        nodes: 0,
      };

      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "processors":
          cmp = (a.pipeline.processors?.length ?? 0) - (b.pipeline.processors?.length ?? 0);
          break;
        case "docs":
          cmp = aRuntime.count - bRuntime.count;
          break;
        case "failed":
          cmp = aRuntime.failed - bRuntime.failed;
          break;
        case "timeMs":
          cmp = aRuntime.timeMs - bRuntime.timeMs;
          break;
        case "avgMsPerDoc": {
          const aAvg = aRuntime.count > 0 ? aRuntime.timeMs / aRuntime.count : 0;
          const bAvg = bRuntime.count > 0 ? bRuntime.timeMs / bRuntime.count : 0;
          cmp = aAvg - bAvg;
          break;
        }
        case "nodes":
          cmp = aRuntime.nodes - bRuntime.nodes;
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [filteredPipelines, runtimeByPipelineName, sortDirection, sortField]);

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDirection("asc");
  }

  return (
    <Paper
      variant="outlined"
      sx={{ display: "flex", flexDirection: "column", width: "100%", minHeight: 0 }}
    >
      <Box sx={{ p: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search pipelines"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          inputProps={{ "aria-label": "Search pipelines" }}
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={showSystemPipelines}
              onChange={(event) => onShowSystemPipelinesChange(event.target.checked)}
              inputProps={{ "aria-label": "Show system pipelines" }}
            />
          }
          label={
            <Typography variant="caption" color="text.secondary">
              Show system pipelines
            </Typography>
          }
          sx={{ mt: 0.5, ml: 0 }}
        />
      </Box>
      <TableContainer sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <Table size="small" stickyHeader aria-label="Ingest pipeline list">
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={sortField === "name"}
                  direction={sortField === "name" ? sortDirection : "asc"}
                  onClick={() => handleSort("name")}
                >
                  Name
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={sortField === "processors"}
                  direction={sortField === "processors" ? sortDirection : "asc"}
                  onClick={() => handleSort("processors")}
                >
                  Processors
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={sortField === "docs"}
                  direction={sortField === "docs" ? sortDirection : "asc"}
                  onClick={() => handleSort("docs")}
                >
                  Docs
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={sortField === "failed"}
                  direction={sortField === "failed" ? sortDirection : "asc"}
                  onClick={() => handleSort("failed")}
                >
                  Failed
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={sortField === "timeMs"}
                  direction={sortField === "timeMs" ? sortDirection : "asc"}
                  onClick={() => handleSort("timeMs")}
                >
                  Time
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={sortField === "avgMsPerDoc"}
                  direction={sortField === "avgMsPerDoc" ? sortDirection : "asc"}
                  onClick={() => handleSort("avgMsPerDoc")}
                >
                  Avg ms/doc
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={sortField === "nodes"}
                  direction={sortField === "nodes" ? sortDirection : "asc"}
                  onClick={() => handleSort("nodes")}
                >
                  Nodes
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && sortedPipelines.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" sx={{ opacity: 0.7 }}>
                    Loading pipelines…
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {sortedPipelines.map((entry) => {
              const runtime = runtimeByPipelineName[entry.name];
              const hasRuntime = runtimeStatus === "success";
              const countText = hasRuntime ? (runtime?.count ?? 0).toLocaleString() : "n/a";
              const failedText = hasRuntime ? (runtime?.failed ?? 0).toLocaleString() : "n/a";
              const timeText = hasRuntime ? formatMs(runtime?.timeMs ?? 0) : "n/a";
              const avgText = hasRuntime
                ? avgMsPerDoc(runtime?.timeMs ?? 0, runtime?.count ?? 0)
                : "n/a";
              const nodesText = hasRuntime ? (runtime?.nodes ?? 0).toLocaleString() : "n/a";
              return (
                <TableRow
                  key={entry.name}
                  hover
                  selected={entry.name === selectedName}
                  onClick={() => onSelect(entry.name)}
                  tabIndex={0}
                  aria-label={`Select pipeline ${entry.name}`}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
                      event.preventDefault();
                      onSelect(entry.name);
                    }
                  }}
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell>
                    <Typography
                      variant="body2"
                      noWrap
                      title={entry.name}
                      sx={{ fontFamily: "monospace", fontSize: "0.85rem", width: "100%" }}
                    >
                      {entry.name}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{entry.pipeline.processors?.length ?? 0}</TableCell>
                  <TableCell align="right">{countText}</TableCell>
                  <TableCell
                    align="right"
                    sx={{ color: (runtime?.failed ?? 0) > 0 ? "warning.main" : undefined }}
                  >
                    {failedText}
                  </TableCell>
                  <TableCell align="right">{timeText}</TableCell>
                  <TableCell align="right">{avgText}</TableCell>
                  <TableCell align="right">{nodesText}</TableCell>
                </TableRow>
              );
            })}
            {!loading && sortedPipelines.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} sx={{ border: 0 }}>
                  {totalPipelineCount === 0 ? (
                    <EmptyState
                      heading="No ingest pipelines"
                      description="This cluster has no ingest pipelines. Create one via Console or add data to get started."
                      addDataHref="/add-data"
                    />
                  ) : (
                    <EmptyState
                      heading="No pipelines found"
                      description="Try adjusting your search"
                    />
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
