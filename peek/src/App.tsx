import { useMemo } from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import { lightTheme, darkTheme } from "./theme";
import { useDashboardStore } from "./store/useDashboardStore";
import AppHeader from "./components/AppHeader";
import DashboardGrid from "./components/DashboardGrid";
import ConnectionDialog from "./components/ConnectionDialog";
import PanelEditor from "./components/PanelEditor";
import WelcomeScreen from "./components/WelcomeScreen";
import DiscoverPage from "./components/DiscoverPage";
import ExplorePage from "./components/ExplorePage";
import DocsPage from "./components/DocsPage";
import DataStreamsPage from "./components/DataStreamsPage";

const currentYear = new Date().getFullYear();

export default function App() {
  const themeMode = useDashboardStore((s) => s.themeMode);
  const connected = useDashboardStore((s) => s.connected);
  const currentPage = useDashboardStore((s) => s.currentPage);
  const theme = useMemo(() => (themeMode === "dark" ? darkTheme : lightTheme), [themeMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        <AppHeader />
        <Box
          component="main"
          sx={{
            flex: 1,
            minHeight: 0,
            p: 2,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {currentPage === "docs" ? (
            <DocsPage />
          ) : !connected ? (
            <WelcomeScreen />
          ) : currentPage === "dataStreams" ? (
            <DataStreamsPage />
          ) : currentPage === "explore" ? (
            <ExplorePage />
          ) : currentPage === "discover" ? (
            <DiscoverPage />
          ) : (
            <DashboardGrid />
          )}
        </Box>
        <Box
          component="footer"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            py: 0.75,
            px: 2,
            flexShrink: 0,
            borderTop: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <Link
            href="https://github.com/elastic/ai-github-actions-playground"
            target="_blank"
            rel="noopener noreferrer"
            underline="none"
            sx={{
              px: 1,
              py: 0.25,
              borderRadius: 1,
              bgcolor: "warning.main",
              color: "warning.contrastText",
              fontSize: "0.7rem",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              "&:hover": { bgcolor: "warning.dark" },
            }}
          >
            Research Project
          </Link>
          <Typography variant="caption" color="text.secondary">
            Not an official product &mdash; &copy; {currentYear}{" "}
            <Link
              href="https://www.elastic.co"
              target="_blank"
              rel="noopener noreferrer"
              color="inherit"
              underline="hover"
            >
              Elasticsearch B.V.
            </Link>
          </Typography>
        </Box>
      </Box>
      <ConnectionDialog />
      <PanelEditor />
    </ThemeProvider>
  );
}
