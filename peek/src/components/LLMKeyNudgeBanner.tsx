import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";

import { useLLMStore } from "../store/useLLMStore";

const SESSION_DISMISS_KEY = "elastic-peek:llm-key-nudge-dismissed";

interface LLMKeyNudgeBannerProps {
  onOpenSettings: () => void;
}

function initialDismissedState(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(SESSION_DISMISS_KEY) === "1";
}

export default function LLMKeyNudgeBanner({ onOpenSettings }: LLMKeyNudgeBannerProps) {
  const hasApiKey = useLLMStore((s) => s.config.apiKey.trim().length > 0);
  const [dismissed, setDismissed] = useState(initialDismissedState);

  if (hasApiKey || dismissed) {
    return null;
  }

  return (
    <Alert
      severity="info"
      sx={{
        position: "relative",
        mb: 1,
        overflow: "hidden",
        borderColor: "primary.main",
        "& .MuiAlert-message": { width: "100%" },
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          top: 8,
          left: -28,
          color: "primary.main",
          "@keyframes llmKeyNudgeRocket": {
            "0%": { transform: "translateX(0px) translateY(0px) rotate(-8deg)", opacity: 0.2 },
            "12%": { opacity: 0.9 },
            "50%": { transform: "translateX(55vw) translateY(-5px) rotate(2deg)", opacity: 0.9 },
            "100%": { transform: "translateX(110vw) translateY(0px) rotate(10deg)", opacity: 0.1 },
          },
          animation: "llmKeyNudgeRocket 7s linear infinite",
          pointerEvents: "none",
        }}
      >
        <RocketLaunchIcon fontSize="small" />
      </Box>
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
              sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
            }}
          >
            Maybe later
          </Button>
        </Stack>
      </Stack>
    </Alert>
  );
}
