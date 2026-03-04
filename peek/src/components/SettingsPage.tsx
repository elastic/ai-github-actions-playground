import { useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { useShallow } from "zustand/react/shallow";

import { useLLMStore, type LLMProvider } from "../store/useLLMStore";
import { useConnectionStore } from "../store/useConnectionStore";
import { useUIStore } from "../store/useUIStore";
import { deriveOtlpEndpoint } from "../utils/addDataUtils";
import { deriveDefaultOtlpEndpoint } from "../services/telemetry/browserTracing";

const PROVIDERS: Array<{ value: LLMProvider; label: string }> = [
  { value: "openai", label: "OpenAI" },
  { value: "openrouter", label: "OpenRouter" },
];

const MODELS: Record<LLMProvider, Array<{ value: string; label: string }>> = {
  openai: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
    { value: "gpt-4.1", label: "GPT-4.1" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
    { value: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
    { value: "o3-mini", label: "o3-mini" },
  ],
  openrouter: [
    { value: "openai/gpt-4o-mini", label: "OpenAI GPT-4o Mini" },
    { value: "openai/gpt-4.1-mini", label: "OpenAI GPT-4.1 Mini" },
    { value: "anthropic/claude-3.5-sonnet", label: "Anthropic Claude 3.5 Sonnet" },
    { value: "google/gemini-2.0-flash-001", label: "Google Gemini 2.0 Flash" },
    { value: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B Instruct" },
  ],
};

export default function SettingsPage() {
  const {
    config,
    setProvider,
    setApiKey,
    setModel,
    setTabAutocompleteEnabled,
    setElasticDocsEnabled,
    isConfigured,
    resetLLMConfig,
  } = useLLMStore(
    useShallow((s) => ({
      config: s.config,
      setProvider: s.setProvider,
      setApiKey: s.setApiKey,
      setModel: s.setModel,
      setTabAutocompleteEnabled: s.setTabAutocompleteEnabled,
      setElasticDocsEnabled: s.setElasticDocsEnabled,
      isConfigured: s.isConfigured,
      resetLLMConfig: s.resetLLMConfig,
    })),
  );

  const [showApiKey, setShowApiKey] = useState(false);
  const [useCustomModel, setUseCustomModel] = useState(() => {
    const presets = MODELS[config.provider] ?? [];
    return !presets.some((model) => model.value === config.model);
  });

  const PROVIDER_HINT: Record<LLMProvider, string> = {
    openai: "e.g. gpt-4o, o3-mini",
    openrouter: "e.g. anthropic/claude-3.5-sonnet",
  };

  const configured = isConfigured();
  const isModelEmpty = config.model.trim() === "";
  const handleResetLLMSettings = () => {
    resetLLMConfig();
    setUseCustomModel(false);
  };

  const { connection, setConnection } = useConnectionStore(
    useShallow((s) => ({
      connection: s.connection,
      setConnection: s.setConnection,
    })),
  );
  const setConnectionDialogOpen = useUIStore((s) => s.setConnectionDialogOpen);

  type TracingMode = "off" | "connected" | "remote";
  const tracingMode: TracingMode = (() => {
    if (!connection || !connection.otlpEnabled) return "off";
    const endpoint = (connection.otlpEndpoint ?? "").trim();
    const inferredBase =
      connection.ingestUrl?.trim() || deriveOtlpEndpoint(connection.url) || connection.url;
    const inferredDefaultEndpoint = deriveDefaultOtlpEndpoint(inferredBase);
    if (!endpoint || endpoint === inferredDefaultEndpoint) return "connected";
    return "remote";
  })();
  const remoteTracingEndpoint = (connection?.otlpEndpoint ?? "").trim();
  const applyTracingMode = (mode: TracingMode) => {
    if (!connection) return;
    if (mode === "off") {
      setConnection({ ...connection, otlpEnabled: false });
      return;
    }
    if (mode === "connected") {
      setConnection({ ...connection, otlpEnabled: true, otlpEndpoint: "" });
      return;
    }
    setConnection({
      ...connection,
      otlpEnabled: true,
      otlpEndpoint: remoteTracingEndpoint || deriveDefaultOtlpEndpoint(connection.url),
    });
  };

  return (
    <Box sx={{ width: "100%", maxWidth: 640, mx: "auto", py: 2 }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
        Settings
      </Typography>

      <Paper variant="outlined" sx={{ mb: 3, p: 3 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          LLM Provider
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Configure an LLM provider to enable AI-powered features such as the chat assistant. Your
          API key is stored only in session storage and is cleared when the browser session ends.
        </Typography>

        {configured && (
          <Alert icon={<CheckCircleOutlineIcon />} severity="success" sx={{ mb: 2 }}>
            LLM provider is configured and ready to use.
          </Alert>
        )}

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            select
            label="Provider"
            value={config.provider}
            onChange={(e) => {
              const provider = e.target.value as LLMProvider;
              setProvider(provider);
              setModel(MODELS[provider]?.[0]?.value ?? "");
              setUseCustomModel(false);
            }}
            size="small"
            fullWidth
          >
            {PROVIDERS.map((p) => (
              <MenuItem key={p.value} value={p.value}>
                {p.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="API Key"
            value={config.apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            size="small"
            fullWidth
            type={showApiKey ? "text" : "password"}
            placeholder="sk-..."
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle API key visibility"
                      onClick={() => setShowApiKey(!showApiKey)}
                      edge="end"
                      size="small"
                    >
                      {showApiKey ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={useCustomModel}
                onChange={(_, checked) => {
                  setUseCustomModel(checked);
                  if (!checked) {
                    const presets = MODELS[config.provider] ?? [];
                    const inPresets = presets.some((m) => m.value === config.model);
                    if (!inPresets) {
                      setModel(presets[0]?.value ?? "");
                    }
                  }
                }}
              />
            }
            label="Use custom model ID"
          />

          {useCustomModel ? (
            <TextField
              label="Model ID"
              value={config.model}
              onChange={(e) => setModel(e.target.value)}
              size="small"
              fullWidth
              placeholder={PROVIDER_HINT[config.provider]}
              error={isModelEmpty}
              helperText={
                isModelEmpty
                  ? "Model ID is required"
                  : `Enter any model ID supported by ${PROVIDERS.find((p) => p.value === config.provider)?.label ?? config.provider}`
              }
            />
          ) : (
            <TextField
              select
              label="Model"
              value={config.model}
              onChange={(e) => setModel(e.target.value)}
              size="small"
              fullWidth
            >
              {(MODELS[config.provider] ?? []).map((m) => (
                <MenuItem key={m.value} value={m.value}>
                  {m.label}
                </MenuItem>
              ))}
            </TextField>
          )}

          <FormControlLabel
            control={
              <Switch
                checked={config.tabAutocompleteEnabled}
                onChange={(_, checked) => setTabAutocompleteEnabled(checked)}
              />
            }
            label="Enable AI inline completions for code editors"
          />

          <FormControlLabel
            control={
              <Switch
                checked={config.elasticDocsEnabled}
                onChange={(_, checked) => setElasticDocsEnabled(checked)}
              />
            }
            label="Enable Elastic Docs search in chat"
          />
        </Box>
      </Paper>

      <Button variant="text" color="error" onClick={handleResetLLMSettings}>
        Reset LLM Settings
      </Button>

      <Paper variant="outlined" sx={{ mt: 3, p: 3 }}>
        <Typography variant="h6" sx={{ mb: 1.5 }}>
          Browser Tracing (Experimental)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Configure where browser spans are exported.
        </Typography>
        {!connection ? (
          <Alert
            severity="info"
            action={
              <Button size="small" onClick={() => setConnectionDialogOpen(true)}>
                Open Connection
              </Button>
            }
          >
            Connect to Elasticsearch first to configure browser tracing.
          </Alert>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              select
              size="small"
              label="Tracing mode"
              value={tracingMode}
              onChange={(e) => applyTracingMode(e.target.value as TracingMode)}
              fullWidth
            >
              <MenuItem value="off">Off</MenuItem>
              <MenuItem value="connected">On - send to connected cluster</MenuItem>
              <MenuItem value="remote">On - send to remote destination</MenuItem>
            </TextField>
            {tracingMode === "remote" && (
              <TextField
                size="small"
                label="Remote OTLP endpoint"
                placeholder="https://collector.example.com/v1/traces"
                value={remoteTracingEndpoint}
                onChange={(e) =>
                  setConnection({
                    ...connection,
                    otlpEnabled: true,
                    otlpEndpoint: e.target.value,
                  })
                }
                fullWidth
              />
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
}
