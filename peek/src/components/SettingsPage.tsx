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
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { useShallow } from "zustand/react/shallow";
import { useLLMStore, type LLMProvider } from "../store/useLLMStore";

const PROVIDERS: Array<{ value: LLMProvider; label: string }> = [
  { value: "openai", label: "OpenAI" },
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
};

export default function SettingsPage() {
  const { config, setProvider, setApiKey, setModel, isConfigured, resetLLMState } = useLLMStore(
    useShallow((s) => ({
      config: s.config,
      setProvider: s.setProvider,
      setApiKey: s.setApiKey,
      setModel: s.setModel,
      isConfigured: s.isConfigured,
      resetLLMState: s.resetLLMState,
    })),
  );

  const [showApiKey, setShowApiKey] = useState(false);

  const configured = isConfigured();

  return (
    <Box sx={{ maxWidth: 640, mx: "auto", width: "100%", py: 2 }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
        Settings
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
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
            onChange={(e) => setProvider(e.target.value as LLMProvider)}
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
        </Box>
      </Paper>

      <Button variant="outlined" color="error" onClick={resetLLMState}>
        Reset LLM Settings
      </Button>
    </Box>
  );
}
