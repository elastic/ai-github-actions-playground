import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import StorageIcon from "@mui/icons-material/Storage";

import type { DataStreamInfo } from "../services/es";

import ContentSkeleton from "./ContentSkeleton";
import EmptyState from "./EmptyState";
import InsightSlot from "./InsightSlot";
import { DATA_STREAMS_INSIGHT_SLOT_IDS } from "./dataStreamsInsightSlots";

interface DataStreamDetailPanelProps {
  displayedDataStream: DataStreamInfo | null;
  fieldSearch: string;
  setFieldSearch: (value: string) => void;
  fieldRows: { name: string; type: string }[];
  loadingFields: boolean;
  selectedField: { name: string; type: string } | null;
  setSelectedField: (field: { name: string; type: string } | null) => void;
}

export default function DataStreamDetailPanel({
  displayedDataStream,
  fieldSearch,
  setFieldSearch,
  fieldRows,
  loadingFields,
  selectedField,
  setSelectedField,
}: DataStreamDetailPanelProps) {
  return (
    <Box sx={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0 }}>
      <InsightSlot slotId={DATA_STREAMS_INSIGHT_SLOT_IDS.streamDetail}>
        <Paper
          variant="outlined"
          sx={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0 }}
        >
          <Box sx={{ p: 1.5 }}>
            {displayedDataStream ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Typography variant="subtitle1">{displayedDataStream.name}</Typography>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "minmax(120px, auto) 1fr",
                    rowGap: 0.5,
                    columnGap: 1.5,
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Status
                  </Typography>
                  <Typography variant="body2" data-testid="data-stream-meta-status">
                    {displayedDataStream.status}
                  </Typography>

                  <Typography variant="caption" color="text.secondary">
                    Generation
                  </Typography>
                  <Typography variant="body2" data-testid="data-stream-meta-generation">
                    {displayedDataStream.generation}
                  </Typography>

                  <Typography variant="caption" color="text.secondary">
                    Backing indices
                  </Typography>
                  <Typography variant="body2" data-testid="data-stream-meta-backing-indices">
                    {displayedDataStream.indices.length}
                  </Typography>

                  <Typography variant="caption" color="text.secondary">
                    Write index
                  </Typography>
                  <Typography variant="body2" data-testid="data-stream-meta-write-index">
                    {displayedDataStream.indices[displayedDataStream.indices.length - 1]
                      ?.index_name ?? "n/a"}
                  </Typography>

                  <Typography variant="caption" color="text.secondary">
                    Managed by
                  </Typography>
                  <Typography variant="body2" data-testid="data-stream-meta-managed-by">
                    {displayedDataStream.next_generation_managed_by}
                  </Typography>

                  {displayedDataStream.ilm_policy && (
                    <>
                      <Typography variant="caption" color="text.secondary">
                        ILM policy
                      </Typography>
                      <Typography variant="body2" data-testid="data-stream-meta-ilm-policy">
                        {displayedDataStream.ilm_policy}
                      </Typography>
                    </>
                  )}
                </Box>
              </Box>
            ) : (
              <EmptyState
                icon={<StorageIcon sx={{ fontSize: 32 }} />}
                heading="Select a data stream"
                description="Select a data stream from the left panel to view its fields and backing indices."
              />
            )}
          </Box>
          <Divider />
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minHeight: 0, p: 1.5 }}>
            {displayedDataStream && (
              <TextField
                size="small"
                placeholder="Search fields"
                value={fieldSearch}
                onChange={(e) => setFieldSearch(e.target.value)}
                inputProps={{ "aria-label": "Search fields" }}
              />
            )}
            {loadingFields ? (
              <ContentSkeleton variant="table" />
            ) : (
              <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                {displayedDataStream &&
                  fieldRows.map((field) => (
                    <Stack
                      key={`${field.name}:${field.type}`}
                      component="button"
                      type="button"
                      direction="row"
                      spacing={1}
                      onClick={() => setSelectedField({ name: field.name, type: field.type })}
                      aria-pressed={
                        selectedField?.name === field.name && selectedField?.type === field.type
                      }
                      sx={{
                        alignItems: "center",
                        width: "100%",
                        py: 0.5,
                        px: 0.5,
                        border: "none",
                        borderRadius: 1,
                        background: "none",
                        bgcolor:
                          selectedField?.name === field.name && selectedField?.type === field.type
                            ? "action.selected"
                            : "transparent",
                        cursor: "pointer",
                        textAlign: "left",
                        "&:hover": { bgcolor: "action.hover" },
                      }}
                    >
                      <Typography variant="body2" color="text.primary" sx={{ flex: 1 }}>
                        {field.name}
                      </Typography>
                      <Chip size="small" label={field.type} />
                    </Stack>
                  ))}
                {!loadingFields && fieldRows.length === 0 && displayedDataStream && (
                  <Typography variant="body2" color="text.secondary">
                    No fields found for this data stream.
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        </Paper>
      </InsightSlot>
    </Box>
  );
}
