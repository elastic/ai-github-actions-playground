import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";

import { COMPONENT_HEIGHTS } from "../types/tokens";

/** Ensure toolbar toggle buttons match the standard input height (36 px). */
const toolbarButtonSx = { height: COMPONENT_HEIGHTS.input } as const;

interface IndexTemplatesToolbarProps {
  activeTab: "index" | "component";
  search: string;
  showSystem: boolean;
  priorityMin: string;
  priorityMax: string;
  dataStreamOnly: boolean;
  onSetTab: (value: "index" | "component") => void;
  onSetSearch: (value: string) => void;
  onToggleShowSystem: () => void;
  onSetPriorityMin: (value: string) => void;
  onSetPriorityMax: (value: string) => void;
  onToggleDataStreamOnly: () => void;
}

export default function IndexTemplatesToolbar({
  activeTab,
  search,
  showSystem,
  priorityMin,
  priorityMax,
  dataStreamOnly,
  onSetTab,
  onSetSearch,
  onToggleShowSystem,
  onSetPriorityMin,
  onSetPriorityMax,
  onToggleDataStreamOnly,
}: IndexTemplatesToolbarProps) {
  return (
    <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
      <Tabs
        value={activeTab}
        onChange={(_, value) => onSetTab(value as "index" | "component")}
        sx={{ minHeight: COMPONENT_HEIGHTS.tab }}
      >
        <Tab
          label="Index Templates"
          value="index"
          sx={{ minHeight: COMPONENT_HEIGHTS.tab, py: 0 }}
        />
        <Tab
          label="Component Templates"
          value="component"
          sx={{ minHeight: COMPONENT_HEIGHTS.tab, py: 0 }}
        />
      </Tabs>
      <TextField
        size="small"
        placeholder="Filter templates..."
        value={search}
        onChange={(event) => onSetSearch(event.target.value)}
        sx={{ minWidth: 260 }}
        slotProps={{ htmlInput: { "aria-label": "Filter templates" } }}
      />
      <Button
        size="small"
        variant={showSystem ? "contained" : "outlined"}
        onClick={onToggleShowSystem}
        aria-pressed={showSystem}
        sx={toolbarButtonSx}
      >
        Show system templates
      </Button>
      {activeTab === "index" && (
        <>
          <TextField
            size="small"
            value={priorityMin}
            onChange={(event) => onSetPriorityMin(event.target.value)}
            placeholder="Min priority"
            sx={{ width: 130 }}
            slotProps={{
              htmlInput: { inputMode: "numeric", "aria-label": "Minimum template priority" },
            }}
          />
          <TextField
            size="small"
            value={priorityMax}
            onChange={(event) => onSetPriorityMax(event.target.value)}
            placeholder="Max priority"
            sx={{ width: 130 }}
            slotProps={{
              htmlInput: { inputMode: "numeric", "aria-label": "Maximum template priority" },
            }}
          />
          <Button
            size="small"
            variant={dataStreamOnly ? "contained" : "outlined"}
            onClick={onToggleDataStreamOnly}
            aria-pressed={dataStreamOnly}
            sx={toolbarButtonSx}
          >
            Data-stream only
          </Button>
        </>
      )}
    </Box>
  );
}
