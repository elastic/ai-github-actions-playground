import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import type { NamespaceRow } from "./k8sHelpers";
import { formatCpu, formatMemory } from "./k8sHelpers";

interface K8sNamespaceTableProps {
  rows: NamespaceRow[];
}

export default function K8sNamespaceTable({ rows }: K8sNamespaceTableProps) {
  return (
    <Paper variant="outlined" sx={{ overflow: "auto" }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Namespaces
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {rows.length} namespace{rows.length !== 1 ? "s" : ""} in this cluster
        </Typography>
      </Box>
      <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <Box component="th" sx={{ p: 1, textAlign: "left" }}>
              Namespace
            </Box>
            <Box component="th" sx={{ p: 1, textAlign: "right" }}>
              Pods
            </Box>
            <Box component="th" sx={{ p: 1, textAlign: "right" }}>
              Avg CPU
            </Box>
            <Box component="th" sx={{ p: 1, textAlign: "right" }}>
              Avg Memory
            </Box>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.namespace}>
              <Box component="td" sx={{ p: 1 }}>
                {row.namespace}
              </Box>
              <Box component="td" sx={{ p: 1, textAlign: "right" }}>
                {row.podCount}
              </Box>
              <Box component="td" sx={{ p: 1, textAlign: "right" }}>
                {formatCpu(row.avgCpu)}
              </Box>
              <Box component="td" sx={{ p: 1, textAlign: "right" }}>
                {formatMemory(row.avgMemory)}
              </Box>
            </tr>
          ))}
        </tbody>
      </Box>
    </Paper>
  );
}
