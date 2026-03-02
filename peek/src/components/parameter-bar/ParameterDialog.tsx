import { useState, useCallback, useRef, useEffect } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import CircularProgress from "@mui/material/CircularProgress";

import type { DashboardParameter, ParameterSource } from "../../types";
import type { ElasticsearchConnection } from "../../services/es";
import {
  buildPersesEsqlRequest,
  createPersesEsqlDatasource,
} from "../../services/perses/esqlDatasource";

import { EMPTY_PARAM, parseParameterValue, formatValueForInput } from "./parameterUtils";

interface ParameterDialogProps {
  open: boolean;
  editing: DashboardParameter | null;
  connection: ElasticsearchConnection | null;
  parameters: DashboardParameter[];
  onClose: () => void;
  onSave: (param: DashboardParameter, previousName: string | null) => void;
}

export default function ParameterDialog({
  open,
  editing,
  connection,
  parameters,
  onClose,
  onSave,
}: ParameterDialogProps) {
  const [draft, setDraft] = useState<DashboardParameter>(EMPTY_PARAM);
  const [draftValueInput, setDraftValueInput] = useState("");
  const [optionsInput, setOptionsInput] = useState("");
  const [esqlOptions, setEsqlOptions] = useState<string[]>([]);
  const [esqlLoading, setEsqlLoading] = useState(false);
  const [esqlError, setEsqlError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Reset form state when dialog opens
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setDraft({ ...editing });
      setDraftValueInput(formatValueForInput(editing.type, editing.value));
      setOptionsInput(editing.source.mode === "options" ? editing.source.values.join(", ") : "");
    } else {
      setDraft(EMPTY_PARAM);
      setDraftValueInput("");
      setOptionsInput("");
    }
    setEsqlOptions([]);
    setEsqlError(null);
  }, [open, editing]);

  // Clean up abort controller on unmount
  useEffect(() => () => abortRef.current?.abort(), []);

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

    onSave(param, editing?.name ?? null);
    onClose();
  }, [draft, draftValueInput, optionsInput, editing, onSave, onClose]);

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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
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

        <Typography variant="body2" sx={{ mt: 1 }}>
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
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
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
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={!canSave}>
          {editing ? "Save" : "Add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
