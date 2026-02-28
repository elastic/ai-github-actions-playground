import { useMemo, useState } from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Typography from "@mui/material/Typography";
import type { Theme } from "@mui/material/styles";
import { useTheme } from "@mui/material/styles";

import type { ClusterHealthData } from "../../hooks/useClusterHealthData";

import type { InfoCardSeverity } from "./InfoCard";
import { percentSeverity } from "./clusterHealthUtils";

interface NodeRow {
  id: string;
  name: string;
  cpu: number;
  osMem: number;
  heap: number;
  load1m: number | null;
  diskPct: number | null;
  rejections: number;
  trips: number;
  gcOldCount: number;
  gcOldTimeMs: number;
  fdPct: number | null;
}

type SortKey = keyof NodeRow;

function cellColor(severity: InfoCardSeverity | undefined, theme: Theme) {
  if (!severity) return undefined;
  return theme.palette[severity].main;
}

interface NodeDetailTableProps {
  data: ClusterHealthData;
}

export default function NodeDetailTable({ data }: NodeDetailTableProps) {
  const theme = useTheme();
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const rows = useMemo((): NodeRow[] => {
    const nodes = data.nodeStats?.nodes;
    if (!nodes) return [];

    const allocation = data.allocation ?? [];
    const diskByNode = new Map<string, number>();
    for (const a of allocation) {
      if (a.node && a["disk.percent"]) {
        const pct = Number(a["disk.percent"]);
        if (Number.isFinite(pct)) diskByNode.set(a.node, pct);
      }
    }

    return Object.entries(nodes).map(([id, node]) => {
      const pools = ["write", "search", "get"];
      const rejections = pools.reduce((sum, p) => sum + (node.thread_pool?.[p]?.rejected ?? 0), 0);
      const breakers = ["parent", "fielddata", "request", "in_flight_requests"];
      const trips = breakers.reduce((sum, b) => sum + (node.breakers?.[b]?.tripped ?? 0), 0);
      const openFd = node.process?.open_file_descriptors;
      const maxFd = node.process?.max_file_descriptors;
      const fdPct =
        openFd != null && maxFd != null && maxFd > 0 ? Math.round((openFd / maxFd) * 100) : null;

      return {
        id,
        name: node.name ?? "unknown",
        cpu: node.os?.cpu?.percent ?? 0,
        osMem: node.os?.mem?.used_percent ?? 0,
        heap: node.jvm?.mem?.heap_used_percent ?? 0,
        load1m: node.os?.cpu?.load_average?.["1m"] ?? null,
        diskPct: diskByNode.get(node.name ?? "") ?? null,
        rejections,
        trips,
        gcOldCount: node.jvm?.gc?.collectors?.old?.collection_count ?? 0,
        gcOldTimeMs: node.jvm?.gc?.collectors?.old?.collection_time_in_millis ?? 0,
        fdPct,
      };
    });
  }, [data.nodeStats, data.allocation]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortBy] ?? 0;
      const bv = b[sortBy] ?? 0;
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const na = Number(av);
      const nb = Number(bv);
      return sortDir === "asc" ? na - nb : nb - na;
    });
    return copy;
  }, [rows, sortBy, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  if (rows.length === 0) {
    return <Typography color="text.secondary">No node data available.</Typography>;
  }

  const columns: {
    key: SortKey;
    label: string;
    format: (r: NodeRow) => string;
    severity?: (r: NodeRow) => InfoCardSeverity | undefined;
  }[] = [
    { key: "name", label: "Name", format: (r) => r.name },
    {
      key: "cpu",
      label: "CPU%",
      format: (r) => `${r.cpu}%`,
      severity: (r) => percentSeverity(r.cpu, 75, 90),
    },
    {
      key: "osMem",
      label: "OS Mem%",
      format: (r) => `${r.osMem}%`,
      severity: (r) => percentSeverity(r.osMem, 80, 95),
    },
    {
      key: "heap",
      label: "Heap%",
      format: (r) => `${r.heap}%`,
      severity: (r) => percentSeverity(r.heap, 75, 90),
    },
    { key: "load1m", label: "Load 1m", format: (r) => r.load1m?.toFixed(2) ?? "—" },
    {
      key: "diskPct",
      label: "Disk%",
      format: (r) => (r.diskPct != null ? `${r.diskPct}%` : "—"),
      severity: (r) => percentSeverity(r.diskPct, 80, 90),
    },
    {
      key: "rejections",
      label: "Rejections",
      format: (r) => r.rejections.toLocaleString(),
      severity: (r) => (r.rejections > 0 ? "warning" : undefined),
    },
    {
      key: "trips",
      label: "Breaker Trips",
      format: (r) => r.trips.toLocaleString(),
      severity: (r) => (r.trips > 0 ? "error" : undefined),
    },
    { key: "gcOldCount", label: "GC Old", format: (r) => r.gcOldCount.toLocaleString() },
    {
      key: "fdPct",
      label: "FD%",
      format: (r) => (r.fdPct != null ? `${r.fdPct}%` : "—"),
      severity: (r) => percentSeverity(r.fdPct, 70, 90),
    },
  ];

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell key={col.key}>
                <TableSortLabel
                  active={sortBy === col.key}
                  direction={sortBy === col.key ? sortDir : "asc"}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                </TableSortLabel>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.map((row) => (
            <TableRow key={row.id}>
              {columns.map((col) => {
                const sev = col.severity?.(row);
                return (
                  <TableCell
                    key={col.key}
                    sx={{
                      color: sev ? cellColor(sev, theme) : undefined,
                      fontWeight: sev ? 600 : undefined,
                    }}
                  >
                    {col.format(row)}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
