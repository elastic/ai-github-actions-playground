import { useState } from "react";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Fade from "@mui/material/Fade";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";

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
  severity?: "info" | "warning" | "success";
}

export default function PageInsightBanner({
  context,
  systemPrompt,
  cacheKey,
  severity = "info",
}: PageInsightBannerProps) {
  const isConfigured = useLLMStore((s) => s.isConfigured);
  const [dismissed, setDismissed] = useState(false);

  const { insight, loading, refresh } = usePageInsight({
    context,
    systemPrompt,
    cacheKey,
    enabled: !dismissed && isConfigured(),
  });

  if (!isConfigured()) return null;

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
        sx={{ "& .MuiAlert-message": { fontStyle: "italic" } }}
      >
        {insight}
      </Alert>
    </Fade>
  );
}
