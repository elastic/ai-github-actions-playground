import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import InputBase from "@mui/material/InputBase";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { useShallow } from "zustand/react/shallow";

import { useDashboardStore } from "../store/useDashboardStore";
import { useConnectionStore } from "../store/useConnectionStore";
import { useUIStore } from "../store/useUIStore";
import { useQueryStore } from "../store/useQueryStore";
import type { EsqlQueryParams } from "../services/es";
import { buildQueryParams } from "../services/datemath";
import type {
  VisualizationType,
  EsqlResponse,
  VisualizationOptions,
  FormatOptions,
  PanelDefinition,
} from "../types";
import { useEsqlQuery } from "../hooks/useEsqlQuery";

import Visualization from "./visualizations/Visualization";
import MarkdownPanel from "./visualizations/MarkdownPanel";
import ChartOptionsEditor from "./ChartOptionsEditor";
import { defaultOptions } from "./chartDefaults";
import QueryPipelineSteps from "./QueryPipelineSteps";
import { createEsqlQueryEditorExtensions } from "./queryEditorExtensions";
import { getAllVizEntries, getVizEntry } from "./visualizations/vizRegistry";

export default function PanelEditor() {
  const editingId = useUIStore((s) => s.editingPanelId);
  const panels = useDashboardStore((s) => s.dashboard.panels);
  const panel = panels.find((p) => p.id === editingId);

  if (!panel || !editingId) {
    return null;
  }

  return <PanelEditorDialog key={editingId} panel={panel} editingId={editingId} />;
}

function PanelEditorDialog({ panel, editingId }: { panel: PanelDefinition; editingId: string }) {
  const { setEditingPanelId: setEditingId, themeMode } = useUIStore(
    useShallow((s) => ({
      setEditingPanelId: s.setEditingPanelId,
      themeMode: s.themeMode,
    })),
  );
  const { updatePanel, removePanel, timeRange, parameters } = useDashboardStore(
    useShallow((s) => ({
      updatePanel: s.updatePanel,
      removePanel: s.removePanel,
      timeRange: s.dashboard.timeRange,
      parameters: s.dashboard.parameters,
    })),
  );
  const connection = useConnectionStore((s) => s.connection);
  const { queryHistory, appendQueryToHistory } = useQueryStore(
    useShallow((s) => ({
      queryHistory: s.queryHistory,
      appendQueryToHistory: s.appendQueryToHistory,
    })),
  );

  const [title, setTitle] = useState(panel.title);
  const [query, setQuery] = useState(panel.query);
  const [viz, setViz] = useState<VisualizationType>(panel.visualization);
  const [options, setOptions] = useState<VisualizationOptions>(
    panel.options ?? defaultOptions(panel.visualization),
  );
  const [preview, setPreview] = useState<EsqlResponse | null>(null);
  const [queryContextView, setQueryContextView] = useState<EditorView | null>(null);
  const [historyAnchor, setHistoryAnchor] = useState<HTMLElement | null>(null);
  const buildRequest = useCallback(
    (queryText: string): EsqlQueryParams => {
      const body: EsqlQueryParams = { query: queryText };
      if (!timeRange) return body;
      body.filter = {
        range: {
          "@timestamp": {
            gte: timeRange.from,
            lte: timeRange.to,
          },
        },
      };
      const queryParams = buildQueryParams(queryText, timeRange, parameters);
      if (queryParams.length > 0) {
        body.params = queryParams;
      }
      return body;
    },
    [timeRange, parameters],
  );
  const { runQuery, loading, error, activeStep } = useEsqlQuery({
    connection,
    queryContextView,
    onSuccess: (data, executedQuery) => {
      setPreview(data);
      appendQueryToHistory(executedQuery);
    },
    onFailure: () => setPreview(null),
    buildRequest,
  });

  const handleVizChange = useCallback(
    (newViz: VisualizationType) => {
      setViz(newViz);
      const next = defaultOptions(newViz);
      const supportsOptions = getVizEntry(newViz)?.supportsOptions ?? false;
      const currentFormat = (options as { format?: FormatOptions }).format;
      setOptions(supportsOptions && currentFormat ? { ...next, format: currentFormat } : next);
    },
    [options],
  );

  const handleRunQuery = useCallback(() => runQuery(query), [runQuery, query]);

  const handleRunStep = useCallback(
    (stepQuery: string, stepIndex: number) => runQuery(stepQuery, stepIndex),
    [runQuery],
  );
  const handleSelectHistory = useCallback((selectedQuery: string) => {
    setQuery(selectedQuery);
    setHistoryAnchor(null);
  }, []);
  const handleRunQueryRef = useRef(handleRunQuery);
  useEffect(() => {
    handleRunQueryRef.current = handleRunQuery;
  }, [handleRunQuery]);
  const queryEditorExtensions = useMemo(
    () => [
      EditorView.lineWrapping,
      // eslint-disable-next-line react-hooks/refs -- ref is read at event time, not during render
      ...createEsqlQueryEditorExtensions(() => void handleRunQueryRef.current()),
    ],
    [],
  );
  const basicSetup = useMemo(() => ({ lineNumbers: true, foldGutter: false }), []);
  const handleCreateEditor = useCallback((view: EditorView) => setQueryContextView(view), []);

  const handleSave = useCallback(() => {
    if (!editingId) return;
    updatePanel(editingId, { title, query, visualization: viz, options });
    setEditingId(null);
  }, [editingId, title, query, viz, options, updatePanel, setEditingId]);

  const handleDelete = useCallback(() => {
    if (!editingId) return;
    removePanel(editingId);
    setEditingId(null);
  }, [editingId, removePanel, setEditingId]);

  const showOptions = getVizEntry(viz)?.supportsOptions ?? false;
  const isMarkdown = viz === "markdown";

  return (
    <Dialog
      open={Boolean(editingId)}
      onClose={() => setEditingId(null)}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { height: "90vh" } }}
    >
      <DialogTitle
        component="div"
        sx={{ display: "flex", alignItems: "baseline", gap: 1, pb: 1.5, pt: 2, px: 3 }}
      >
        <Typography variant="h6" component="span" sx={{ flexShrink: 0, lineHeight: "inherit" }}>
          Edit
        </Typography>
        <InputBase
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Panel Title"
          inputProps={{ "aria-label": "Panel title" }}
          sx={{
            flex: 1,
            fontSize: "1.25rem",
            fontWeight: 500,
            lineHeight: "inherit",
            "& .MuiInputBase-input": {
              p: 0,
              borderBottom: "1px dashed",
              borderColor: "divider",
              "&:focus": { borderColor: "primary.main", outline: "none" },
            },
          }}
        />
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ px: 3, py: 2, display: "flex", flexDirection: "column", gap: 2 }}>
        {/* Query / content editor */}
        <Box>
          <Box
            sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}
          >
            <Typography variant="subtitle2" color="text.secondary">
              {isMarkdown ? "Markdown Content" : "ES|QL Query"}
            </Typography>
            {!isMarkdown && (
              <Typography
                component="a"
                href="https://www.elastic.co/guide/en/elasticsearch/reference/current/esql.html"
                target="_blank"
                rel="noreferrer"
                variant="caption"
                color="primary.main"
                sx={{ textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
              >
                ES|QL documentation
              </Typography>
            )}
          </Box>
          {isMarkdown ? (
            <TextField
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              multiline
              minRows={6}
              maxRows={14}
              fullWidth
              placeholder="Enter markdown text…"
              inputProps={{ "aria-label": "Markdown content" }}
              sx={{ fontFamily: "monospace" }}
            />
          ) : (
            <>
              <Box
                sx={{
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 1,
                  overflow: "hidden",
                }}
              >
                <CodeMirror
                  value={query}
                  onChange={setQuery}
                  onCreateEditor={handleCreateEditor}
                  extensions={queryEditorExtensions}
                  theme={themeMode}
                  height="120px"
                  basicSetup={basicSetup}
                />
              </Box>
              <QueryPipelineSteps
                query={query}
                loading={loading}
                activeStep={activeStep}
                onRunStep={handleRunStep}
              />
            </>
          )}
        </Box>

        {/* Query controls row — hidden for markdown panels */}
        {!isMarkdown && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Button
              variant="contained"
              size="small"
              onClick={handleRunQuery}
              disabled={loading || !query.trim()}
            >
              {loading && <CircularProgress size={14} sx={{ mr: 1 }} />}
              Run Query (Ctrl/Cmd+Enter)
            </Button>
            {preview && (
              <Typography variant="caption" color="text.secondary">
                {preview.values.length} rows × {preview.columns.length} columns
              </Typography>
            )}
            <Button
              variant="text"
              size="small"
              onClick={(e) => setHistoryAnchor(e.currentTarget)}
              disabled={queryHistory.length === 0}
            >
              Recent queries
            </Button>
            <Menu
              anchorEl={historyAnchor}
              open={Boolean(historyAnchor)}
              onClose={() => setHistoryAnchor(null)}
            >
              {queryHistory.map((historyQuery, idx) => (
                <MenuItem key={idx} onClick={() => handleSelectHistory(historyQuery)}>
                  {historyQuery}
                </MenuItem>
              ))}
            </Menu>
          </Box>
        )}

        {/* Visualization type selector */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ flexShrink: 0 }}>
            Visualization
          </Typography>
          <ToggleButtonGroup
            value={viz}
            exclusive
            onChange={(_, v) => v && handleVizChange(v)}
            size="small"
            sx={{ flexWrap: "wrap" }}
          >
            {getAllVizEntries().map((entry) => (
              <ToggleButton key={entry.type} value={entry.type} title={entry.label}>
                {entry.icon}
                <Typography variant="caption" sx={{ ml: 0.5 }}>
                  {entry.label}
                </Typography>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        {!isMarkdown && error && <Alert severity="error">{error}</Alert>}

        {/* Markdown preview — always shown for markdown panels */}
        {isMarkdown && (
          <Paper variant="outlined" sx={{ minHeight: 120, p: 1, overflow: "auto" }}>
            <MarkdownPanel
              content={query}
              connection={connection}
              timeRange={timeRange}
              parameters={parameters}
            />
          </Paper>
        )}

        {/* Preview + options — only for query-based panels */}
        {!isMarkdown && preview && (
          <>
            <Paper variant="outlined" sx={{ minHeight: 220, p: 1, overflow: "hidden" }}>
              <Visualization type={viz} data={preview} options={options} />
            </Paper>

            {showOptions && (
              <>
                <Divider />
                <ChartOptionsEditor vizType={viz} options={options} onChange={setOptions} />
              </>
            )}
          </>
        )}

        {/* Show options even without a preview (e.g. when editing an existing panel) */}
        {!isMarkdown && !preview && showOptions && (
          <>
            <Divider />
            <ChartOptionsEditor vizType={viz} options={options} onChange={setOptions} />
          </>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button color="error" onClick={handleDelete}>
          Delete Panel
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={() => setEditingId(null)}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
