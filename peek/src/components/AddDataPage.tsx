import { useCallback, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import { ElasticsearchClient, isElasticsearchError } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";
import { copyToClipboard } from "../utils/copyToClipboard";

type Platform = "kubernetes" | "docker" | "hosts";

const PLATFORM_GUIDES: Record<Platform, { label: string; quickstartUrl: string; command: string }> =
  {
    kubernetes: {
      label: "Kubernetes",
      quickstartUrl:
        "https://www.elastic.co/docs/solutions/observability/get-started/quickstart-monitor-hosts-with-elastic-agent-on-kubernetes",
      command: `helm repo add elastic https://helm.elastic.co
helm repo update
helm install elastic-agent elastic/elastic-agent \\
  --namespace kube-system \\
  --set outputs.default.type=elasticsearch \\
  --set outputs.default.hosts[0]=https://<your-elasticsearch-endpoint>:443 \\
  --set outputs.default.api_key=<base64-api-key>`,
    },
    docker: {
      label: "Docker",
      quickstartUrl:
        "https://www.elastic.co/docs/solutions/observability/get-started/quickstart-monitor-hosts-with-elastic-agent-on-docker",
      command: `docker run --rm \\
  -e ELASTICSEARCH_HOST=https://<your-elasticsearch-endpoint>:443 \\
  -e ELASTICSEARCH_API_KEY=<base64-api-key> \\
  docker.elastic.co/elastic-agent/elastic-agent:latest`,
    },
    hosts: {
      label: "Hosts / VMs",
      quickstartUrl:
        "https://www.elastic.co/docs/solutions/observability/get-started/quickstart-monitor-hosts-with-elastic-agent",
      command: `curl -L -O https://artifacts.elastic.co/downloads/beats/elastic-agent/elastic-agent-<version>-<platform>.tar.gz
tar xzvf elastic-agent-<version>-<platform>.tar.gz
cd elastic-agent-<version>-<platform>
sudo ./elastic-agent install \\
  --url=https://<your-elasticsearch-endpoint>:443 \\
  --api-key=<base64-api-key>`,
    },
  };

export default function AddDataPage() {
  const connection = useConnectionStore((s) => s.connection);
  const capabilities = useConnectionStore((s) => s.capabilities);
  const [platform, setPlatform] = useState<Platform>("kubernetes");
  const [creatingApiKey, setCreatingApiKey] = useState(false);
  const [apiKeyValue, setApiKeyValue] = useState<string | null>(null);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const activeGuide = useMemo(() => PLATFORM_GUIDES[platform], [platform]);

  const handleCreateApiKey = useCallback(async () => {
    if (!connection) return;
    setCreatingApiKey(true);
    setApiKeyError(null);
    setApiKeyValue(null);
    try {
      const client = new ElasticsearchClient(connection);
      const response = await client.createApiKey({
        name: `peek-edot-${Date.now()}`,
        metadata: { managed_by: "elastic-peek", purpose: "edot-onboarding" },
      });
      setApiKeyValue(response.encodedApiKey);
    } catch (err) {
      setApiKeyError(isElasticsearchError(err) ? err.message : String(err));
    } finally {
      setCreatingApiKey(false);
    }
  }, [connection]);

  const handleCopyApiKey = useCallback(async () => {
    if (!apiKeyValue) return;
    const ok = await copyToClipboard(apiKeyValue);
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [apiKeyValue]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, minHeight: 0, height: "100%" }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Typography variant="h6">Add Data</Typography>
        <Typography variant="body2" color="text.secondary">
          Set up Elastic Distribution of OpenTelemetry with official quickstart guides for your
          platform, then verify telemetry is flowing into Metrics and Traces.
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Tabs
          value={platform}
          onChange={(_, value: Platform) => setPlatform(value)}
          sx={{ minHeight: 36, "& .MuiTab-root": { minHeight: 36, py: 0.5 } }}
        >
          <Tab value="kubernetes" label="Kubernetes" />
          <Tab value="docker" label="Docker" />
          <Tab value="hosts" label="Hosts / VMs" />
        </Tabs>

        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            {activeGuide.label} quickstart
          </Typography>
          <Button
            size="small"
            variant="outlined"
            href={activeGuide.quickstartUrl}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<OpenInNewIcon fontSize="small" />}
          >
            Open official docs
          </Button>
        </Stack>

        <TextField
          label="Starter command"
          value={activeGuide.command}
          multiline
          minRows={7}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />
        <Alert severity="info">
          Replace endpoint and API key placeholders with your own values before running the command.
        </Alert>
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="subtitle2">Collector credentials</Typography>
        {apiKeyError && <Alert severity="error">{apiKeyError}</Alert>}
        {capabilities?.canCreateApiKeys ? (
          <>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                size="small"
                variant="contained"
                onClick={() => void handleCreateApiKey()}
                disabled={creatingApiKey}
              >
                {creatingApiKey ? <CircularProgress size={16} /> : "Generate API key"}
              </Button>
              <Typography variant="body2" color="text.secondary">
                Generates a one-time API key for collector setup.
              </Typography>
            </Stack>
            {apiKeyValue && (
              <>
                <Alert severity="warning">
                  Copy this API key now. You will not be able to read it again after leaving this
                  page.
                </Alert>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    size="small"
                    fullWidth
                    label="Base64 API key"
                    value={apiKeyValue}
                    slotProps={{ input: { readOnly: true } }}
                  />
                  <Button size="small" variant="outlined" onClick={() => void handleCopyApiKey()}>
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </Stack>
              </>
            )}
          </>
        ) : (
          <Alert severity="warning">
            Your credentials do not include API key creation privileges. Generate a key manually via{" "}
            <Link
              href="https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-security-create-api-key"
              target="_blank"
              rel="noopener noreferrer"
            >
              Create API key API
            </Link>{" "}
            or ask an administrator to provision one for collector onboarding.
          </Alert>
        )}
      </Paper>
    </Box>
  );
}
