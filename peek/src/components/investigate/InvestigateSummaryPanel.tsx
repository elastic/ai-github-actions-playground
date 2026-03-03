import { useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import type { InvestigateTab, TimelineEvent } from "./investigateUtils";

interface InvestigateSummaryPanelProps {
  events: TimelineEvent[];
  activeTab: InvestigateTab;
  searchedEntity: string;
  summaryPrompt: string | null;
  onCopyPrompt: () => void;
}

export default function InvestigateSummaryPanel({
  events,
  activeTab,
  searchedEntity,
  summaryPrompt,
  onCopyPrompt,
}: InvestigateSummaryPanelProps) {
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

      {summaryPrompt && (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              LLM Summary
            </Typography>
            <Button size="small" variant="outlined" onClick={onCopyPrompt}>
              Copy prompt to clipboard
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Copy the prompt above and paste it into the AI Assistant chat to get an LLM-generated
            summary of this timeline.
          </Typography>
        </Paper>
      )}
    </>
  );
}
