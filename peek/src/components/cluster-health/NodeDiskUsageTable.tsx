import LinearProgress from "@mui/material/LinearProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import type { CatAllocationRecord } from "../../services/es";

import { type DiskWatermarks, parseNumber } from "./clusterHealthUtils";

interface NodeDiskUsageTableProps {
  allocation: CatAllocationRecord[];
  watermarks: DiskWatermarks;
}

export default function NodeDiskUsageTable({ allocation, watermarks }: NodeDiskUsageTableProps) {
  const nodes = allocation.filter((a) => a.node && a.node !== "UNASSIGNED");
  if (nodes.length === 0) return null;

  return (
    <>
      <Typography variant="body2" sx={{ mt: 3, mb: 1 }}>
        Node Disk Usage
      </Typography>
      <TableContainer>
        <Table size="small" aria-label="Node Disk Usage">
          <TableHead>
            <TableRow>
              <TableCell>Node</TableCell>
              <TableCell align="right">Disk Used</TableCell>
              <TableCell align="right">Disk Available</TableCell>
              <TableCell align="right">Usage</TableCell>
              <TableCell sx={{ minWidth: 120 }}>Usage Bar</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {nodes.map((a) => {
              const pct = parseNumber(a["disk.percent"]) ?? 0;
              return (
                <TableRow key={a.node}>
                  <TableCell>{a.node}</TableCell>
                  <TableCell align="right">{a["disk.used"] ?? "n/a"}</TableCell>
                  <TableCell align="right">{a["disk.avail"] ?? "n/a"}</TableCell>
                  <TableCell align="right">
                    {a["disk.percent"] != null ? `${a["disk.percent"]}%` : "n/a"}
                  </TableCell>
                  <TableCell>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(pct, 100)}
                      color={
                        pct >= watermarks.flood
                          ? "error"
                          : pct >= watermarks.high
                            ? "warning"
                            : "primary"
                      }
                      sx={{ height: 8, borderRadius: 1 }}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}
