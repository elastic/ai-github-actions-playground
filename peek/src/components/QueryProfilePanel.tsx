import { useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

// -----------------------------------------------------------------------
// Defensive types for the ES|QL profile payload.
// The profile shape is documented as unstable in the OpenAPI spec, so we
// parse it defensively and fall back to a raw JSON view when the structure
// differs from the expected shape.
// -----------------------------------------------------------------------

interface ProfileOperatorStatus {
  pages_processed?: number;
  rows_processed?: number;
  cpu_nanos?: number;
  elapsed_nanos?: number;
  process_nanos?: number;
  [key: string]: unknown;
}

interface ProfileOperator {
  operator?: string;
  status?: ProfileOperatorStatus;
}

interface ProfileDriver {
  description?: string;
  cluster_name?: string;
  node_name?: string;
  millis?: number;
  operators?: ProfileOperator[];
}

interface EsqlProfile {
  drivers?: ProfileDriver[];
}

function isEsqlProfile(value: unknown): value is EsqlProfile {
  return (
    typeof value === "object" &&
    value !== null &&
    "drivers" in value &&
    Array.isArray((value as EsqlProfile).drivers)
  );
}

function nanoToMs(nanos: number | undefined): string {
  if (nanos === undefined) return "—";
  return `${(nanos / 1_000_000).toFixed(2)} ms`;
}

interface DriverRowProps {
  driver: ProfileDriver;
  index: number;
}

function DriverRow({ driver, index }: DriverRowProps) {
  const [open, setOpen] = useState(index === 0);
  const operators = driver.operators ?? [];

  return (
    <Box>
      <Box
        component="button"
        type="button"
        sx={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          px: 1.5,
          py: 0.75,
          border: 0,
          bgcolor: "transparent",
          textAlign: "left",
          cursor: "pointer",
          "&:hover": { bgcolor: "action.hover" },
        }}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <ExpandMoreIcon
          fontSize="small"
          sx={{
            mr: 0.5,
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 0.2s",
            color: "text.secondary",
          }}
        />
        <Typography variant="body2" sx={{ flex: 1 }} noWrap title={driver.description}>
          {driver.description ?? `Driver ${index + 1}`}
        </Typography>
        {driver.millis !== undefined && (
          <Chip label={`${driver.millis} ms`} size="small" color="primary" sx={{ ml: 1 }} />
        )}
      </Box>
      <Collapse in={open}>
        {operators.length > 0 ? (
          <Box sx={{ px: 2, pb: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Operator</TableCell>
                  <TableCell align="right">Elapsed</TableCell>
                  <TableCell align="right">CPU</TableCell>
                  <TableCell align="right">Rows</TableCell>
                  <TableCell align="right">Pages</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {operators
                  .slice()
                  .sort((a, b) => {
                    const aNanos = a.status?.elapsed_nanos ?? a.status?.process_nanos ?? 0;
                    const bNanos = b.status?.elapsed_nanos ?? b.status?.process_nanos ?? 0;
                    return bNanos - aNanos;
                  })
                  .map((op, opIdx) => (
                    <TableRow key={opIdx} hover>
                      <TableCell>
                        <Typography variant="caption">{op.operator ?? "—"}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption">
                          {nanoToMs(op.status?.elapsed_nanos ?? op.status?.process_nanos)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption">{nanoToMs(op.status?.cpu_nanos)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption">
                          {op.status?.rows_processed ?? "—"}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption">
                          {op.status?.pages_processed ?? "—"}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Box>
        ) : (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ px: 2, pb: 1, display: "block" }}
          >
            No operator details available.
          </Typography>
        )}
      </Collapse>
      <Divider />
    </Box>
  );
}

interface QueryProfilePanelProps {
  profile: unknown;
}

export default function QueryProfilePanel({ profile }: QueryProfilePanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!navigator.clipboard) return;
    void navigator.clipboard.writeText(JSON.stringify(profile, null, 2)).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        // writeText rejected (e.g. permission denied) — fail silently
      },
    );
  };

  const knownShape = isEsqlProfile(profile);

  return (
    <Paper variant="outlined">
      {/* Header */}
      <Box sx={{ px: 1.5, py: 0.75, display: "flex", alignItems: "center", gap: 0.5 }}>
        <IconButton
          size="small"
          onClick={() => setExpanded((prev) => !prev)}
          aria-label={expanded ? "Collapse profile" : "Expand profile"}
        >
          <ExpandMoreIcon
            fontSize="small"
            sx={{
              transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
              transition: "transform 0.2s",
            }}
          />
        </IconButton>
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          Query Profile
        </Typography>
        <Tooltip title={copied ? "Copied!" : "Copy profile diagnostics"}>
          <IconButton size="small" onClick={handleCopy} aria-label="Copy profile diagnostics">
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Divider />

      {/* Body */}
      <Collapse in={expanded}>
        {knownShape ? (
          (profile.drivers ?? []).length > 0 ? (
            (profile.drivers ?? []).map((driver, idx) => (
              <DriverRow key={idx} driver={driver} index={idx} />
            ))
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ p: 1.5, display: "block" }}>
              Profile returned no driver details.
            </Typography>
          )
        ) : (
          /* Fallback: render raw JSON for unknown/future profile shapes */
          <Box
            component="pre"
            sx={{
              m: 1,
              p: 1,
              overflow: "auto",
              fontSize: "0.7rem",
              bgcolor: "action.hover",
              borderRadius: 1,
              maxHeight: 300,
            }}
          >
            {JSON.stringify(profile, null, 2)}
          </Box>
        )}
      </Collapse>
    </Paper>
  );
}
