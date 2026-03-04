import { useCallback } from "react";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import type { OtelReceiverDefinition } from "../../../services/addData/otelReceiverCatalog";

export interface OtelReceiverConfigureProps {
  receiver: OtelReceiverDefinition;
  fieldValues: Record<string, string>;
  onFieldValuesChange: (values: Record<string, string>) => void;
  existingCollectorConfig: string;
  onExistingCollectorConfigChange: (config: string) => void;
  useExistingConfig: boolean;
  onUseExistingConfigChange: (use: boolean) => void;
}

export default function OtelReceiverConfigure({
  receiver,
  fieldValues,
  onFieldValuesChange,
  existingCollectorConfig,
  onExistingCollectorConfigChange,
  useExistingConfig,
  onUseExistingConfigChange,
}: OtelReceiverConfigureProps) {
  const handleFieldChange = useCallback(
    (key: string, value: string) => {
      onFieldValuesChange({ ...fieldValues, [key]: value });
    },
    [fieldValues, onFieldValuesChange],
  );

  return (
    <>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        Configure {receiver.label} receiver
      </Typography>
      <Stack spacing={1.5}>
        {receiver.fields.map((field) => (
          <TextField
            key={field.key}
            label={field.label}
            value={fieldValues[field.key] ?? ""}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder ?? (field.defaultValue || undefined)}
            helperText={field.helpText}
            size="small"
            fullWidth
          />
        ))}
        <FormControlLabel
          control={
            <Switch
              checked={useExistingConfig}
              onChange={(e) => onUseExistingConfigChange(e.target.checked)}
              size="small"
            />
          }
          label={<Typography variant="body2">Merge into an existing collector config</Typography>}
        />
        {useExistingConfig && (
          <TextField
            label="Existing collector config (YAML)"
            value={existingCollectorConfig}
            onChange={(e) => onExistingCollectorConfigChange(e.target.value)}
            placeholder={"Paste your existing otel-collector-config.yaml here"}
            helperText="The generated receiver, processor, exporter, and pipeline will be merged into this config."
            size="small"
            fullWidth
            multiline
            minRows={6}
            maxRows={16}
            slotProps={{
              input: {
                sx: { fontFamily: "monospace", fontSize: "0.8rem" },
              },
            }}
          />
        )}
      </Stack>
    </>
  );
}
