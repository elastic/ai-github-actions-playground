import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { Controller, useForm, useWatch, type FieldError, type Resolver } from "react-hook-form";
import { z } from "zod";

import { PARAMETER_TYPES } from "../../contracts/dashboard/literals";
import { dashboardParameterSchema } from "../../schemas";
import type { ElasticsearchConnection } from "../../services/es";
import {
  buildPersesEsqlRequest,
  createPersesEsqlDatasource,
} from "../../services/perses/esqlDatasource";
import type { DashboardParameter, ParameterSource } from "../../types";

import { EMPTY_PARAM, formatValueForInput, parseParameterValue } from "./parameterUtils";

interface ParameterDialogProps {
  open: boolean;
  editing: DashboardParameter | null;
  connection: ElasticsearchConnection | null;
  parameters: DashboardParameter[];
  onClose: () => void;
  onSave: (param: DashboardParameter, previousName: string | null) => void;
}

interface ParameterDialogFormValues {
  name: string;
  label: string;
  type: DashboardParameter["type"];
  defaultValueInput: string;
  sourceMode: ParameterSource["mode"];
  optionsInput: string;
  sourceQuery: string;
}

function parseOptions(type: DashboardParameter["type"], optionsInput: string) {
  return optionsInput
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => parseParameterValue(type, v));
}

function buildSource(values: ParameterDialogFormValues): ParameterSource {
  if (values.sourceMode === "text") {
    return { mode: "text" };
  }
  if (values.sourceMode === "options") {
    const typedOptions = parseOptions(values.type, values.optionsInput);
    return {
      mode: "options",
      values: typedOptions.map((entry) => String(entry.value)),
    };
  }
  return {
    mode: "esql",
    query: values.sourceQuery.trim(),
  };
}

const parameterDialogFormSchema = z
  .object({
    name: z.string().min(1, "Name is required."),
    label: z.string().min(1, "Label is required."),
    type: z.enum(PARAMETER_TYPES),
    defaultValueInput: z.string(),
    sourceMode: z.enum(["text", "options", "esql"]),
    optionsInput: z.string(),
    sourceQuery: z.string(),
  })
  .superRefine((values, ctx) => {
    const parsedDefaultValue = parseParameterValue(values.type, values.defaultValueInput);
    if (parsedDefaultValue.error || parsedDefaultValue.value === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["defaultValueInput"],
        message: parsedDefaultValue.error ?? "Enter a valid value.",
      });
    }

    if (values.sourceMode === "options") {
      const typedOptions = parseOptions(values.type, values.optionsInput);
      if (typedOptions.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["optionsInput"],
          message: "Add at least one option.",
        });
      }
      const optionError = typedOptions.find((entry) => entry.error)?.error;
      if (optionError) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["optionsInput"],
          message: optionError,
        });
      }
    }

    if (values.sourceMode === "esql" && !values.sourceQuery.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceQuery"],
        message: "Enter an ES|QL query.",
      });
    }

    if (parsedDefaultValue.value === undefined) return;

    const schemaValidation = dashboardParameterSchema.safeParse({
      name: values.name.trim(),
      label: values.label.trim(),
      type: values.type,
      source: buildSource(values),
      value: parsedDefaultValue.value,
    });
    if (schemaValidation.success) return;

    for (const issue of schemaValidation.error.issues) {
      const [field, nested] = issue.path;
      if (field === "name") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["name"], message: issue.message });
        continue;
      }
      if (field === "label") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["label"], message: issue.message });
        continue;
      }
      if (field === "value") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["defaultValueInput"],
          message: issue.message,
        });
        continue;
      }
      if (field === "source" && nested === "query") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sourceQuery"],
          message: issue.message,
        });
        continue;
      }
      if (field === "source" && nested === "values") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["optionsInput"],
          message: issue.message,
        });
      }
    }
  });

const parameterDialogFormResolver: Resolver<ParameterDialogFormValues> = async (values) => {
  const result = parameterDialogFormSchema.safeParse(values);
  if (result.success) {
    return {
      values: result.data,
      errors: {},
    };
  }

  const errors = result.error.issues.reduce<
    Partial<Record<keyof ParameterDialogFormValues, FieldError>>
  >((acc, issue) => {
    const field = issue.path[0];
    if (typeof field !== "string") return acc;
    if (!(field in values)) return acc;
    const typedField = field as keyof ParameterDialogFormValues;
    if (acc[typedField]) return acc;
    acc[typedField] = {
      type: issue.code,
      message: issue.message,
    };
    return acc;
  }, {});

  return {
    values: {},
    errors,
  };
};

function toFormValues(param: DashboardParameter | null): ParameterDialogFormValues {
  if (!param) {
    return {
      name: EMPTY_PARAM.name,
      label: EMPTY_PARAM.label,
      type: EMPTY_PARAM.type,
      defaultValueInput: "",
      sourceMode: EMPTY_PARAM.source.mode,
      optionsInput: "",
      sourceQuery: "",
    };
  }

  return {
    name: param.name,
    label: param.label,
    type: param.type,
    defaultValueInput: formatValueForInput(param.type, param.value),
    sourceMode: param.source.mode,
    optionsInput: param.source.mode === "options" ? param.source.values.join(", ") : "",
    sourceQuery: param.source.mode === "esql" ? param.source.query : "",
  };
}

export default function ParameterDialog({
  open,
  editing,
  connection,
  parameters,
  onClose,
  onSave,
}: ParameterDialogProps) {
  const [esqlOptions, setEsqlOptions] = useState<string[]>([]);
  const [esqlLoading, setEsqlLoading] = useState(false);
  const [esqlError, setEsqlError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { control, handleSubmit, getValues, setValue, reset, formState } =
    useForm<ParameterDialogFormValues>({
      resolver: parameterDialogFormResolver,
      mode: "onChange",
      defaultValues: toFormValues(null),
    });

  const watchedType = useWatch({ control, name: "type" });
  const watchedSourceMode = useWatch({ control, name: "sourceMode" });

  useEffect(() => {
    if (!open) return;
    reset(toFormValues(editing));
    setEsqlOptions([]);
    setEsqlError(null);
  }, [open, editing, reset]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleTypeChange = useCallback(
    (nextType: DashboardParameter["type"]) => {
      const currentInput = getValues("defaultValueInput");
      setValue("type", nextType, { shouldValidate: true });
      if (nextType === "boolean") {
        const parsed = parseParameterValue(nextType, currentInput);
        setValue(
          "defaultValueInput",
          parsed.error ? "false" : formatValueForInput(nextType, parsed.value),
          {
            shouldValidate: true,
          },
        );
        return;
      }
      const parsed = parseParameterValue(nextType, currentInput);
      setValue(
        "defaultValueInput",
        parsed.error ? "" : formatValueForInput(nextType, parsed.value ?? ""),
        {
          shouldValidate: true,
        },
      );
    },
    [getValues, setValue],
  );

  const handleSourceModeChange = useCallback(
    (nextMode: ParameterSource["mode"]) => {
      setValue("sourceMode", nextMode, { shouldValidate: true });
      if (nextMode !== "options") {
        setValue("optionsInput", "", { shouldValidate: true });
      }
      if (nextMode !== "esql") {
        setValue("sourceQuery", "", { shouldValidate: true });
      }
    },
    [setValue],
  );

  const fetchEsqlOptions = useCallback(async () => {
    const sourceMode = getValues("sourceMode");
    const sourceQuery = getValues("sourceQuery");
    if (sourceMode !== "esql" || !sourceQuery.trim() || !connection) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setEsqlLoading(true);
    setEsqlError(null);

    try {
      const datasource = createPersesEsqlDatasource(connection);
      const request = buildPersesEsqlRequest(sourceQuery, { parameters });
      const result = await datasource.execute(request, ctrl.signal);
      if (!ctrl.signal.aborted) {
        setEsqlOptions(result.values?.map((row) => String(row[0] ?? "")).filter(Boolean) ?? []);
      }
    } catch (err) {
      if (!ctrl.signal.aborted) {
        setEsqlError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (!ctrl.signal.aborted) setEsqlLoading(false);
    }
  }, [connection, getValues, parameters]);

  const handleSave = useCallback(
    (values: ParameterDialogFormValues) => {
      const parsedDefaultValue = parseParameterValue(values.type, values.defaultValueInput);
      if (parsedDefaultValue.value === undefined) return;
      const param: DashboardParameter = {
        name: values.name.trim(),
        label: values.label.trim(),
        type: values.type,
        source: buildSource(values),
        value: parsedDefaultValue.value,
      };
      onSave(param, editing?.name ?? null);
      onClose();
    },
    [editing, onClose, onSave],
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editing ? "Edit Variable" : "Add Variable"}</DialogTitle>
      <DialogContent
        sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}
      >
        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <TextField
              label="Name"
              size="small"
              value={field.value}
              onChange={(event) => field.onChange(event.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
              helperText={
                fieldState.error?.message ??
                "Used in queries as ?name (letters, numbers, and underscores only)"
              }
              error={Boolean(fieldState.error)}
              fullWidth
            />
          )}
        />
        <Controller
          control={control}
          name="label"
          render={({ field, fieldState }) => (
            <TextField
              label="Label"
              size="small"
              value={field.value}
              onChange={field.onChange}
              helperText={fieldState.error?.message}
              error={Boolean(fieldState.error)}
              fullWidth
            />
          )}
        />
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <TextField
              select
              label="Type"
              size="small"
              fullWidth
              value={field.value}
              onChange={(event) =>
                handleTypeChange(event.target.value as DashboardParameter["type"])
              }
            >
              <MenuItem value="keyword">keyword</MenuItem>
              <MenuItem value="number">number</MenuItem>
              <MenuItem value="boolean">boolean</MenuItem>
              <MenuItem value="date">date</MenuItem>
            </TextField>
          )}
        />
        {watchedType === "boolean" ? (
          <Controller
            control={control}
            name="defaultValueInput"
            render={({ field, fieldState }) => (
              <TextField
                select
                label="Default value"
                size="small"
                fullWidth
                value={field.value}
                onChange={field.onChange}
                helperText={fieldState.error?.message}
                error={Boolean(fieldState.error)}
              >
                <MenuItem value="true">true</MenuItem>
                <MenuItem value="false">false</MenuItem>
              </TextField>
            )}
          />
        ) : (
          <Controller
            control={control}
            name="defaultValueInput"
            render={({ field, fieldState }) => (
              <TextField
                label="Default value"
                size="small"
                value={field.value}
                onChange={field.onChange}
                helperText={
                  fieldState.error?.message ??
                  (watchedType === "date"
                    ? "Use an ISO-like date/time value (for example 2025-01-01T00:00:00Z)"
                    : undefined)
                }
                error={Boolean(fieldState.error)}
                fullWidth
              />
            )}
          />
        )}

        <Typography variant="body2" sx={{ mt: 1 }}>
          Value source
        </Typography>
        <Controller
          control={control}
          name="sourceMode"
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onChange={(event) =>
                handleSourceModeChange(event.target.value as ParameterSource["mode"])
              }
            >
              <FormControlLabel value="text" control={<Radio size="small" />} label="Free text" />
              <FormControlLabel
                value="options"
                control={<Radio size="small" />}
                label="Predefined options"
              />
              <FormControlLabel value="esql" control={<Radio size="small" />} label="ES|QL query" />
            </RadioGroup>
          )}
        />

        {watchedSourceMode === "options" && (
          <Controller
            control={control}
            name="optionsInput"
            render={({ field, fieldState }) => (
              <TextField
                label="Options (comma-separated)"
                size="small"
                value={field.value}
                onChange={field.onChange}
                helperText={fieldState.error?.message ?? 'e.g. "web,api,worker"'}
                error={Boolean(fieldState.error)}
                fullWidth
              />
            )}
          />
        )}

        {watchedSourceMode === "esql" && (
          <>
            <Controller
              control={control}
              name="sourceQuery"
              render={({ field, fieldState }) => (
                <TextField
                  label="ES|QL query"
                  size="small"
                  value={field.value}
                  onChange={field.onChange}
                  helperText={
                    fieldState.error?.message ?? "First column of results will be used as options"
                  }
                  error={Boolean(fieldState.error)}
                  fullWidth
                  multiline
                  rows={2}
                />
              )}
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
        <Button
          variant="contained"
          onClick={handleSubmit(handleSave)}
          disabled={!formState.isValid}
        >
          {editing ? "Save" : "Add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
