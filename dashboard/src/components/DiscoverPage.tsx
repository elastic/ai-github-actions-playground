import { useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { useDashboardStore } from "../store/useDashboardStore";
import { executeEsql, isEsqlError } from "../services/elasticsearch";
import type { EsqlColumn, EsqlResponse } from "../types";
import DataTable from "./visualizations/DataTable";

function getTypeColor(type: string): "default" | "primary" | "secondary" | "success" | "warning" {
  if (type === "date" || type === "date_nanos") return "warning";
  if (
    type === "long" ||
    type === "integer" ||
    type === "double" ||
    type === "float" ||
    type === "short" ||
    type === "byte"
  )
    return "primary";
  if (type === "boolean") return "secondary";
  if (type === "keyword" || type === "text" || type === "ip" || type === "version")
    return "success";
  return "default";
}

export default function DiscoverPage() {
  const connection = useDashboardStore((s) => s.connection);
  const themeMode = useDashboardStore((s) => s.themeMode);
  const addPanel = useDashboardStore((s) => s.addPanel);
  const setCurrentPage = useDashboardStore((s) => s.setCurrentPage);
  const setEditingPanelId = useDashboardStore((s) => s.setEditingPanelId);

  const [query, setQuery] = useState(
    "FROM logs-* | STATS count = COUNT(*) BY @timestamp | SORT @timestamp | LIMIT 50",
  );
  const [result, setResult] = useState<EsqlResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());

  const handleRunQuery = useCallback(async () => {
    if (!connection || !query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await executeEsql(connection, query.trim());
      setResult(data);
      // By default select all fields
      setSelectedFields(new Set(data.columns.map((c) => c.name)));
    } catch (err) {
      setError(isEsqlError(err) ? err.message : String(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [connection, query]);

  const toggleField = useCallback((name: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  const handleCreatePanel = useCallback(() => {
    const newPanel = {
      id: crypto.randomUUID(),
      title: "Discover Panel",
      query: query.trim(),
      visualization: "table" as const,
      layout: { x: 0, y: Infinity, w: 12, h: 5 },
    };
    addPanel(newPanel);
    setEditingPanelId(newPanel.id);
    setCurrentPage("dashboard");
  }, [query, addPanel, setEditingPanelId, setCurrentPage]);

  const filteredResult: EsqlResponse | null = result
    ? {
        columns: result.columns.filter((c) => selectedFields.has(c.name)),
        values: result.values.map((row) =>
          result.columns
            .map((col, idx) => ({ col, idx }))
            .filter(({ col }) => selectedFields.has(col.name))
            .map(({ idx }) => row[idx]),
        ),
      }
    : null;

  const columns: EsqlColumn[] = result?.columns ?? [];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", gap: 1 }}>
      {/* Query bar */}
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
          ES|QL Query
        </Typography>
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, overflow: "hidden", mb: 1 }}>
          <CodeMirror
            value={query}
            onChange={setQuery}
            extensions={[sql()]}
            theme={themeMode}
            height="100px"
            basicSetup={{ lineNumbers: true, foldGutter: false }}
          />
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Button
            variant="contained"
            size="small"
            startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />}
            onClick={handleRunQuery}
            disabled={loading || !query.trim()}
          >
            Run Query
          </Button>
          {result && (
            <Typography variant="caption" color="text.secondary">
              {result.values.length} rows × {result.columns.length} columns
            </Typography>
          )}
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Create a dashboard panel from this query">
            <span>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={handleCreatePanel}
                disabled={!query.trim()}
              >
                Create Panel
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      {/* Content area: field picker + table */}
      <Box sx={{ display: "flex", flex: 1, gap: 1, overflow: "hidden", minHeight: 0 }}>
        {/* Field picker sidebar */}
        <Paper
          variant="outlined"
          sx={{
            width: 220,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: "divider" }}>
            <Typography variant="subtitle2">Fields</Typography>
            {columns.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                {selectedFields.size} / {columns.length} selected
              </Typography>
            )}
          </Box>
          <Box sx={{ flex: 1, overflow: "auto" }}>
            {columns.length === 0 ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ p: 1.5, display: "block" }}
              >
                Run a query to see fields
              </Typography>
            ) : (
              columns.map((col) => (
                <Box key={col.name}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      px: 0.5,
                      py: 0.25,
                      cursor: "pointer",
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                    onClick={() => toggleField(col.name)}
                  >
                    <Checkbox
                      size="small"
                      checked={selectedFields.has(col.name)}
                      onChange={() => {}}
                      onClick={(e) => e.stopPropagation()}
                      sx={{ p: 0.5 }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="caption" noWrap display="block" title={col.name}>
                        {col.name}
                      </Typography>
                      <Chip
                        label={col.type}
                        size="small"
                        color={getTypeColor(col.type)}
                        sx={{ height: 14, fontSize: "0.6rem", "& .MuiChip-label": { px: 0.5 } }}
                      />
                    </Box>
                  </Box>
                  <Divider />
                </Box>
              ))
            )}
          </Box>
        </Paper>

        {/* Results table */}
        <Paper variant="outlined" sx={{ flex: 1, overflow: "auto" }}>
          {!result && !loading && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Run a query to see results
              </Typography>
            </Box>
          )}
          {loading && !result && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
            >
              <CircularProgress size={32} />
            </Box>
          )}
          {filteredResult && filteredResult.columns.length > 0 && (
            <DataTable data={filteredResult} />
          )}
          {filteredResult && filteredResult.columns.length === 0 && result && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
            >
              <Typography variant="body2" color="text.secondary">
                No fields selected — check the field picker to show columns
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
