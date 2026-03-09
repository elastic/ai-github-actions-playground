import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";

import { COMPONENT_HEIGHTS } from "../types/tokens";

interface IlmToolbarProps {
  activeTab: "indices" | "policies";
  search: string;
  phaseFilter: string;
  managedOnly: boolean;
  onlyErrors: boolean;
  onTabChange: (tab: "indices" | "policies") => void;
  onSearchChange: (value: string) => void;
  onPhaseFilterChange: (value: string) => void;
  onManagedOnlyChange: (value: boolean) => void;
  onOnlyErrorsChange: (value: boolean) => void;
}

export default function IlmToolbar({
  activeTab,
  search,
  phaseFilter,
  managedOnly,
  onlyErrors,
  onTabChange,
  onSearchChange,
  onPhaseFilterChange,
  onManagedOnlyChange,
  onOnlyErrorsChange,
}: IlmToolbarProps) {
  return (
    <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
      <Tabs
        value={activeTab}
        onChange={(_, v) => onTabChange(v as "indices" | "policies")}
        sx={{ minHeight: COMPONENT_HEIGHTS.tab }}
      >
        <Tab label="Indices" value="indices" sx={{ minHeight: COMPONENT_HEIGHTS.tab, py: 0 }} />
        <Tab label="Policies" value="policies" sx={{ minHeight: COMPONENT_HEIGHTS.tab, py: 0 }} />
      </Tabs>
      <TextField
        size="small"
        placeholder={
          activeTab === "indices" ? "Filter by index or policy..." : "Filter policies..."
        }
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        sx={{ minWidth: 260 }}
        aria-label="Filter ILM"
      />
      {activeTab === "indices" && (
        <>
          <TextField
            size="small"
            placeholder="Phase (hot/warm/...)"
            value={phaseFilter}
            onChange={(e) => onPhaseFilterChange(e.target.value)}
            sx={{ minWidth: 180 }}
            aria-label="Filter ILM phase"
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={managedOnly}
                onChange={(e) => onManagedOnlyChange(e.target.checked)}
              />
            }
            label="Managed only"
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={onlyErrors}
                onChange={(e) => onOnlyErrorsChange(e.target.checked)}
              />
            }
            label="Only errors"
          />
        </>
      )}
    </Box>
  );
}
