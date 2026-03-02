import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";

import type { PipelineEntry } from "../../hooks/useIngestPipelines";
import EmptyState from "../EmptyState";

interface PipelineListPanelProps {
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  filteredPipelines: PipelineEntry[];
  selectedName: string | null;
  onSelect: (name: string) => void;
}

export default function PipelineListPanel({
  loading,
  search,
  onSearchChange,
  filteredPipelines,
  selectedName,
  onSelect,
}: PipelineListPanelProps) {
  return (
    <Paper
      variant="outlined"
      sx={{ display: "flex", flexShrink: 0, flexDirection: "column", width: 280, minHeight: 0 }}
    >
      <Box sx={{ p: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search pipelines"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          inputProps={{ "aria-label": "Search pipelines" }}
        />
      </Box>
      <Divider />
      <List dense sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {loading && filteredPipelines.length === 0 && (
          <ListItem>
            <ListItemText primary="Loading pipelines…" sx={{ opacity: 0.6 }} />
          </ListItem>
        )}
        {filteredPipelines.map((entry) => {
          const processorCount = entry.pipeline.processors?.length ?? 0;
          return (
            <ListItem key={entry.name} disablePadding>
              <ListItemButton
                selected={entry.name === selectedName}
                onClick={() => onSelect(entry.name)}
              >
                <ListItemText
                  primary={entry.name}
                  primaryTypographyProps={{
                    noWrap: true,
                    sx: { fontFamily: "monospace", fontSize: "0.85rem" },
                  }}
                  secondary={
                    <Chip
                      component="span"
                      label={`${processorCount} processor${processorCount === 1 ? "" : "s"}`}
                      size="small"
                      variant="outlined"
                      sx={{ height: 20, mt: 0.5, fontSize: "0.7rem" }}
                    />
                  }
                />
              </ListItemButton>
            </ListItem>
          );
        })}
        {!loading && filteredPipelines.length === 0 && (
          <ListItem>
            <EmptyState
              heading="No pipelines found"
              description="Try adjusting your search or check that ingest pipelines exist in the cluster"
            />
          </ListItem>
        )}
      </List>
    </Paper>
  );
}
