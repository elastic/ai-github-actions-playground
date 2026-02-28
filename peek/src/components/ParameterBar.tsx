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
import { useConnectionStore } from "../store/useConnectionStore";
import type { DashboardParameter, ParameterSource } from "../types";
import {
  buildPersesEsqlRequest,
  createPersesEsqlDatasource,
} from "../services/perses/esqlDatasource";

const EMPTY_PARAM: DashboardParameter = {
  name: "",
  label: "",
  type: "keyword",
  source: { mode: "text" },
  value: "",
};
const EMPTY_PARAMETERS: DashboardParameter[] = [];
type ParameterValue = DashboardParameter["value"];

function parseParameterValue(
  type: DashboardParameter["type"],
  rawValue: string,
): { value?: ParameterValue; error?: string } {
  if (type === "keyword") {
    return { value: rawValue };
  }
  if (type === "number") {
    const parsed = Number(rawValue);
    if (rawValue.trim() === "" || Number.isNaN(parsed) || !Number.isFinite(parsed)) {
      return { error: "Enter a valid number." };
    }
    return { value: parsed };
  }
  if (type === "boolean") {
    if (rawValue === "true") return { value: true };
    if (rawValue === "false") return { value: false };
    return { error: "Choose true or false." };
  }
  const parsed = Date.parse(rawValue);
  if (rawValue.trim() === "" || Number.isNaN(parsed)) {
    return { error: "Enter a valid date/time." };
  }
  return { value: new Date(parsed).toISOString() };
}

function formatValueForInput(
  type: DashboardParameter["type"],
  value: ParameterValue | null | undefined,
): string {
  if (type === "boolean") {
    if (value === null || value === undefined) return "";
    return String(value);
  }
  return String(value ?? "");
}

export default function ParameterBar() {
  const { parameters, setParameterValue, addParameter, updateParameter, removeParameter } =
    useDashboardStore(
      useShallow((s) => ({
        parameters: s.dashboard.parameters ?? EMPTY_PARAMETERS,
        setParameterValue: s.setParameterValue,
        addParameter: s.addParameter,
        updateParameter: s.updateParameter,
        removeParameter: s.removeParameter,
      })),
    );
  const connection = useConnectionStore((s) => s.connection);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DashboardParameter | null>(null);
  const [draft, setDraft] = useState<DashboardParameter>(EMPTY_PARAM);
  const [draftValueInput, setDraftValueInput] = useState("");
  const [optionsInput, setOptionsInput] = useState("");
  const [esqlOptions, setEsqlOptions] = useState<string[]>([]);
  const [esqlLoading, setEsqlLoading] = useState(false);
  const [esqlError, setEsqlError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const openAdd = useCallback(() => {
    setEditing(null);
    setDraft(EMPTY_PARAM);
    setDraftValueInput("");
    setOptionsInput("");
    setEsqlOptions([]);
    setEsqlError(null);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((param: DashboardParameter) => {
    setEditing(param);
    setDraft({ ...param });
    setDraftValueInput(formatValueForInput(param.type, param.value));
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

  const handleTypeChange = useCallback((nextType: DashboardParameter["type"]) => {
    setDraft((prev) => ({ ...prev, type: nextType }));
    setDraftValueInput((prevInput) => {
      if (nextType === "boolean") {
        const parsed = parseParameterValue(nextType, prevInput);
        return parsed.error ? "false" : formatValueForInput(nextType, parsed.value);
      }
      const parsed = parseParameterValue(nextType, prevInput);
      return parsed.error ? "" : formatValueForInput(nextType, parsed.value ?? "");
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
      const datasource = createPersesEsqlDatasource(connection);
      const request = buildPersesEsqlRequest(draft.source.query, { parameters });
      const result = await datasource.execute(request, ctrl.signal);
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
  }, [draft.source, connection, parameters]);

  // Clean up abort controller on unmount
  useEffect(() => () => abortRef.current?.abort(), []);

  const handleSave = useCallback(() => {
    const parsedDefaultValue = parseParameterValue(draft.type, draftValueInput);
    if (parsedDefaultValue.error || parsedDefaultValue.value === undefined) return;
    const param: DashboardParameter = {
      ...draft,
      name: draft.name.trim(),
      value: parsedDefaultValue.value,
    };
    if (!param.name) return;

    if (param.source.mode === "options") {
      const typedOptions = optionsInput
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .map((v) => parseParameterValue(param.type, v));
      if (typedOptions.some((entry) => entry.error)) return;
      param.source = {
        mode: "options",
        values: typedOptions.map((entry) => String(entry.value)),
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
  }, [
    draft,
    draftValueInput,
    optionsInput,
    editing,
    addParameter,
    updateParameter,
    removeParameter,
  ]);

  const draftValueValidation = parseParameterValue(draft.type, draftValueInput);
  const optionsValidationError =
    draft.source.mode === "options"
      ? optionsInput
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
          .map((v) => parseParameterValue(draft.type, v))
          .find((entry) => entry.error)?.error
      : undefined;
  const canSave =
    Boolean(draft.name.trim()) &&
    !draftValueValidation.error &&
    draftValueValidation.value !== undefined &&
    !optionsValidationError;

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
          <IconButton size="small" onClick={openAdd} aria-label="Add variable">
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
            key={`${param.name}:${param.type}:${String(param.value)}`}
            param={param}
            connection={connection}
            parameters={parameters}
            onChange={(val) => setParameterValue(param.name, val)}
            onEdit={() => openEdit(param)}
            onDelete={() => removeParameter(param.name)}
          />
        ))}

        <Tooltip title="Add variable">
          <IconButton size="small" onClick={openAdd} aria-label="Add variable">
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
            select
            label="Type"
            size="small"
            fullWidth
            value={draft.type}
            onChange={(e) => handleTypeChange(e.target.value as DashboardParameter["type"])}
          >
            <MenuItem value="keyword">keyword</MenuItem>
            <MenuItem value="number">number</MenuItem>
            <MenuItem value="boolean">boolean</MenuItem>
            <MenuItem value="date">date</MenuItem>
          </TextField>
          {draft.type === "boolean" ? (
            <TextField
              select
              label="Default value"
              size="small"
              fullWidth
              value={draftValueInput}
              onChange={(e) => setDraftValueInput(e.target.value)}
            >
              <MenuItem value="true">true</MenuItem>
              <MenuItem value="false">false</MenuItem>
            </TextField>
          ) : (
            <TextField
              label="Default value"
              size="small"
              value={draftValueInput}
              onChange={(e) => setDraftValueInput(e.target.value)}
              helperText={
                draftValueValidation.error ??
                (draft.type === "date"
                  ? "Use an ISO-like date/time value (for example 2025-01-01T00:00:00Z)"
                  : undefined)
              }
              error={Boolean(draftValueValidation.error)}
              fullWidth
            />
          )}

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
              helperText={optionsValidationError ?? 'e.g. "web,api,worker"'}
              error={Boolean(optionsValidationError)}
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
                  {esqlOptions.slice(0, 20).map((opt, idx) => (
                    <Chip key={`${opt}-${idx}`} label={opt} size="small" variant="outlined" />
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
          <Button variant="contained" onClick={handleSave} disabled={!canSave}>
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
  connection: ReturnType<typeof useConnectionStore.getState>["connection"];
  parameters: DashboardParameter[];
  onChange: (value: DashboardParameter["value"]) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ParameterControl({
  param,
  connection,
  parameters,
  onChange,
  onEdit,
  onDelete,
}: ParameterControlProps) {
  const [esqlOptions, setEsqlOptions] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hasQueryableEsqlSource =
    param.source.mode === "esql" && Boolean(param.source.query.trim()) && Boolean(connection);

  // Fetch options from ES|QL when source mode is esql
  useEffect(() => {
    if (!hasQueryableEsqlSource || param.source.mode !== "esql" || !connection) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const datasource = createPersesEsqlDatasource(connection);
    const request = buildPersesEsqlRequest(param.source.query, { parameters });
    datasource
      .execute(request, ctrl.signal)
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
  }, [param.source, connection, hasQueryableEsqlSource, parameters]);

  const optionStrings =
    param.source.mode === "options"
      ? param.source.values
      : param.source.mode === "esql"
        ? hasQueryableEsqlSource
          ? esqlOptions
          : []
        : [];
  const options = optionStrings
    .map((opt) => ({ label: opt, parsed: parseParameterValue(param.type, opt) }))
    .filter((entry) => entry.parsed.value !== undefined)
    .map((entry) => ({ label: entry.label, value: entry.parsed.value as ParameterValue }));
  const currentValueInput = formatValueForInput(param.type, param.value);
  const [draftInput, setDraftInput] = useState(() => currentValueInput);

  const commitDraftValue = useCallback(() => {
    const parsed = parseParameterValue(param.type, draftInput);
    if (parsed.value === undefined) {
      setValidationError(parsed.error ?? "Invalid value");
      return;
    }
    setValidationError(null);
    onChange(parsed.value);
    setDraftInput(formatValueForInput(param.type, parsed.value));
  }, [param.type, draftInput, onChange]);

  return (
    <Box
      data-testid={`parameter-row-${param.name}`}
      sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
        {param.label || param.name}:
      </Typography>

      {options.length > 0 || param.type === "boolean" ? (
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <Select
            value={currentValueInput}
            onChange={(e) => {
              const parsed = parseParameterValue(param.type, e.target.value);
              if (parsed.value === undefined) {
                setValidationError(parsed.error ?? "Invalid value");
                return;
              }
              setValidationError(null);
              onChange(parsed.value);
            }}
            displayEmpty
            sx={{ fontSize: "0.75rem", height: 28 }}
          >
            {currentValueInput &&
              !options.some(
                (opt) => formatValueForInput(param.type, opt.value) === currentValueInput,
              ) && (
                <MenuItem key={`param-value-${param.name}`} value={currentValueInput}>
                  {currentValueInput}
                </MenuItem>
              )}
            {param.type === "boolean" && options.length === 0 && (
              <>
                <MenuItem value="true">true</MenuItem>
                <MenuItem value="false">false</MenuItem>
              </>
            )}
            {options.map((opt, idx) => (
              <MenuItem
                key={`option-${idx}-${opt.label}`}
                value={formatValueForInput(param.type, opt.value)}
              >
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ) : (
        <TextField
          size="small"
          value={draftInput}
          onChange={(e) => {
            const nextInput = e.target.value;
            setDraftInput(nextInput);
            const parsed = parseParameterValue(param.type, nextInput);
            setValidationError(
              parsed.value === undefined ? (parsed.error ?? "Invalid value") : null,
            );
          }}
          onBlur={commitDraftValue}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitDraftValue();
            }
          }}
          error={Boolean(validationError)}
          helperText={validationError}
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
