import { useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Fade from "@mui/material/Fade";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { useLLMStore } from "../../store/useLLMStore";
import { usePageInsight } from "../../hooks/usePageInsight";

import {
  type InvestigateTab,
  type TimelineEvent,
  buildTimelineContext,
  TIMELINE_SYSTEM_PROMPT,
} from "./investigateUtils";

interface InvestigateSummaryPanelProps {
  events: TimelineEvent[];
  activeTab: InvestigateTab;
  searchedEntity: string;
}

export default function InvestigateSummaryPanel({
  events,
  activeTab,
  searchedEntity,
}: InvestigateSummaryPanelProps) {
  const hasApiKey = useLLMStore((s) => Boolean(s.config.apiKey.trim()));
  const [dismissed, setDismissed] = useState(false);

  const context = useMemo(
    () => buildTimelineContext(events, activeTab, searchedEntity),
    [events, activeTab, searchedEntity],
  );

  const cacheKey = useMemo(
    () =>
      `investigate::${activeTab}::${searchedEntity}::${events.length}::${events[0]?.timestamp ?? ""}`,
    [activeTab, searchedEntity, events],
  );

  const { insight, loading, error, refresh } = usePageInsight({
    context,
    systemPrompt: TIMELINE_SYSTEM_PROMPT,
    cacheKey,
    enabled: !dismissed && hasApiKey,
  });
  const eventCategoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of events) {
      const cat = event.category || "unknown";
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [events]);

  const dataSourceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of events) {
      const src = event.dataSource || "unknown";
      counts.set(src, (counts.get(src) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [events]);

  return (
    <>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }} gutterBottom>
          {events.length} event{events.length !== 1 ? "s" : ""} found for {activeTab} &ldquo;
          {searchedEntity}&rdquo;
        </Typography>
        {eventCategoryCounts.length > 0 && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
              Categories:
            </Typography>
            {eventCategoryCounts.map(([cat, count]) => (
              <Chip key={cat} size="small" label={`${cat} (${count})`} variant="outlined" />
            ))}
          </Box>
        )}
        {dataSourceCounts.length > 0 && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
              Data sources:
            </Typography>
            {dataSourceCounts.map(([src, count]) => (
              <Chip key={src} size="small" label={`${src} (${count})`} variant="outlined" />
            ))}
          </Box>
        )}
      </Paper>

      {hasApiKey && dismissed && (
        <Chip
          icon={<AutoAwesomeIcon fontSize="small" />}
          label="AI insight available"
          size="small"
          onClick={() => setDismissed(false)}
          sx={{ alignSelf: "flex-start" }}
        />
      )}

      {hasApiKey && !dismissed && loading && (
        <Alert severity="info" icon={<CircularProgress size={16} />}>
          Generating insight…
        </Alert>
      )}

      {hasApiKey && !dismissed && error && (
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
      )}

      {hasApiKey && !dismissed && insight && (
        <Fade in timeout={400}>
          <Alert
            severity="info"
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
      )}
    </>
  );
}
