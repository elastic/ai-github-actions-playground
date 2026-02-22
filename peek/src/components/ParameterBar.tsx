import { useState, useEffect, useCallback, useRef } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import CircularProgress from "@mui/material/CircularProgress";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import TuneIcon from "@mui/icons-material/Tune";
import { useShallow } from "zustand/react/shallow";
import { useDashboardStore } from "../store/useDashboardStore";
import { ElasticsearchClient } from "../services/es";
import type { DashboardParameter, ParameterSource } from "../types";

const EMPTY_PARAM: DashboardParameter = {
  name: "",
  label: "",
  type: "keyword",
  source: { mode: "text" },
  value: "",
};

export default function ParameterBar() {
  const {
    parameters,
    connection,
    setParameterValue,
    addParameter,
    updateParameter,
    removeParameter,
  } = useDashboardStore(
    useShallow((s) => ({
      parameters: s.dashboard.parameters ?? [],
      connection: s.connection,
      setParameterValue: s.setParameterValue,
      addParameter: s.addParameter,
      updateParameter: s.updateParameter,
      removeParameter: s.removeParameter,
    })),
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DashboardParameter | null>(null);
  const [draft, setDraft] = useState<DashboardParameter>(EMPTY_PARAM);
  const [optionsInput, setOptionsInput] = useState("");
  const [esqlOptions, setEsqlOptions] = useState<string[]>([]);
  const [esqlLoading, setEsqlLoading] = useState(false);
  const [esqlError, setEsqlError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const openAdd = useCallback(() => {
    setEditing(null);
    setDraft(EMPTY_PARAM);
    setOptionsInput("");
    setEsqlOptions([]);
    setEsqlError(null);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((param: DashboardParameter) => {
    setEditing(param);
    setDraft({ ...param });
    setOptionsInput(param.source.mode === "options" ? param.source.values.join(", ") : "");
    setEsqlOptions([]);
    setEsqlError(null);
    setDialogOpen(true);
  }, []);

  const handleSourceModeChange = useCallback((mode: ParameterSource["mode"]) => {
    setDraft((prev) => {
      if (mode === "text") return { ...prev, source: { mode: "text" } };
      if (mode === "options") return { ...prev, source: { mode: "options", values: [] } };
      return { ...prev, source: { mode: "esql", query: "" } };
    });
  }, []);

  const fetchEsqlOptions = useCallback(async () => {
    if (draft.source.mode !== "esql" || !draft.source.query.trim() || !connection) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setEsqlLoading(true);
    setEsqlError(null);

    try {
      const client = new ElasticsearchClient(connection);
      const result = await client.query({ query: draft.source.query.trim() }, ctrl.signal);
      if (!ctrl.signal.aborted && result.values) {
        const opts = result.values.map((row) => String(row[0] ?? "")).filter(Boolean);
        setEsqlOptions(opts);
      }
    } catch (err) {
      if (!ctrl.signal.aborted) {
        setEsqlError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (!ctrl.signal.aborted) setEsqlLoading(false);
    }
  }, [draft.source, connection]);

  // Clean up abort controller on unmount
  useEffect(() => () => abortRef.current?.abort(), []);

  const handleSave = useCallback(() => {
    const param: DashboardParameter = { ...draft, name: draft.name.trim() };
    if (!param.name) return;

    if (param.source.mode === "options") {
      param.source = {
        mode: "options",
        values: optionsInput
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      };
    }

    if (editing) {
      if (editing.name !== param.name) {
        removeParameter(editing.name);
        addParameter(param);
      } else {
        updateParameter(param.name, param);
      }
    } else {
      addParameter(param);
    }

    setDialogOpen(false);
  }, [draft, optionsInput, editing, addParameter, updateParameter, removeParameter]);

  if (parameters.length === 0 && !dialogOpen) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          px: 2,
          py: 0.5,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          gap: 1,
        }}
      >
        <TuneIcon sx={{ fontSize: 16, color: "text.secondary" }} />
        <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
          Variables
        </Typography>
        <Tooltip title="Add variable">
          <IconButton size="small" onClick={openAdd}>
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          px: 2,
          py: 0.5,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <TuneIcon sx={{ fontSize: 16, color: "text.secondary" }} />
        <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
          Variables
        </Typography>

        {parameters.map((param) => (
          <ParameterControl
            key={param.name}
            param={param}
            connection={connection}
            onChange={(val) => setParameterValue(param.name, val)}
            onEdit={() => openEdit(param)}
            onDelete={() => removeParameter(param.name)}
          />
        ))}

        <Tooltip title="Add variable">
          <IconButton size="small" onClick={openAdd}>
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? "Edit Variable" : "Add Variable"}</DialogTitle>
        <DialogContent
          sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}
        >
          <TextField
            label="Name"
            size="small"
            value={draft.name}
            onChange={(e) =>
              setDraft((d) => ({ ...d, name: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") }))
            }
            helperText="Used in queries as ?name (letters, numbers, underscore only)"
            fullWidth
          />
          <TextField
            label="Label"
            size="small"
            value={draft.label}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            fullWidth
          />
          <TextField
            label="Default value"
            size="small"
            value={draft.value}
            onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
            fullWidth
          />

          <Typography variant="subtitle2" sx={{ mt: 1 }}>
            Value source
          </Typography>
          <RadioGroup
            value={draft.source.mode}
            onChange={(e) => handleSourceModeChange(e.target.value as ParameterSource["mode"])}
          >
            <FormControlLabel value="text" control={<Radio size="small" />} label="Free text" />
            <FormControlLabel
              value="options"
              control={<Radio size="small" />}
              label="Predefined options"
            />
            <FormControlLabel value="esql" control={<Radio size="small" />} label="ES|QL query" />
          </RadioGroup>

          {draft.source.mode === "options" && (
            <TextField
              label="Options (comma-separated)"
              size="small"
              value={optionsInput}
              onChange={(e) => setOptionsInput(e.target.value)}
              helperText='e.g. "web,api,worker"'
              fullWidth
            />
          )}

          {draft.source.mode === "esql" && (
            <>
              <TextField
                label="ES|QL query"
                size="small"
                value={draft.source.mode === "esql" ? draft.source.query : ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, source: { mode: "esql", query: e.target.value } }))
                }
                helperText="First column of results will be used as options"
                fullWidth
                multiline
                rows={2}
              />
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={fetchEsqlOptions}
                  disabled={esqlLoading || !connection}
                >
                  {esqlLoading ? <CircularProgress size={16} /> : "Preview options"}
                </Button>
                {esqlError && (
                  <Typography variant="caption" color="error">
                    {esqlError}
                  </Typography>
                )}
              </Box>
              {esqlOptions.length > 0 && (
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                  {esqlOptions.slice(0, 20).map((opt) => (
                    <Chip key={opt} label={opt} size="small" variant="outlined" />
                  ))}
                  {esqlOptions.length > 20 && (
                    <Typography variant="caption" color="text.secondary">
                      +{esqlOptions.length - 20} more
                    </Typography>
                  )}
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!draft.name.trim()}>
            {editing ? "Save" : "Add"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Individual parameter control
// ---------------------------------------------------------------------------

interface ParameterControlProps {
  param: DashboardParameter;
  connection: ReturnType<typeof useDashboardStore.getState>["connection"];
  onChange: (value: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ParameterControl({
  param,
  connection,
  onChange,
  onEdit,
  onDelete,
}: ParameterControlProps) {
  const [esqlOptions, setEsqlOptions] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch options from ES|QL when source mode is esql
  useEffect(() => {
    if (param.source.mode !== "esql" || !param.source.query.trim() || !connection) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const client = new ElasticsearchClient(connection);
    client
      .query({ query: param.source.query.trim() }, ctrl.signal)
      .then((result) => {
        if (!ctrl.signal.aborted && result.values) {
          setEsqlOptions(result.values.map((row) => String(row[0] ?? "")).filter(Boolean));
        }
      })
      .catch(() => {
        if (!ctrl.signal.aborted) {
          setEsqlOptions([]);
        }
      });

    return () => ctrl.abort();
  }, [param.source, connection]);

  const options =
    param.source.mode === "options"
      ? param.source.values
      : param.source.mode === "esql"
        ? esqlOptions
        : [];

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
        {param.label || param.name}:
      </Typography>

      {options.length > 0 ? (
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <Select
            value={param.value}
            onChange={(e) => onChange(e.target.value)}
            displayEmpty
            sx={{ fontSize: "0.75rem", height: 28 }}
          >
            {param.value && !options.includes(param.value) && (
              <MenuItem value={param.value}>{param.value}</MenuItem>
            )}
            {options.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ) : (
        <TextField
          size="small"
          value={param.value}
          onChange={(e) => onChange(e.target.value)}
          sx={{
            width: 120,
            "& .MuiInputBase-input": { fontSize: "0.75rem", py: 0.5, px: 1 },
          }}
        />
      )}

      <Tooltip title="Edit variable">
        <IconButton size="small" onClick={onEdit} sx={{ p: 0.25 }}>
          <EditIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Remove variable">
        <IconButton size="small" onClick={onDelete} sx={{ p: 0.25 }}>
          <DeleteIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
