import { useState, useEffect, useCallback, useRef } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import FormControl from "@mui/material/FormControl";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

import type { DashboardParameter } from "../../types";
import {
  buildPersesEsqlRequest,
  createPersesEsqlDatasource,
} from "../../services/perses/esqlDatasource";
import type { useConnectionStore } from "../../store/useConnectionStore";

import type { ParameterValue } from "./parameterUtils";
import { parseParameterValue, formatValueForInput } from "./parameterUtils";

interface ParameterControlProps {
  param: DashboardParameter;
  connection: ReturnType<typeof useConnectionStore.getState>["connection"];
  parameters: DashboardParameter[];
  onChange: (value: DashboardParameter["value"]) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function ParameterControl({
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
      sx={{ display: "flex", gap: 0.5, alignItems: "center" }}
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
            sx={{ height: 28, fontSize: "0.75rem" }}
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
            "& .MuiInputBase-input": { py: 0.5, px: 1, fontSize: "0.75rem" },
          }}
        />
      )}

      <Tooltip title="Edit variable">
        <IconButton size="small" onClick={onEdit} sx={{ p: 0.5 }} aria-label="Edit variable">
          <EditIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Remove variable">
        <IconButton size="small" onClick={onDelete} sx={{ p: 0.5 }} aria-label="Remove variable">
          <DeleteIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
