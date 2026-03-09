import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";

import { COMPONENT_HEIGHTS } from "../types/tokens";

type SnapshotTab = "snapshots" | "policies" | "repositories";

interface SnapshotsToolbarProps {
  activeTab: SnapshotTab;
  search: string;
  filterLabel: string;
  onTabChange: (tab: SnapshotTab) => void;
  onSearchChange: (value: string) => void;
}

export default function SnapshotsToolbar({
  activeTab,
  search,
  filterLabel,
  onTabChange,
  onSearchChange,
}: SnapshotsToolbarProps) {
  return (
    <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
      <Tabs
        value={activeTab}
        onChange={(_, v) => onTabChange(v as SnapshotTab)}
        sx={{ minHeight: COMPONENT_HEIGHTS.tab }}
      >
        <Tab label="Snapshots" value="snapshots" sx={{ minHeight: COMPONENT_HEIGHTS.tab, py: 0 }} />
        <Tab
          label="SLM Policies"
          value="policies"
          sx={{ minHeight: COMPONENT_HEIGHTS.tab, py: 0 }}
        />
        <Tab
          label="Repositories"
          value="repositories"
          sx={{ minHeight: COMPONENT_HEIGHTS.tab, py: 0 }}
        />
      </Tabs>
      <TextField
        size="small"
        placeholder="Filter..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        sx={{ minWidth: 260 }}
        aria-label={filterLabel}
      />
    </Box>
  );
}
