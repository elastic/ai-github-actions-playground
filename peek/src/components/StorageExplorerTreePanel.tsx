import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import StorageIcon from "@mui/icons-material/Storage";

import { formatBytes } from "../utils/formatBytes";

import EmptyState from "./EmptyState";
import {
  formatPercent,
  formatShardSplit,
  type FlatTreeRow,
  type TreeNode,
} from "./storageExplorerTreeUtils";

interface StorageExplorerTreePanelProps {
  loading: boolean;
  search: string;
  rows: FlatTreeRow[];
  selectedNode: TreeNode | null;
  expanded: Record<string, boolean>;
  showReplicas: boolean;
  showSystemIndices: boolean;
  clusterTotalStorageBytes: number;
  onSearchChange: (value: string) => void;
  onShowReplicasChange: (checked: boolean) => void;
  onShowSystemIndicesChange: (checked: boolean) => void;
  onSelectNode: (id: string) => void;
  onToggleExpanded: (id: string, currentlyExpanded: boolean) => void;
}

export default function StorageExplorerTreePanel({
  loading,
  search,
  rows,
  selectedNode,
  expanded,
  showReplicas,
  showSystemIndices,
  clusterTotalStorageBytes,
  onSearchChange,
  onShowReplicasChange,
  onShowSystemIndicesChange,
  onSelectNode,
  onToggleExpanded,
}: StorageExplorerTreePanelProps) {
  return (
    <Paper
      variant="outlined"
      sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
    >
      <Box sx={{ p: 1, borderBottom: 1, borderColor: "border.subtle" }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search node, signal, dataset, namespace, index, or shard"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          inputProps={{ "aria-label": "Search storage explorer tree" }}
        />
        <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showReplicas}
                onChange={(event) => onShowReplicasChange(event.target.checked)}
                inputProps={{ "aria-label": "Show replica shard copies" }}
              />
            }
            label={
              <Typography variant="caption" color="text.secondary">
                Show replicas
              </Typography>
            }
            sx={{ ml: 0 }}
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showSystemIndices}
                onChange={(event) => onShowSystemIndicesChange(event.target.checked)}
                inputProps={{ "aria-label": "Show system indices" }}
              />
            }
            label={
              <Typography variant="caption" color="text.secondary">
                Show system indices
              </Typography>
            }
            sx={{ ml: 0 }}
          />
        </Stack>
      </Box>

      <TableContainer sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <Table size="small" stickyHeader aria-label="Storage explorer tree">
          <TableHead>
            <TableRow>
              <TableCell>Item</TableCell>
              <TableCell align="right">Shards (P/R)</TableCell>
              <TableCell align="right">Store</TableCell>
              <TableCell align="right">Store (%)</TableCell>
              <TableCell>State</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(({ node }) => {
              const hasChildren = node.children.length > 0;
              const isExpanded = expanded[node.id] ?? node.depth < 2;
              const percentOfClusterStorage =
                clusterTotalStorageBytes > 0
                  ? (node.storeBytes / clusterTotalStorageBytes) * 100
                  : null;

              return (
                <TableRow
                  key={node.id}
                  hover
                  selected={selectedNode?.id === node.id}
                  aria-selected={selectedNode?.id === node.id}
                  onClick={() => onSelectNode(node.id)}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " " || event.code === "Space") {
                      event.preventDefault();
                      onSelectNode(node.id);
                    }
                  }}
                  sx={{
                    cursor: "pointer",
                    "&:focus-visible": {
                      outline: "2px solid",
                      outlineColor: "primary.main",
                      outlineOffset: -2,
                    },
                  }}
                >
                  <TableCell>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        pl: node.depth * 2,
                        gap: 0.5,
                        minWidth: 0,
                      }}
                    >
                      {hasChildren ? (
                        <IconButton
                          size="small"
                          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.label}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleExpanded(node.id, isExpanded);
                          }}
                        >
                          {isExpanded ? (
                            <KeyboardArrowDownIcon fontSize="small" />
                          ) : (
                            <KeyboardArrowRightIcon fontSize="small" />
                          )}
                        </IconButton>
                      ) : (
                        <Box sx={{ width: 30 }} />
                      )}
                      <Typography variant="body2" noWrap title={node.label} sx={{ minWidth: 0 }}>
                        {node.label}
                      </Typography>
                      {node.level === "shard" && (
                        <Chip
                          size="small"
                          label={node.prirep === "p" ? "P" : "R"}
                          color={node.prirep === "p" ? "primary" : "default"}
                          sx={{ height: 18 }}
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {formatShardSplit(node.primaries, node.replicas)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{formatBytes(node.storeBytes)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {formatPercent(percentOfClusterStorage)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{node.state ?? "—"}</Typography>
                  </TableCell>
                </TableRow>
              );
            })}

            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} sx={{ border: 0 }}>
                  <EmptyState
                    size="small"
                    icon={<StorageIcon sx={{ fontSize: 28 }} />}
                    heading="No storage rows found"
                    description="Try adjusting filters or verify shard data is available in the connected cluster."
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
