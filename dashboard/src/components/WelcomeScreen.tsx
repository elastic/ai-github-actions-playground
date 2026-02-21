import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import StorageIcon from "@mui/icons-material/Storage";
import { useDashboardStore } from "../store/useDashboardStore";

export default function WelcomeScreen() {
  const setConnectionDialogOpen = useDashboardStore((s) => s.setConnectionDialogOpen);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100vh - 64px)",
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
        <StorageIcon sx={{ fontSize: 64, color: "primary.main", mb: 2 }} />
        <Typography variant="h4" gutterBottom>
          ES|QL Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
          A lightweight dashboarding tool powered by <strong>Perses</strong> components and
          Elasticsearch <strong>ES|QL</strong>.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Connect to your Elasticsearch cluster to start building visualizations with ES|QL queries.
          Your dashboard is saved locally in the browser.
        </Typography>
        <Button variant="contained" size="large" onClick={() => setConnectionDialogOpen(true)}>
          Connect to Elasticsearch
        </Button>
      </Paper>
    </Box>
  );
}
