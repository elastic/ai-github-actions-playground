import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import { useDashboardStore } from "../store/useDashboardStore";

const logoUrl = `${import.meta.env.BASE_URL}logo.png`;

export default function WelcomeScreen() {
  const setConnectionDialogOpen = useDashboardStore((s) => s.setConnectionDialogOpen);

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
      </Paper>
    </Box>
  );
}
