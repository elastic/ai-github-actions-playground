import { useState, useEffect, useCallback } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
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
import type { VisualizationType, EsqlResponse } from "../types";
import Visualization from "./visualizations/Visualization";

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
  const [preview, setPreview] = useState<EsqlResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (panel) {
      setTitle(panel.title);
      setQuery(panel.query);
      setViz(panel.visualization);
      setPreview(null);
      setError(null);
    }
  }, [panel]);

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
    updatePanel(editingId, { title, query, visualization: viz });
    setEditingId(null);
  }, [editingId, title, query, viz, updatePanel, setEditingId]);

  const handleDelete = useCallback(() => {
    if (!editingId) return;
    removePanel(editingId);
    setEditingId(null);
  }, [editingId, removePanel, setEditingId]);

  return (
    <Dialog
      open={Boolean(editingId)}
      onClose={() => setEditingId(null)}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { height: "85vh" } }}
    >
      <DialogTitle>Edit Panel</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1, height: "100%" }}>
          <TextField
            label="Panel Title"
            fullWidth
            size="small"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <Typography variant="subtitle2" color="text.secondary">
            ES|QL Query
          </Typography>
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
              basicSetup={{
                lineNumbers: true,
                foldGutter: false,
              }}
            />
          </Box>

          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Button
              variant="contained"
              size="small"
              onClick={handleRunQuery}
              disabled={loading || !query.trim()}
            >
              {loading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
              Run Query
            </Button>
            {preview && (
              <Typography variant="caption" color="text.secondary">
                {preview.values.length} rows × {preview.columns.length} columns
              </Typography>
            )}
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          <Typography variant="subtitle2" color="text.secondary">
            Visualization Type
          </Typography>
          <ToggleButtonGroup value={viz} exclusive onChange={(_, v) => v && setViz(v)} size="small">
            {VIZ_OPTIONS.map((opt) => (
              <ToggleButton key={opt.value} value={opt.value}>
                {opt.icon}
                <Typography variant="caption" sx={{ ml: 0.5 }}>
                  {opt.label}
                </Typography>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {preview && (
            <Paper variant="outlined" sx={{ flex: 1, minHeight: 200, p: 1, overflow: "auto" }}>
              <Visualization type={viz} data={preview} />
            </Paper>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
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
