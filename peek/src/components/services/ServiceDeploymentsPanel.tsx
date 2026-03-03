import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import type { DeploymentRow } from "./serviceDashboardHelpers";

function formatTimestamp(ts: string): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

interface ServiceDeploymentsPanelProps {
  deployments: DeploymentRow[];
}

export default function ServiceDeploymentsPanel({ deployments }: ServiceDeploymentsPanelProps) {
  return (
    <Paper variant="outlined" sx={{ overflow: "auto" }}>
      <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Deployments
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Version changes detected from service.version in trace data
        </Typography>
      </Box>
      <Table size="small" aria-label="Service deployments">
        <TableHead>
          <TableRow>
            <TableCell>Version</TableCell>
            <TableCell>First Seen</TableCell>
            <TableCell>Last Seen</TableCell>
            <TableCell align="right">Requests</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {deployments.map((row, index) => (
            <TableRow key={row.version} hover>
              <TableCell>
                <Chip
                  size="small"
                  label={row.version}
                  color={index === 0 ? "primary" : "default"}
                  variant={index === 0 ? "filled" : "outlined"}
                />
              </TableCell>
              <TableCell>
                <Typography variant="body2">{formatTimestamp(row.firstSeen)}</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">{formatTimestamp(row.lastSeen)}</Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2">{row.requestCount.toLocaleString()}</Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}
