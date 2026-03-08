import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import WarningIcon from "@mui/icons-material/Warning";

import {
  abbrevRole,
  roleLabel,
  nodeHealth,
  percentLevel,
  levelColor,
  NODE_THRESHOLDS,
  type HealthLevel,
  type NodeTableRow,
} from "./nodeTableHelpers";

function HealthIcon({ level }: { level: HealthLevel }) {
  if (level === "critical")
    return (
      <Tooltip title="Critical: high resource pressure or errors">
        <ErrorIcon fontSize="small" color="error" aria-label="Critical" />
      </Tooltip>
    );
  if (level === "warning")
    return (
      <Tooltip title="Warning: elevated resource usage">
        <WarningIcon fontSize="small" color="warning" aria-label="Warning" />
      </Tooltip>
    );
  return (
    <Tooltip title="OK">
      <CheckCircleIcon fontSize="small" color="success" aria-label="OK" />
    </Tooltip>
  );
}

export function NodeRow({ row, onClick }: { row: NodeTableRow; onClick: () => void }) {
  const health = nodeHealth(row);
  const cpuLevel =
    row.cpuPercent !== null
      ? percentLevel(row.cpuPercent, NODE_THRESHOLDS.cpu.warning, NODE_THRESHOLDS.cpu.critical)
      : "ok";
  const heapLevel =
    row.heapPercent !== null
      ? percentLevel(row.heapPercent, NODE_THRESHOLDS.heap.warning, NODE_THRESHOLDS.heap.critical)
      : "ok";
  const diskLevel =
    row.fsUsedPercent !== null
      ? percentLevel(row.fsUsedPercent, NODE_THRESHOLDS.disk.warning, NODE_THRESHOLDS.disk.critical)
      : "ok";

  return (
    <TableRow
      hover
      role="button"
      tabIndex={0}
      aria-label={`Open node details for ${row.name}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
          event.preventDefault();
          onClick();
        }
      }}
      sx={{ cursor: "pointer" }}
    >
      <TableCell sx={{ px: 1 }}>
        <HealthIcon level={health} />
      </TableCell>
      <TableCell>
        <Typography variant="body2" noWrap title={`${row.name} (${row.id})`}>
          {row.name}
        </Typography>
        {row.transportAddress && (
          <Typography variant="caption" color="text.secondary" display="block">
            {row.transportAddress}
          </Typography>
        )}
      </TableCell>
      <TableCell>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          {row.roles.length > 0
            ? row.roles.map((r) => (
                <Tooltip key={r} title={roleLabel(r)}>
                  <Chip
                    label={abbrevRole(r)}
                    size="small"
                    sx={{ fontSize: "0.65rem", height: 18 }}
                  />
                </Tooltip>
              ))
            : "—"}
        </Stack>
      </TableCell>
      <TableCell>
        <Typography variant="body2" noWrap>
          {row.version}
        </Typography>
      </TableCell>
      <TableCell
        align="right"
        sx={{ color: levelColor(cpuLevel), fontWeight: cpuLevel !== "ok" ? 600 : undefined }}
      >
        {row.cpuPercent === null ? "n/a" : `${row.cpuPercent.toFixed(0)}%`}
      </TableCell>
      <TableCell align="right">{row.load1m === null ? "n/a" : row.load1m.toFixed(2)}</TableCell>
      <TableCell
        align="right"
        sx={{ color: levelColor(heapLevel), fontWeight: heapLevel !== "ok" ? 600 : undefined }}
      >
        {row.heapPercent === null ? "n/a" : `${row.heapPercent.toFixed(0)}%`}
      </TableCell>
      <TableCell align="right">
        {row.gcOldCount === null ? (
          "n/a"
        ) : (
          <Tooltip
            title={
              row.gcOldMs === null
                ? `${row.gcOldCount.toLocaleString()} collections, GC time unavailable`
                : `${row.gcOldCount.toLocaleString()} collections, ${row.gcOldMs.toLocaleString()} ms total`
            }
          >
            <span>
              {row.gcOldCount.toLocaleString()} /{" "}
              {row.gcOldMs !== null
                ? row.gcOldMs >= 1000
                  ? `${(row.gcOldMs / 1000).toFixed(1)}s`
                  : `${row.gcOldMs}ms`
                : "?"}
            </span>
          </Tooltip>
        )}
      </TableCell>
      <TableCell
        align="right"
        sx={{ color: levelColor(diskLevel), fontWeight: diskLevel !== "ok" ? 600 : undefined }}
      >
        {row.fsUsedPercent === null ? "n/a" : `${row.fsUsedPercent.toFixed(0)}%`}
      </TableCell>
      <TableCell align="right" sx={{ color: "text.secondary" }}>
        {row.totalThreadRejections === null ? "n/a" : row.totalThreadRejections.toLocaleString()}
      </TableCell>
      <TableCell
        align="right"
        sx={{
          color:
            row.totalBreakerTrips !== null && row.totalBreakerTrips > 0 ? "error.main" : undefined,
          fontWeight: row.totalBreakerTrips !== null && row.totalBreakerTrips > 0 ? 600 : undefined,
        }}
      >
        {row.totalBreakerTrips === null ? "n/a" : row.totalBreakerTrips.toLocaleString()}
      </TableCell>
      <TableCell align="right">
        {row.docCount === null ? "n/a" : row.docCount.toLocaleString()}
      </TableCell>
      <TableCell align="right">
        {row.shardCount === null ? "n/a" : row.shardCount.toLocaleString()}
      </TableCell>
    </TableRow>
  );
}
