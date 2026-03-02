import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ReplayIcon from "@mui/icons-material/Replay";

// -----------------------------------------------------------------------
// Defensive types for the partial-result metadata extracted from ES|QL
// responses.  These fields (_shards, _clusters) are not in the OpenAPI
// spec for the ES|QL endpoint, so we parse them defensively.
// -----------------------------------------------------------------------

interface ShardFailure {
  shard?: number;
  index?: string;
  node?: string;
  reason?: { type?: string; reason?: string };
}

interface ShardsStats {
  total?: number;
  successful?: number;
  skipped?: number;
  failed?: number;
  failures?: ShardFailure[];
}

interface ClusterDetail {
  status?: string;
  timed_out?: boolean;
  indices?: string;
  took?: number;
  _shards?: ShardsStats;
  failures?: ShardFailure[];
}

interface ClustersStats {
  total?: number;
  successful?: number;
  skipped?: number;
  running?: number;
  partial?: number;
  failed?: number;
  details?: Record<string, ClusterDetail>;
}

interface PartialResultMetadata {
  _shards?: ShardsStats;
  _clusters?: ClustersStats;
}

function isPartialResultMetadata(value: unknown): value is PartialResultMetadata {
  return typeof value === "object" && value !== null;
}

/** Returns the names of clusters whose status is "successful" (healthy). */
function getHealthyClusterNames(meta: PartialResultMetadata): string[] {
  const details = meta._clusters?.details;
  if (!details) return [];
  return Object.entries(details)
    .filter(([, detail]) => detail.status === "successful")
    .map(([name]) => name);
}

// -----------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------

interface ShardFailureListProps {
  failures: ShardFailure[];
}

function ShardFailureList({ failures }: ShardFailureListProps) {
  if (failures.length === 0) return null;
  return (
    <Box component="ul" sx={{ m: 0, pl: 2.5, listStyle: "disc" }}>
      {failures.map((f, i) => (
        <Box component="li" key={i} sx={{ mb: 0.5 }}>
          <Typography variant="caption">
            {f.index !== undefined ? (
              <strong>{f.index}</strong>
            ) : (
              <strong>shard {f.shard ?? "?"}</strong>
            )}
            {f.reason?.type && ` — ${f.reason.type}`}
            {f.reason?.reason && `: ${f.reason.reason}`}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

interface ClusterSectionProps {
  name: string;
  detail: ClusterDetail;
}

function ClusterSection({ name, detail }: ClusterSectionProps) {
  const [open, setOpen] = useState(true);
  const statusColor =
    detail.status === "failed"
      ? "error"
      : detail.status === "partial"
        ? "warning"
        : detail.status === "successful"
          ? "success"
          : "default";

  return (
    <Box>
      <Box
        component="button"
        type="button"
        sx={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          py: 0.5,
          px: 1.5,
          border: 0,
          bgcolor: "transparent",
          cursor: "pointer",
          textAlign: "left",
          "&:hover": { bgcolor: "action.hover" },
        }}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <ExpandMoreIcon
          fontSize="small"
          sx={{
            mr: 0.5,
            color: "text.secondary",
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 0.2s",
          }}
        />
        <Typography variant="body2" sx={{ flex: 1 }} noWrap title={name}>
          {name}
        </Typography>
        <Chip
          label={detail.status ?? "unknown"}
          size="small"
          color={statusColor as "error" | "warning" | "success" | "default"}
          sx={{ ml: 1 }}
        />
        {detail.timed_out && (
          <Chip label="timed out" size="small" color="warning" sx={{ ml: 0.5 }} />
        )}
      </Box>
      <Collapse in={open}>
        <Box sx={{ pb: 1, px: 2.5 }}>
          {detail.indices && (
            <Typography variant="caption" color="text.secondary" display="block">
              Indices: {detail.indices}
            </Typography>
          )}
          {detail.took !== undefined && (
            <Typography variant="caption" color="text.secondary" display="block">
              Took: {detail.took} ms
            </Typography>
          )}
          {detail._shards && (
            <Typography variant="caption" color="text.secondary" display="block">
              Shards: {detail._shards.successful ?? 0}/{detail._shards.total ?? 0} successful
              {(detail._shards.failed ?? 0) > 0 && `, ${detail._shards.failed} failed`}
            </Typography>
          )}
          {(detail.failures ?? detail._shards?.failures ?? []).length > 0 && (
            <Box sx={{ mt: 0.5 }}>
              <ShardFailureList failures={detail.failures ?? detail._shards?.failures ?? []} />
            </Box>
          )}
        </Box>
      </Collapse>
      <Divider />
    </Box>
  );
}

// -----------------------------------------------------------------------
// Main component
// -----------------------------------------------------------------------

interface PartialResultPanelProps {
  /** Raw partial-result metadata extracted from the ES|QL response. */
  metadata: unknown;
  /**
   * Called when the user clicks "Re-run on healthy clusters".
   * Receives the list of cluster names whose status was "successful".
   */
  onRerunHealthyClusters?: (healthyClusters: string[]) => void;
}

export default function PartialResultPanel({
  metadata,
  onRerunHealthyClusters,
}: PartialResultPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = null;
      }
    };
  }, []);

  const handleCopy = () => {
    if (!navigator.clipboard) return;
    void navigator.clipboard.writeText(JSON.stringify(metadata, null, 2)).then(
      () => {
        setCopied(true);
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
      },
      () => {
        // writeText rejected — fail silently
      },
    );
  };

  if (!isPartialResultMetadata(metadata)) return null;

  const shards = metadata._shards;
  const clusters = metadata._clusters;
  const failedShards = shards?.failed ?? 0;
  const failedClusters = (clusters?.failed ?? 0) + (clusters?.partial ?? 0);
  const clusterDetails = clusters?.details ? Object.entries(clusters.details) : [];
  const unhealthyClusterDetails = clusterDetails.filter(
    ([, d]) => d.status !== "successful" && d.status !== "skipped",
  );
  const healthyClusters = getHealthyClusterNames(metadata);

  return (
    <Paper variant="outlined" sx={{ borderColor: "warning.main" }}>
      {/* Header */}
      <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", py: 1, px: 1.5 }}>
        <IconButton
          size="small"
          onClick={() => setExpanded((prev) => !prev)}
          aria-label={
            expanded ? "Collapse partial result details" : "Expand partial result details"
          }
        >
          <ExpandMoreIcon
            fontSize="small"
            sx={{
              transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
              transition: "transform 0.2s",
            }}
          />
        </IconButton>
        <WarningAmberIcon fontSize="small" sx={{ mr: 0.5, color: "warning.main" }} />
        <Typography variant="body2" sx={{ flex: 1 }}>
          Partial Results
        </Typography>
        {failedClusters > 0 && (
          <Chip
            label={`${failedClusters} cluster${failedClusters !== 1 ? "s" : ""} affected`}
            size="small"
            color="warning"
          />
        )}
        {failedShards > 0 && (
          <Chip
            label={`${failedShards} shard${failedShards !== 1 ? "s" : ""} failed`}
            size="small"
            color="error"
            sx={{ ml: 0.5 }}
          />
        )}
        <Tooltip title={copied ? "Copied!" : "Copy diagnostic info"}>
          <IconButton
            size="small"
            onClick={handleCopy}
            aria-label="Copy partial result diagnostics"
          >
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Divider />

      {/* Body */}
      <Collapse in={expanded}>
        {/* Shard-level failures (single-cluster / no cluster breakdown) */}
        {clusterDetails.length === 0 && shards && (
          <Box sx={{ py: 1, px: 1.5 }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
              Shards: {shards.successful ?? 0}/{shards.total ?? 0} successful
              {(shards.skipped ?? 0) > 0 && `, ${shards.skipped} skipped`}
              {(shards.failed ?? 0) > 0 && `, ${shards.failed} failed`}
            </Typography>
            {(shards.failures ?? []).length > 0 && (
              <ShardFailureList failures={shards.failures ?? []} />
            )}
          </Box>
        )}

        {/* Cross-cluster breakdown */}
        {clusterDetails.length > 0 && (
          <>
            {unhealthyClusterDetails.length > 0 ? (
              unhealthyClusterDetails.map(([name, detail]) => (
                <ClusterSection key={name} name={name} detail={detail} />
              ))
            ) : (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", py: 1, px: 1.5 }}
              >
                No cluster-level failures found.
              </Typography>
            )}
          </>
        )}

        {/* No diagnostic data at all */}
        {clusterDetails.length === 0 && !shards && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", py: 1, px: 1.5 }}
          >
            No diagnostic details available for this partial response.
          </Typography>
        )}

        {/* Action buttons */}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, py: 1, px: 1.5 }}>
          {onRerunHealthyClusters && healthyClusters.length > 0 && (
            <Tooltip title={`Re-run scoped to: ${healthyClusters.join(", ")}`}>
              <Button
                size="small"
                variant="outlined"
                color="warning"
                startIcon={<ReplayIcon fontSize="small" />}
                onClick={() => onRerunHealthyClusters(healthyClusters)}
              >
                Re-run on healthy clusters
              </Button>
            </Tooltip>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}
