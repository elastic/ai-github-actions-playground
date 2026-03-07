import { useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Drawer from "@mui/material/Drawer";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Tab from "@mui/material/Tab";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";

import { usePageSlotInsights } from "../hooks/usePageSlotInsights";
import { INSIGHT_GUARDRAIL } from "../hooks/insightPromptUtils";
import { useNodesHotThreads } from "../hooks/useNodesHotThreads";
import { parseHotThreadsText, type ParsedHotThread } from "../utils/parseHotThreads";

import EmptyState from "./EmptyState";
import InsightSlot from "./InsightSlot";
import { InsightSlotProvider } from "./InsightSlotContext";
import PageContainer from "./PageContainer";
import PageHeader from "./PageHeader";
import { HOT_THREADS_INSIGHT_SLOT_IDS, HOT_THREADS_INSIGHT_SLOTS } from "./hotThreadsInsightSlots";

const SAMPLE_TYPES = ["cpu", "wait", "block", "mem", "gpu"] as const;
const SAMPLE_TYPE_LABELS: Record<HotThreadSampleType, string> = {
  cpu: "CPU usage",
  wait: "Wait time",
  block: "Blocked time",
  mem: "Memory allocation",
  gpu: "GPU usage",
};

type HotThreadSampleType = (typeof SAMPLE_TYPES)[number];

function formatSampleValue(value: number, unit: string): string {
  if (unit === "%") {
    const rounded = Number(value.toFixed(1));
    if (rounded === 0) return "";
    return `${rounded.toFixed(1)}%`;
  }
  if (!Number.isFinite(value)) return "n/a";
  return `${value.toFixed(1)}${unit}`;
}

export default function NodesHotThreadsPage() {
  const [nodeId, setNodeId] = useState("");
  const [type, setType] = useState<HotThreadSampleType>("cpu");
  const [threads, setThreads] = useState("3");
  const [snapshots, setSnapshots] = useState("10");
  const [interval, setInterval] = useState("500ms");
  const [ignoreIdleThreads, setIgnoreIdleThreads] = useState(true);
  const [resultTab, setResultTab] = useState<"parsed" | "raw">("parsed");
  const [groupByThread, setGroupByThread] = useState(false);
  const [selectedThread, setSelectedThread] = useState<ParsedHotThread | null>(null);

  const result = useNodesHotThreads({
    nodeId: nodeId.trim() || undefined,
    type,
    sort: type === "cpu" ? "cpu" : undefined,
    threads: Number.parseInt(threads, 10) || 3,
    snapshots: Number.parseInt(snapshots, 10) || 10,
    interval: interval.trim() || undefined,
    ignoreIdleThreads,
  });
  const loading = result.status === "loading";
  const parsedEntries = result.status === "success" ? parseHotThreadsText(result.data) : [];
  const hasHotThreadsHeader = result.status === "success" && /Hot threads at\s+/i.test(result.data);
  const visibleParsedEntries = useMemo(
    () =>
      parsedEntries.filter(
        (entry) => !(entry.sampleUnit === "%" && Number(entry.sampleValue.toFixed(1)) === 0),
      ),
    [parsedEntries],
  );
  const groupedEntries = useMemo(() => {
    const byThread = new Map<
      string,
      {
        threadName: string;
        sampleCount: number;
        nodeSet: Set<string>;
        maxSample: number;
        sumSample: number;
        sampleUnit: string;
        sampleType: string;
        topFrame: string;
      }
    >();
    for (const entry of visibleParsedEntries) {
      const existing = byThread.get(entry.threadName) ?? {
        threadName: entry.threadName,
        sampleCount: 0,
        nodeSet: new Set<string>(),
        maxSample: Number.NEGATIVE_INFINITY,
        sumSample: 0,
        sampleUnit: entry.sampleUnit,
        sampleType: entry.sampleType,
        topFrame: entry.topFrame,
      };
      existing.sampleCount += 1;
      existing.nodeSet.add(entry.node);
      existing.sumSample += entry.sampleValue;
      if (entry.sampleValue >= existing.maxSample) {
        existing.maxSample = entry.sampleValue;
        existing.sampleUnit = entry.sampleUnit;
        existing.sampleType = entry.sampleType;
        existing.topFrame = entry.topFrame || existing.topFrame;
      }
      byThread.set(entry.threadName, existing);
    }
    return Array.from(byThread.values())
      .map((item) => ({
        ...item,
        avgSample: item.sampleCount > 0 ? item.sumSample / item.sampleCount : 0,
        nodes: item.nodeSet.size,
      }))
      .sort((a, b) => b.maxSample - a.maxSample || b.sampleCount - a.sampleCount);
  }, [visibleParsedEntries]);

  const insightContext = useMemo(
    () =>
      result.status === "success"
        ? JSON.stringify({
            selectedType: type,
            ignoreIdleThreads,
            requestedThreads: Number.parseInt(threads, 10) || 3,
            requestedSnapshots: Number.parseInt(snapshots, 10) || 10,
            requestedInterval: interval.trim() || "500ms",
            nodeFilter: nodeId.trim() || null,
            parsedSampleCount: visibleParsedEntries.length,
            groupedThreadCount: groupedEntries.length,
            selectedThread: selectedThread
              ? {
                  node: selectedThread.node,
                  threadName: selectedThread.threadName,
                  sampleType: selectedThread.sampleType,
                  sampleValue: selectedThread.sampleValue,
                  sampleUnit: selectedThread.sampleUnit,
                  snapshotSummary: selectedThread.snapshotSummary || null,
                  topFrame: selectedThread.topFrame || null,
                }
              : null,
            topSamples: visibleParsedEntries.slice(0, 8).map((entry) => ({
              node: entry.node,
              threadName: entry.threadName,
              sampleType: entry.sampleType,
              sampleValue: entry.sampleValue,
              sampleUnit: entry.sampleUnit,
              snapshotSummary: entry.snapshotSummary || null,
              topFrame: entry.topFrame || null,
            })),
          })
        : "",
    [
      result.status,
      type,
      ignoreIdleThreads,
      threads,
      snapshots,
      interval,
      nodeId,
      visibleParsedEntries,
      groupedEntries,
      selectedThread,
    ],
  );

  const slotInsights = usePageSlotInsights({
    context: insightContext,
    systemPrompt:
      "You are an Elasticsearch hot threads performance advisor. " +
      "Generate concise, high-signal insights for the requested slots. " +
      "Use official Elasticsearch hot threads behavior: output is plain text diagnostics; " +
      "defaults are threads=3, snapshots=10, interval=500ms, ignore_idle_threads=true; " +
      "sample types include cpu, wait, block, mem, and gpu; key endpoints are /_nodes/hot_threads and /_nodes/{node_id}/hot_threads. " +
      "Interpret stacks carefully: parked queue-waiting threads with near-zero samples are often benign; prioritize persistent non-trivial samples and actionable next checks. " +
      "If evidence is weak, say that explicitly instead of over-claiming. " +
      INSIGHT_GUARDRAIL,
    cacheKey:
      `hot-threads-slots::${type}` +
      `::${threads}` +
      `::${snapshots}` +
      `::${interval}` +
      `::${ignoreIdleThreads ? "idle-on" : "idle-off"}` +
      `::${nodeId.trim()}` +
      `::${visibleParsedEntries.length}` +
      `::${groupedEntries.length}` +
      `::${selectedThread?.threadName ?? ""}`,
    slots: HOT_THREADS_INSIGHT_SLOTS,
    enabled: result.status === "success" && visibleParsedEntries.length > 0,
  });

  return (
    <InsightSlotProvider
      summary={slotInsights.summary}
      insights={slotInsights.insights}
      loading={slotInsights.loading}
      error={slotInsights.error}
      refresh={slotInsights.refresh}
    >
      <PageContainer>
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <PageHeader
            title="Hot Threads"
            description="Inspect node hot threads from /_nodes/hot_threads for CPU or contention hotspots."
            actions={
              <Button
                size="small"
                variant="outlined"
                onClick={result.refresh}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={14} aria-hidden="true" /> : undefined}
              >
                {loading ? "Refreshing..." : "Refresh"}
              </Button>
            }
          />
          <InsightSlot slotId={HOT_THREADS_INSIGHT_SLOT_IDS.controls}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mt: 1 }}>
              <TextField
                size="small"
                label="Node ID (optional)"
                placeholder="node-a or node-a,node-b"
                value={nodeId}
                onChange={(event) => setNodeId(event.target.value)}
                inputProps={{ "aria-label": "Node ID for hot threads" }}
                sx={{ minWidth: 240 }}
              />
              <TextField
                select
                size="small"
                label="Type"
                value={type}
                onChange={(event) => setType(event.target.value as HotThreadSampleType)}
                inputProps={{ "aria-label": "Hot threads sample type" }}
                sx={{ minWidth: 220 }}
              >
                {SAMPLE_TYPES.map((sampleType) => (
                  <MenuItem key={sampleType} value={sampleType}>
                    {SAMPLE_TYPE_LABELS[sampleType]}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                label="Threads"
                value={threads}
                onChange={(event) => setThreads(event.target.value)}
                inputProps={{ inputMode: "numeric", "aria-label": "Hot threads count" }}
                sx={{ width: 110 }}
              />
              <TextField
                size="small"
                label="Snapshots"
                value={snapshots}
                onChange={(event) => setSnapshots(event.target.value)}
                inputProps={{ inputMode: "numeric", "aria-label": "Hot threads snapshots count" }}
                sx={{ width: 120 }}
              />
              <TextField
                size="small"
                label="Interval"
                value={interval}
                onChange={(event) => setInterval(event.target.value)}
                inputProps={{ "aria-label": "Hot threads interval" }}
                sx={{ width: 130 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={ignoreIdleThreads}
                    onChange={(event) => setIgnoreIdleThreads(event.target.checked)}
                    inputProps={{ "aria-label": "Ignore idle threads" }}
                  />
                }
                label={<Typography variant="body2">Ignore idle threads</Typography>}
              />
            </Stack>
          </InsightSlot>
        </Paper>

        {result.status === "error" && <Alert severity="error">{result.error}</Alert>}
        {slotInsights.error && (
          <Alert severity="warning">AI insights unavailable: {slotInsights.error}</Alert>
        )}

        <InsightSlot slotId={HOT_THREADS_INSIGHT_SLOT_IDS.resultsPanel}>
          <Paper
            variant="outlined"
            sx={{
              display: "flex",
              flex: 1,
              flexDirection: "column",
              minHeight: 0,
              overflow: "hidden",
              gap: 1,
              p: 1,
            }}
          >
            {result.status === "success" ? (
              <>
                <Paper
                  variant="outlined"
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 180,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <Tabs
                    value={resultTab}
                    onChange={(_, next: "parsed" | "raw") => setResultTab(next)}
                    sx={{ borderBottom: 1, borderColor: "divider", px: 1 }}
                  >
                    <Tab
                      value="parsed"
                      label={`Parsed (${visibleParsedEntries.length.toLocaleString()})`}
                      aria-label="Parsed hot threads tab"
                    />
                    <Tab value="raw" label="Raw" aria-label="Raw hot threads tab" />
                  </Tabs>

                  {resultTab === "parsed" ? (
                    visibleParsedEntries.length === 0 ? (
                      <EmptyState
                        size="small"
                        heading={
                          hasHotThreadsHeader
                            ? "No parsed hot threads"
                            : "Unable to parse hot threads"
                        }
                        description={
                          hasHotThreadsHeader
                            ? "No thread samples were returned for this snapshot. Try increasing Threads or turning off Ignore idle threads, then refresh."
                            : "Could not parse sample rows from this output. Switch to Raw to inspect the full text."
                        }
                      />
                    ) : (
                      <>
                        <Box sx={{ px: 1, pt: 0.5 }}>
                          <FormControlLabel
                            control={
                              <Switch
                                size="small"
                                checked={groupByThread}
                                onChange={(event) => setGroupByThread(event.target.checked)}
                                inputProps={{
                                  "aria-label": "Group parsed hot threads by thread name",
                                }}
                              />
                            }
                            label={<Typography variant="body2">Group by thread</Typography>}
                            sx={{ ml: 0 }}
                          />
                        </Box>
                        <TableContainer sx={{ overflow: "auto", flex: 1 }}>
                          {groupByThread ? (
                            <Table
                              size="small"
                              stickyHeader
                              aria-label="Grouped hot threads table"
                              sx={{ tableLayout: "fixed" }}
                            >
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ width: "34%" }}>Thread</TableCell>
                                  <TableCell>Type</TableCell>
                                  <TableCell align="right">Samples</TableCell>
                                  <TableCell align="right">Nodes</TableCell>
                                  <TableCell align="right">Max sample</TableCell>
                                  <TableCell align="right">Avg sample</TableCell>
                                  <TableCell>Top frame</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {groupedEntries.map((entry) => (
                                  <TableRow key={entry.threadName}>
                                    <TableCell>
                                      <Typography
                                        variant="body2"
                                        title={entry.threadName}
                                        sx={{
                                          whiteSpace: "normal",
                                          wordBreak: "break-word",
                                          overflowWrap: "anywhere",
                                          display: "-webkit-box",
                                          WebkitLineClamp: 2,
                                          WebkitBoxOrient: "vertical",
                                          overflow: "hidden",
                                          lineHeight: 1.3,
                                        }}
                                      >
                                        {entry.threadName}
                                      </Typography>
                                    </TableCell>
                                    <TableCell>{entry.sampleType}</TableCell>
                                    <TableCell align="right">{entry.sampleCount}</TableCell>
                                    <TableCell align="right">{entry.nodes}</TableCell>
                                    <TableCell align="right">
                                      {formatSampleValue(entry.maxSample, entry.sampleUnit)}
                                    </TableCell>
                                    <TableCell align="right">
                                      {formatSampleValue(entry.avgSample, entry.sampleUnit)}
                                    </TableCell>
                                    <TableCell>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}
                                        noWrap
                                        title={entry.topFrame || ""}
                                      >
                                        {entry.topFrame || "n/a"}
                                      </Typography>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <Table
                              size="small"
                              stickyHeader
                              aria-label="Parsed hot threads table"
                              sx={{ tableLayout: "fixed" }}
                            >
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ width: "20%" }}>Node</TableCell>
                                  <TableCell sx={{ width: "12%" }}>Type</TableCell>
                                  <TableCell align="right" sx={{ width: "12%" }}>
                                    Sample
                                  </TableCell>
                                  <TableCell sx={{ width: "30%" }}>Thread</TableCell>
                                  <TableCell>Top frame</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {visibleParsedEntries.map((entry, idx) => (
                                  <TableRow
                                    key={`${entry.node}:${entry.threadName}:${idx}`}
                                    hover
                                    onClick={() => setSelectedThread(entry)}
                                    sx={{ cursor: "pointer" }}
                                    aria-label={`Open parsed thread ${entry.threadName}`}
                                  >
                                    <TableCell>
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          whiteSpace: "normal",
                                          wordBreak: "break-word",
                                          overflowWrap: "anywhere",
                                          display: "-webkit-box",
                                          WebkitLineClamp: 2,
                                          WebkitBoxOrient: "vertical",
                                          overflow: "hidden",
                                          lineHeight: 1.3,
                                        }}
                                        title={entry.node}
                                      >
                                        {entry.node}
                                      </Typography>
                                    </TableCell>
                                    <TableCell>{entry.sampleType}</TableCell>
                                    <TableCell align="right">
                                      {formatSampleValue(entry.sampleValue, entry.sampleUnit)}
                                    </TableCell>
                                    <TableCell>
                                      <Typography
                                        variant="body2"
                                        title={entry.threadName}
                                        sx={{
                                          whiteSpace: "normal",
                                          wordBreak: "break-word",
                                          overflowWrap: "anywhere",
                                          display: "-webkit-box",
                                          WebkitLineClamp: 2,
                                          WebkitBoxOrient: "vertical",
                                          overflow: "hidden",
                                          lineHeight: 1.3,
                                        }}
                                      >
                                        {entry.threadName}
                                      </Typography>
                                    </TableCell>
                                    <TableCell>
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          fontFamily: "monospace",
                                          fontSize: "0.75rem",
                                          whiteSpace: "normal",
                                          wordBreak: "break-word",
                                          overflowWrap: "anywhere",
                                          display: "-webkit-box",
                                          WebkitLineClamp: 2,
                                          WebkitBoxOrient: "vertical",
                                          overflow: "hidden",
                                          lineHeight: 1.3,
                                        }}
                                        title={entry.topFrame || ""}
                                      >
                                        {entry.topFrame || "n/a"}
                                      </Typography>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </TableContainer>
                      </>
                    )
                  ) : (
                    <Box sx={{ p: 1.5, overflow: "auto", flex: 1 }}>
                      <Typography
                        component="pre"
                        variant="body2"
                        sx={{
                          m: 0,
                          fontFamily: "monospace",
                          fontSize: "0.78rem",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                        data-testid="nodes-hot-threads-output"
                      >
                        {result.data}
                      </Typography>
                    </Box>
                  )}
                </Paper>
              </>
            ) : (
              <EmptyState
                size="small"
                heading="Hot threads output unavailable"
                description={
                  loading
                    ? "Loading hot threads snapshot..."
                    : "Run the request to inspect hot threads across nodes."
                }
              />
            )}
          </Paper>
        </InsightSlot>
        <Drawer
          anchor="right"
          open={Boolean(selectedThread)}
          onClose={() => setSelectedThread(null)}
          PaperProps={{
            sx: {
              width: { xs: "100%", md: 640 },
              p: 1,
              backgroundColor: "background.default",
            },
          }}
        >
          <Box
            sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1 }}
          >
            <Typography variant="subtitle1">Thread details</Typography>
            <IconButton
              size="small"
              aria-label="Close thread details"
              onClick={() => setSelectedThread(null)}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box sx={{ p: 1, overflow: "auto", minHeight: 0, flex: 1 }}>
            {!selectedThread ? null : (
              <InsightSlot slotId={HOT_THREADS_INSIGHT_SLOT_IDS.detailsDrawer}>
                <Stack spacing={1.25} sx={{ minHeight: 0 }}>
                  <Paper variant="outlined" sx={{ p: 1 }}>
                    <Stack spacing={1}>
                      <Stack direction="row" spacing={1} alignItems="baseline">
                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>
                          Node
                        </Typography>
                        <Typography variant="body2">{selectedThread.node}</Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="baseline">
                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>
                          Thread
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: "monospace",
                            fontSize: "0.78rem",
                            wordBreak: "break-word",
                          }}
                        >
                          {selectedThread.threadName}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="baseline">
                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>
                          Type
                        </Typography>
                        <Typography variant="body2">{selectedThread.sampleType}</Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="baseline">
                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>
                          Sample
                        </Typography>
                        <Typography variant="body2">
                          {formatSampleValue(selectedThread.sampleValue, selectedThread.sampleUnit)}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="baseline">
                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>
                          Window
                        </Typography>
                        <Typography variant="body2">{selectedThread.sampleWindow}</Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="baseline">
                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>
                          Snapshots
                        </Typography>
                        <Typography variant="body2">
                          {selectedThread.snapshotSummary || "n/a"}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Paper>

                  <Paper
                    variant="outlined"
                    sx={{ display: "flex", flexDirection: "column", minHeight: 240, flex: 1 }}
                  >
                    <Box sx={{ px: 1, py: 1, borderBottom: 1, borderColor: "divider" }}>
                      <Typography variant="subtitle1">Stack frames</Typography>
                    </Box>
                    {selectedThread.stackFrames.length === 0 ? (
                      <EmptyState
                        size="small"
                        heading="No stack frames parsed"
                        description="No stack frames were parsed for this sample."
                      />
                    ) : (
                      <Box
                        component="ol"
                        sx={{ m: 0, pl: 3, pr: 1.5, py: 1, overflow: "auto", flex: 1 }}
                      >
                        {selectedThread.stackFrames.map((frame, idx) => (
                          <Typography
                            key={`${frame}:${idx}`}
                            component="li"
                            variant="body2"
                            sx={{
                              fontFamily: "monospace",
                              fontSize: "0.75rem",
                              wordBreak: "break-word",
                              py: 0.5,
                            }}
                          >
                            {frame}
                          </Typography>
                        ))}
                      </Box>
                    )}
                  </Paper>
                </Stack>
              </InsightSlot>
            )}
          </Box>
        </Drawer>
      </PageContainer>
    </InsightSlotProvider>
  );
}
