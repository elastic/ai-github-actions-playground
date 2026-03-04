import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import InsightSlot from "../InsightSlot";

import type { DeploymentRow } from "./serviceDashboardHelpers";
import { formatErrorRate } from "./serviceInventoryHelpers";

function formatFriendlyTimestamp(ts: string): string {
  if (!ts) return "—";
  try {
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return "—";
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayDiff = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);
    const timeLabel = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (dayDiff === 0) return `Today, ${timeLabel}`;
    if (dayDiff === 1) return `Yesterday, ${timeLabel}`;
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatExactTimestamp(ts: string): string {
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString();
}

interface ServiceDeploymentsPanelProps {
  deployments: DeploymentRow[];
  deploymentInsightSlotIds?: Record<string, string>;
}

export default function ServiceDeploymentsPanel({
  deployments,
  deploymentInsightSlotIds,
}: ServiceDeploymentsPanelProps) {
  return (
    <Paper variant="outlined" sx={{ minHeight: 120, overflowX: "auto" }}>
      <Box
        sx={{
          display: "flex",
          gap: 0.5,
          alignItems: "center",
          py: 1,
          px: 1,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Deployments
        </Typography>
        <Tooltip title="Version history inferred from trace data.">
          <IconButton size="small" aria-label="About deployments">
            <InfoOutlinedIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
      </Box>
      <Table
        size="small"
        aria-label="Service deployments"
        sx={{
          minWidth: { sm: 520, xs: "100%" },
          "& td, & th": { py: 1, px: 1.5 },
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: "20%" }}>Version</TableCell>
            <TableCell sx={{ width: "20%" }}>First Seen</TableCell>
            <TableCell sx={{ width: "20%" }}>Last Seen</TableCell>
            <TableCell align="right" sx={{ width: "12%" }}>
              Requests
            </TableCell>
            <TableCell align="right" sx={{ width: "16%", whiteSpace: "nowrap" }}>
              Error Rate
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {deployments.map((row, index) => (
            <TableRow key={row.version} hover>
              <TableCell>
                {(() => {
                  const versionChip = (
                    <Chip
                      size="small"
                      label={row.version}
                      color={index === 0 ? "primary" : "default"}
                      variant={index === 0 ? "filled" : "outlined"}
                    />
                  );
                  const slotId = deploymentInsightSlotIds?.[row.version];
                  return slotId ? (
                    <InsightSlot slotId={slotId}>{versionChip}</InsightSlot>
                  ) : (
                    versionChip
                  );
                })()}
              </TableCell>
              <TableCell>
                <Tooltip title={formatExactTimestamp(row.firstSeen)}>
                  <Typography variant="body2" noWrap>
                    {formatFriendlyTimestamp(row.firstSeen)}
                  </Typography>
                </Tooltip>
              </TableCell>
              <TableCell>
                <Tooltip title={formatExactTimestamp(row.lastSeen)}>
                  <Typography variant="body2" noWrap>
                    {formatFriendlyTimestamp(row.lastSeen)}
                  </Typography>
                </Tooltip>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2">{row.requestCount.toLocaleString()}</Typography>
              </TableCell>
              <TableCell align="right">
                <Chip
                  size="small"
                  label={formatErrorRate(row.errorRate)}
                  color={row.errorRate > 0.05 ? "error" : "default"}
                  variant={row.errorRate > 0.05 ? "filled" : "outlined"}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}
