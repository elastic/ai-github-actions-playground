import { useState } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

import { deriveDefaultOtlpEndpoint } from "../services/telemetry/browserTracing";

export interface OtlpConfigPanelProps {
  otlpEnabled: boolean;
  onOtlpEnabledChange: (enabled: boolean) => void;
  otlpEndpoint: string;
  onOtlpEndpointChange: (endpoint: string) => void;
  otlpUseElasticAuth: boolean;
  onOtlpUseElasticAuthChange: (useElasticAuth: boolean) => void;
  otlpApiKey: string;
  onOtlpApiKeyChange: (apiKey: string) => void;
  authType: "apiKey" | "userpass";
  url: string;
}

export default function OtlpConfigPanel({
  otlpEnabled,
  onOtlpEnabledChange,
  otlpEndpoint,
  onOtlpEndpointChange,
  otlpUseElasticAuth,
  onOtlpUseElasticAuthChange,
  otlpApiKey,
  onOtlpApiKeyChange,
  authType,
  url,
}: OtlpConfigPanelProps) {
  const [showOtlpSecret, setShowOtlpSecret] = useState(false);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <FormControlLabel
        control={
          <Switch checked={otlpEnabled} onChange={(e) => onOtlpEnabledChange(e.target.checked)} />
        }
        label="Enable browser tracing"
      />
      <TextField
        label="OTLP traces endpoint"
        placeholder={deriveDefaultOtlpEndpoint(url)}
        fullWidth
        value={otlpEndpoint}
        onChange={(e) => onOtlpEndpointChange(e.target.value)}
        helperText="Defaults to /v1/traces on the connected cluster host."
        disabled={!otlpEnabled}
      />
      <FormControlLabel
        control={
          <Switch
            checked={otlpUseElasticAuth}
            onChange={(e) => onOtlpUseElasticAuthChange(e.target.checked)}
          />
        }
        label="Use Elasticsearch API key for OTLP auth"
        disabled={!otlpEnabled || authType !== "apiKey"}
      />
      <TextField
        label="OTLP API key override (optional)"
        fullWidth
        type={showOtlpSecret ? "text" : "password"}
        value={otlpApiKey}
        onChange={(e) => onOtlpApiKeyChange(e.target.value)}
        helperText="If provided, this key is used instead of the Elasticsearch API key."
        disabled={!otlpEnabled}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  aria-label={showOtlpSecret ? "Hide credentials" : "Show credentials"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowOtlpSecret(!showOtlpSecret);
                  }}
                  disabled={!otlpEnabled}
                >
                  {showOtlpSecret ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
    </Box>
  );
}
