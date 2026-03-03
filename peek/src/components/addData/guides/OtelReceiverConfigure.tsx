import { useCallback } from "react";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import type { OtelReceiverDefinition } from "../../../services/addData/otelReceiverCatalog";

export interface OtelReceiverConfigureProps {
  receiver: OtelReceiverDefinition;
  fieldValues: Record<string, string>;
  onFieldValuesChange: (values: Record<string, string>) => void;
}

export default function OtelReceiverConfigure({
  receiver,
  fieldValues,
  onFieldValuesChange,
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
            value={fieldValues[field.key] ?? field.defaultValue}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            helperText={field.helpText}
            size="small"
            fullWidth
          />
        ))}
      </Stack>
    </>
  );
}
