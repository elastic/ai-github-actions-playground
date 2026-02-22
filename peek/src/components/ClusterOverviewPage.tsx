import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import {
  ElasticsearchClient,
  isElasticsearchError,
  type ClusterInfoResponse,
  type GetDataStreamsResponse,
  type ResolveIndexResponse,
} from "../services/es";
import { useDashboardStore } from "../store/useDashboardStore";

interface OverviewData {
  clusterInfo: ClusterInfoResponse | null;
  dataStreamCount: number;
  indexCount: number;
  aliasCount: number;
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

export default function ClusterOverviewPage() {
  const connection = useDashboardStore((s) => s.connection);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OverviewData>({
    clusterInfo: null,
    dataStreamCount: 0,
    indexCount: 0,
    aliasCount: 0,
  });

  const loadOverview = useCallback(async () => {
    if (!connection) return;
    setLoading(true);
    setError(null);
    try {
      const client = new ElasticsearchClient(connection);
      const [clusterInfo, dataStreams, resolveIndex] = await Promise.all([
        client.getClusterInfo(),
        client.getDataStreams().catch((): GetDataStreamsResponse => ({ data_streams: [] })),
        client
          .resolveIndex("*")
          .catch((): ResolveIndexResponse => ({ indices: [], aliases: [], data_streams: [] })),
      ]);
      setData({
        clusterInfo,
        dataStreamCount: dataStreams.data_streams?.length ?? 0,
        indexCount: resolveIndex.indices?.length ?? 0,
        aliasCount: resolveIndex.aliases?.length ?? 0,
      });
    } catch (err) {
      setError(isElasticsearchError(err) ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const { clusterInfo } = data;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" sx={{ flex: 1 }}>
            Cluster Overview
          </Typography>
          <Button size="small" variant="outlined" onClick={loadOverview} disabled={loading}>
            {loading ? <CircularProgress size={16} /> : "Refresh"}
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      {loading && !clusterInfo ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={2}>
          <Stack direction="row" spacing={2}>
            <Box sx={{ flex: 1 }}>
              <InfoCard title="Cluster">
                {clusterInfo ? (
                  <Stack spacing={1}>
                    <Typography variant="h5">{clusterInfo.cluster_name}</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip size="small" label={`UUID: ${clusterInfo.cluster_uuid}`} />
                      <Chip size="small" label={`Node: ${clusterInfo.name}`} />
                    </Stack>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No cluster info available.
                  </Typography>
                )}
              </InfoCard>
            </Box>

            <Box sx={{ flex: 1 }}>
              <InfoCard title="Version">
                {clusterInfo?.version ? (
                  <Stack spacing={1}>
                    <Typography variant="h5">{clusterInfo.version.number}</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip size="small" label={`Lucene: ${clusterInfo.version.lucene_version}`} />
                      <Chip
                        size="small"
                        label={`Build: ${clusterInfo.version.build_hash?.slice(0, 7) ?? "unknown"}`}
                      />
                    </Stack>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No version info available.
                  </Typography>
                )}
              </InfoCard>
            </Box>
          </Stack>

          <Stack direction="row" spacing={2}>
            <Box sx={{ flex: 1 }}>
              <InfoCard title="Data Streams">
                <Typography variant="h4">{data.dataStreamCount}</Typography>
              </InfoCard>
            </Box>

            <Box sx={{ flex: 1 }}>
              <InfoCard title="Indices">
                <Typography variant="h4">{data.indexCount}</Typography>
              </InfoCard>
            </Box>

            <Box sx={{ flex: 1 }}>
              <InfoCard title="Aliases">
                <Typography variant="h4">{data.aliasCount}</Typography>
              </InfoCard>
            </Box>
          </Stack>
        </Stack>
      )}
    </Box>
  );
}
