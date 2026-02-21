import { useState, useEffect, useCallback } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import InputBase from "@mui/material/InputBase";
import Box from "@mui/material/Box";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import BarChartIcon from "@mui/icons-material/BarChart";
import TableChartIcon from "@mui/icons-material/TableChart";
import NumbersIcon from "@mui/icons-material/Numbers";
import PieChartIcon from "@mui/icons-material/PieChart";
import SpeedIcon from "@mui/icons-material/Speed";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { useDashboardStore } from "../store/useDashboardStore";
import { executeEsql, isEsqlError } from "../services/elasticsearch";
import type { VisualizationType, EsqlResponse, VisualizationOptions } from "../types";
import Visualization from "./visualizations/Visualization";
import ChartOptionsEditor, { defaultOptions } from "./ChartOptionsEditor";

const VIZ_OPTIONS: Array<{ value: VisualizationType; icon: React.ReactNode; label: string }> = [
  { value: "timeseries", icon: <ShowChartIcon />, label: "Time Series" },
  { value: "bar", icon: <BarChartIcon />, label: "Bar" },
  { value: "table", icon: <TableChartIcon />, label: "Table" },
  { value: "stat", icon: <NumbersIcon />, label: "Stat" },
  { value: "gauge", icon: <SpeedIcon />, label: "Gauge" },
  { value: "pie", icon: <PieChartIcon />, label: "Pie" },
];

export default function PanelEditor() {
  const editingId = useDashboardStore((s) => s.editingPanelId);
  const setEditingId = useDashboardStore((s) => s.setEditingPanelId);
  const panels = useDashboardStore((s) => s.dashboard.panels);
  const updatePanel = useDashboardStore((s) => s.updatePanel);
  const removePanel = useDashboardStore((s) => s.removePanel);
  const connection = useDashboardStore((s) => s.connection);
  const themeMode = useDashboardStore((s) => s.themeMode);

  const panel = panels.find((p) => p.id === editingId);

  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [viz, setViz] = useState<VisualizationType>("timeseries");
  const [options, setOptions] = useState<VisualizationOptions>(() => defaultOptions("timeseries"));
  const [preview, setPreview] = useState<EsqlResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (panel) {
      setTitle(panel.title);
      setQuery(panel.query);
      setViz(panel.visualization);
      setOptions(panel.options ?? defaultOptions(panel.visualization));
      setPreview(null);
      setError(null);
    }
  }, [panel]);

  const handleVizChange = useCallback(
    (newViz: VisualizationType) => {
      setViz(newViz);
      // Reset options to defaults for the new viz type, preserving format if set
      const currentFormat = (options as { format?: unknown }).format;
      const next = defaultOptions(newViz);
      setOptions(currentFormat ? { ...next, format: currentFormat } : next);
    },
    [options],
  );

  const handleRunQuery = useCallback(async () => {
    if (!connection || !query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await executeEsql(connection, query.trim());
      setPreview(data);
    } catch (err) {
      setError(isEsqlError(err) ? err.message : String(err));
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [connection, query]);

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

  const showOptions = viz !== "table" && viz !== "pie";

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
        {/* Query editor */}
        <Box>
          <Box
            sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}
          >
            <Typography variant="subtitle2" color="text.secondary">
              ES|QL Query
            </Typography>
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
          </Box>
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
              extensions={[sql()]}
              theme={themeMode}
              height="120px"
              basicSetup={{ lineNumbers: true, foldGutter: false }}
            />
          </Box>
        </Box>

        {/* Query controls row */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Button
            variant="contained"
            size="small"
            onClick={handleRunQuery}
            disabled={loading || !query.trim()}
          >
            {loading && <CircularProgress size={14} sx={{ mr: 1 }} />}
            Run Query
          </Button>
          {preview && (
            <Typography variant="caption" color="text.secondary">
              {preview.values.length} rows × {preview.columns.length} columns
            </Typography>
          )}
          <Box sx={{ flex: 1 }} />
          {/* Visualization type */}
          <ToggleButtonGroup
            value={viz}
            exclusive
            onChange={(_, v) => v && handleVizChange(v)}
            size="small"
          >
            {VIZ_OPTIONS.map((opt) => (
              <ToggleButton key={opt.value} value={opt.value} title={opt.label}>
                {opt.icon}
                <Typography variant="caption" sx={{ ml: 0.5 }}>
                  {opt.label}
                </Typography>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        {/* Preview + options */}
        {preview && (
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
        {!preview && showOptions && (
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
