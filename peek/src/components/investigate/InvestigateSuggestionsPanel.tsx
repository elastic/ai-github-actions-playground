import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import type { InvestigateTab } from "./investigateUtils";
import { formatTimestamp } from "./investigateUtils";

export interface RecentEntity {
  name: string;
  eventCount: number;
  lastSeen: string;
}

interface InvestigateSuggestionsPanelProps {
  activeTab: InvestigateTab;
  entities: RecentEntity[];
  loading: boolean;
  onEntityClick: (name: string) => void;
}

export default function InvestigateSuggestionsPanel({
  activeTab,
  entities,
  loading,
  onEntityClick,
}: InvestigateSuggestionsPanelProps) {
  if (loading) {
    return (
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
          Loading recent {activeTab === "user" ? "users" : "hosts"}…
        </Typography>
        <LinearProgress />
      </Paper>
    );
  }

  if (entities.length === 0) return null;

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
        Recent {activeTab === "user" ? "users" : "hosts"}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {entities.map((entity) => (
          <Chip
            key={entity.name}
            label={`${entity.name} (${entity.eventCount})`}
            title={entity.lastSeen ? `Last seen: ${formatTimestamp(entity.lastSeen)}` : undefined}
            size="small"
            variant="outlined"
            onClick={() => onEntityClick(entity.name)}
            clickable
          />
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
        Click a {activeTab} to investigate their recent security events
      </Typography>
    </Paper>
  );
}
