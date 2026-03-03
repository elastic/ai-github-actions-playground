import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Fade from "@mui/material/Fade";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { useLLMStore } from "../store/useLLMStore";
import { usePageInsight } from "../hooks/usePageInsight";

interface PageInsightBannerProps {
  /** Serialized page context passed as the user message to the LLM */
  context: string;
  /** System prompt tailored to the page domain */
  systemPrompt: string;
  /** Stable cache key (e.g. "cluster-overview::<hash>") */
  cacheKey: string;
  /** Severity hint for Alert color */
  severity?: "info" | "warning" | "success" | "error";
}

export default function PageInsightBanner({
  context,
  systemPrompt,
  cacheKey,
  severity = "info",
}: PageInsightBannerProps) {
  const hasApiKey = useLLMStore((s) => Boolean(s.config.apiKey.trim()));
  const [dismissed, setDismissed] = useState(false);

  const { insight, loading, error, refresh } = usePageInsight({
    context,
    systemPrompt,
    cacheKey,
    enabled: !dismissed && hasApiKey,
  });

  if (!hasApiKey) return null;

  if (dismissed) {
    return (
      <Chip
        icon={<AutoAwesomeIcon fontSize="small" />}
        label="AI insight available"
        size="small"
        onClick={() => setDismissed(false)}
        sx={{ alignSelf: "flex-start" }}
      />
    );
  }

  if (loading) {
    return (
      <Alert severity={severity} icon={<CircularProgress size={16} />}>
        Generating insight…
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert
        severity="warning"
        action={
          <Tooltip title="Refresh insight">
            <IconButton size="small" aria-label="Refresh insight" onClick={refresh}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        }
      >
        Failed to generate insight. Try again.
      </Alert>
    );
  }

  if (!insight) return null;

  return (
    <Fade in timeout={400}>
      <Alert
        severity={severity}
        icon={<AutoAwesomeIcon fontSize="small" />}
        action={
          <>
            <Tooltip title="Refresh insight">
              <IconButton size="small" aria-label="Refresh insight" onClick={refresh}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <IconButton
              size="small"
              aria-label="Dismiss insight"
              onClick={() => setDismissed(true)}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </>
        }
        sx={{
          "& .MuiAlert-message": {
            fontStyle: "italic",
            "& code": {
              px: 0.5,
              borderRadius: 0.5,
              bgcolor: "action.selected",
              fontSize: "0.85em",
              fontFamily: "monospace",
            },
            "& h1,& h2,& h3,& h4,& h5,& h6": { mt: 1, mb: 0.5 },
            "& li": { mb: 0.5 },
            "& p": { mt: 0, mb: 1 },
            "& p:last-child": { mb: 0 },
            "& pre": {
              overflow: "auto",
              p: 1,
              borderRadius: 1,
              bgcolor: "action.selected",
              "& code": { p: 0, bgcolor: "transparent" },
            },
            "& ul,& ol": { mb: 1, pl: 2.5 },
          },
        }}
      >
        <Box component="span">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{insight}</ReactMarkdown>
        </Box>
      </Alert>
    </Fade>
  );
}
