import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import type { ServiceK8sRow } from "./serviceDashboardHelpers";

interface ServiceK8sInfoPanelProps {
  rows: ServiceK8sRow[];
}

export default function ServiceK8sInfoPanel({ rows }: ServiceK8sInfoPanelProps) {
  const navigate = useNavigate();

  return (
    <Paper variant="outlined" sx={{ minHeight: 120, overflow: "auto" }}>
      <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Infrastructure
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Kubernetes pods, namespaces, and nodes associated with this service
        </Typography>
      </Box>
      <Table size="small" aria-label="Kubernetes infrastructure context">
        <TableHead>
          <TableRow>
            <TableCell>Pod</TableCell>
            <TableCell>Namespace</TableCell>
            <TableCell>Node</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.namespace}-${row.pod}-${row.node}`} hover>
              <TableCell>
                {row.pod ? (
                  <Link
                    component="button"
                    variant="body2"
                    underline="hover"
                    onClick={() => navigate(`/kubernetes/pod/${encodeURIComponent(row.pod)}`)}
                  >
                    {row.pod}
                  </Link>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    —
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                {row.namespace ? (
                  <Link
                    component="button"
                    variant="body2"
                    underline="hover"
                    onClick={() =>
                      navigate(`/kubernetes/namespace/${encodeURIComponent(row.namespace)}`)
                    }
                  >
                    {row.namespace}
                  </Link>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    —
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <Typography variant="body2">{row.node || "—"}</Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}
