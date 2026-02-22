import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import { useDashboardStore } from "../store/useDashboardStore";
import { fetchDemoConfig, type DemoConfig } from "../services/demo";
import { ElasticsearchClient, isElasticsearchError } from "../services/es";

const logoUrl = `${import.meta.env.BASE_URL}logo.png`;

export default function WelcomeScreen() {
  const setConnectionDialogOpen = useDashboardStore((s) => s.setConnectionDialogOpen);
  const setConnection = useDashboardStore((s) => s.setConnection);
  const setConnected = useDashboardStore((s) => s.setConnected);

  const [demoConfig, setDemoConfig] = useState<DemoConfig | null>(null);
  const [connectingDemo, setConnectingDemo] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  useEffect(() => {
    fetchDemoConfig()
      .then(setDemoConfig)
      .catch(() => setDemoConfig(null));
  }, []);

  const handleTryDemo = async () => {
    if (!demoConfig) return;
    setConnectingDemo(true);
    setDemoError(null);
    try {
      const conn = {
        url: demoConfig.url,
        username: demoConfig.username,
        password: demoConfig.password,
      };
      const client = new ElasticsearchClient(conn);
      await client.getClusterInfo();
      setConnection(conn);
      setConnected(true);
    } catch (err: unknown) {
      const message = isElasticsearchError(err) ? err.message : String(err);
      setDemoError(message);
    } finally {
      setConnectingDemo(false);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
      }}
    >
      <Paper
        sx={{
          p: 6,
          maxWidth: 520,
          textAlign: "center",
          borderRadius: 3,
        }}
        elevation={2}
      >
        <Box
          component="img"
          src={logoUrl}
          alt="Elastic Peek"
          sx={{ width: 160, height: 160, mb: 2, objectFit: "contain" }}
        />
        <Typography variant="h4" gutterBottom>
          Elastic Peek
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
          A lightweight Elasticsearch dashboarding tool built by an{" "}
          <strong>AI Software Factory</strong> research project.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Connect to your Elasticsearch cluster to start exploring your data. Your dashboard is
          saved locally in the browser.
        </Typography>
        <Button variant="contained" size="large" onClick={() => setConnectionDialogOpen(true)}>
          Connect to Elasticsearch
        </Button>
        {demoConfig && (
          <>
            <Divider sx={{ my: 3 }}>or</Divider>
            <Button
              variant="outlined"
              size="large"
              onClick={() => void handleTryDemo()}
              disabled={connectingDemo}
              startIcon={connectingDemo ? <CircularProgress size={18} /> : undefined}
            >
              {connectingDemo ? "Connecting…" : "Try the Demo"}
            </Button>
            {demoError && (
              <Typography variant="caption" color="error" display="block" sx={{ mt: 1 }}>
                {demoError}
              </Typography>
            )}
          </>
        )}
      </Paper>
    </Box>
  );
}
