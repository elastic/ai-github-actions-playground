import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import type { PodRow } from "./k8sHelpers";
import { formatCpu, formatMemory } from "./k8sHelpers";

interface K8sPodTableProps {
  rows: PodRow[];
}

export default function K8sPodTable({ rows }: K8sPodTableProps) {
  return (
    <Paper variant="outlined" sx={{ overflow: "auto" }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Pods
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {rows.length} pod{rows.length !== 1 ? "s" : ""} in this namespace
        </Typography>
      </Box>
      <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <Box component="th" sx={{ p: 1, textAlign: "left" }}>
              Pod
            </Box>
            <Box component="th" sx={{ p: 1, textAlign: "left" }}>
              Node
            </Box>
            <Box component="th" sx={{ p: 1, textAlign: "right" }}>
              Avg CPU
            </Box>
            <Box component="th" sx={{ p: 1, textAlign: "right" }}>
              Avg Memory
            </Box>
            <Box component="th" sx={{ p: 1, textAlign: "right" }}>
              Restarts
            </Box>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.podName}>
              <Box component="td" sx={{ p: 1 }}>
                {row.podName}
              </Box>
              <Box component="td" sx={{ p: 1 }}>
                {row.nodeName}
              </Box>
              <Box component="td" sx={{ p: 1, textAlign: "right" }}>
                {formatCpu(row.avgCpu)}
              </Box>
              <Box component="td" sx={{ p: 1, textAlign: "right" }}>
                {formatMemory(row.avgMemory)}
              </Box>
              <Box component="td" sx={{ p: 1, textAlign: "right" }}>
                {row.restarts}
              </Box>
            </tr>
          ))}
        </tbody>
      </Box>
    </Paper>
  );
}
