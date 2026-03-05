import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { COMPACT_CHIP_SX } from "../types/tokens";

import EmptyState from "./EmptyState";
import InsightSlot from "./InsightSlot";
import { DATA_STREAMS_INSIGHT_SLOT_IDS } from "./dataStreamsInsightSlots";
import type { StreamSortField, StreamSortDirection } from "./dataStreamsUtils";
import { getStatusChipColor } from "./dataStreamsUtils";

interface DataStreamTableProps {
  search: string;
  setSearch: (value: string) => void;
  showSystemStreams: boolean;
  setShowSystemStreams: (value: boolean) => void;
  filteredStreams: { name: string; status: string; indices: unknown[] }[];
  loadingStreams: boolean;
  streamSortField: StreamSortField;
  streamSortDirection: StreamSortDirection;
  handleStreamSort: (field: StreamSortField) => void;
  selectedName: string | null;
  setSelectedName: (name: string) => void;
}

export default function DataStreamTable({
  search,
  setSearch,
  showSystemStreams,
  setShowSystemStreams,
  filteredStreams,
  loadingStreams,
  streamSortField,
  streamSortDirection,
  handleStreamSort,
  selectedName,
  setSelectedName,
}: DataStreamTableProps) {
  return (
    <InsightSlot slotId={DATA_STREAMS_INSIGHT_SLOT_IDS.streamList}>
      <Paper
        variant="outlined"
        sx={{
          display: "flex",
          flexShrink: 0,
          flexDirection: "column",
          width: 480,
          minHeight: 0,
        }}
      >
        <Box sx={{ p: 1 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Search streams"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            inputProps={{ "aria-label": "Search streams" }}
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showSystemStreams}
                onChange={(e) => setShowSystemStreams(e.target.checked)}
                inputProps={{ "aria-label": "Show system streams" }}
              />
            }
            label={
              <Typography variant="caption" color="text.secondary">
                Show system streams
              </Typography>
            }
            sx={{ mt: 0.5, ml: 0 }}
          />
        </Box>
        <Divider />
        <TableContainer sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          <Table size="small" stickyHeader aria-label="Data stream list">
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel
                    active={streamSortField === "name"}
                    direction={streamSortField === "name" ? streamSortDirection : "asc"}
                    onClick={() => handleStreamSort("name")}
                  >
                    Name
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={streamSortField === "status"}
                    direction={streamSortField === "status" ? streamSortDirection : "asc"}
                    onClick={() => handleStreamSort("status")}
                  >
                    Status
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={streamSortField === "indices"}
                    direction={streamSortField === "indices" ? streamSortDirection : "asc"}
                    onClick={() => handleStreamSort("indices")}
                  >
                    Indices
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredStreams.map((stream) => (
                <TableRow
                  key={stream.name}
                  hover
                  selected={stream.name === selectedName}
                  onClick={() => setSelectedName(stream.name)}
                  tabIndex={0}
                  aria-label={`Select data stream ${stream.name}`}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedName(stream.name);
                    }
                  }}
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell>
                    <Typography
                      variant="body2"
                      noWrap
                      title={stream.name}
                      sx={{ maxWidth: 240, fontSize: "0.85rem", fontFamily: "monospace" }}
                    >
                      {stream.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={stream.status.toUpperCase()}
                      color={getStatusChipColor(stream.status)}
                      size="small"
                      sx={COMPACT_CHIP_SX}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{stream.indices.length}</Typography>
                  </TableCell>
                </TableRow>
              ))}
              {!loadingStreams && filteredStreams.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} sx={{ border: 0 }}>
                    <EmptyState
                      size="small"
                      heading="No data streams found"
                      description="Try adjusting your search or check that data streams exist in the cluster"
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </InsightSlot>
  );
}
