import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { useLLMStore } from "../store/useLLMStore";

export const SESSION_DISMISS_KEY = "elastic-peek:llm-key-nudge-dismissed";

interface LLMKeyNudgeBannerProps {
  onOpenSettings: () => void;
}

function initialDismissedState(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SESSION_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export default function LLMKeyNudgeBanner({ onOpenSettings }: LLMKeyNudgeBannerProps) {
  const hasApiKey = useLLMStore((s) => s.isConfigured());
  const [dismissed, setDismissed] = useState(initialDismissedState);

  if (hasApiKey || dismissed) {
    return null;
  }

  return (
    <Alert
      severity="info"
      sx={{
        mb: 1,
        "& .MuiAlert-message": { width: "100%" },
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
      >
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Works best with an LLM key configured.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Add an OpenRouter or OpenAI key in Settings to unlock richer AI assistance.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="contained" onClick={onOpenSettings}>
            Configure key
          </Button>
          <Button
            size="small"
            color="inherit"
            onClick={() => {
              setDismissed(true);
              try {
                window.sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
              } catch {
                // Ignore storage failures in restricted environments.
              }
            }}
          >
            Maybe later
          </Button>
        </Stack>
      </Stack>
    </Alert>
  );
}
