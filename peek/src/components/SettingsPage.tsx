import { useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { useDashboardStore } from "../store/useDashboardStore";
import type { LlmProvider } from "../types";

const DEFAULT_MODELS: Record<LlmProvider, string> = {
  openai: "gpt-4.1-mini",
  anthropic: "claude-3-5-haiku-latest",
  google: "gemini-2.0-flash",
};

export default function SettingsPage() {
  const savedSettings = useDashboardStore((s) => s.llmSettings);
  const setLlmSettings = useDashboardStore((s) => s.setLlmSettings);
  const [provider, setProvider] = useState<LlmProvider>(savedSettings.provider);
  const [model, setModel] = useState(savedSettings.model);
  const [apiKey, setApiKey] = useState(savedSettings.apiKey);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const defaultModel = useMemo(() => DEFAULT_MODELS[provider], [provider]);

  return (
    <Paper variant="outlined" sx={{ p: 2, maxWidth: 760 }}>
      <Typography variant="h6" gutterBottom>
        LLM Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Configure your provider and API key for the Chat page. The API key is stored in
        sessionStorage and cleared when your browser tab session ends.
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <TextField
          select
          label="Provider"
          value={provider}
          onChange={(e) => {
            const nextProvider = e.target.value as LlmProvider;
            setProvider(nextProvider);
            if (!model.trim() || model === DEFAULT_MODELS[provider]) {
              setModel(DEFAULT_MODELS[nextProvider]);
            }
            setSaved(false);
          }}
        >
          <MenuItem value="openai">OpenAI</MenuItem>
          <MenuItem value="anthropic">Anthropic</MenuItem>
          <MenuItem value="google">Google</MenuItem>
        </TextField>
        <TextField
          label="Model"
          value={model}
          onChange={(e) => {
            setModel(e.target.value);
            setSaved(false);
          }}
          helperText={`Example for ${provider}: ${defaultModel}`}
        />
        <TextField
          label="API Key"
          type={showKey ? "text" : "password"}
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            setSaved(false);
          }}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowKey((prev) => !prev)}>
                    {showKey ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
        <Box>
          <Button
            variant="contained"
            onClick={() => {
              setLlmSettings({
                provider,
                model: model.trim() || defaultModel,
                apiKey: apiKey.trim(),
              });
              setSaved(true);
            }}
          >
            Save LLM Settings
          </Button>
        </Box>
        {saved && <Alert severity="success">Settings saved.</Alert>}
      </Box>
    </Paper>
  );
}
