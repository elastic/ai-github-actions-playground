import { useMemo, useState } from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import Button from "@mui/material/Button";
import { lightTheme, darkTheme } from "./theme";
import { useDashboardStore } from "./store/useDashboardStore";
import AppHeader from "./components/AppHeader";
import AppSidebar from "./components/AppSidebar";
import ParameterBar from "./components/ParameterBar";
import DashboardGrid from "./components/DashboardGrid";
import ConnectionDialog from "./components/ConnectionDialog";
import PanelEditor from "./components/PanelEditor";
import WelcomeScreen from "./components/WelcomeScreen";
import DiscoverPage from "./components/DiscoverPage";
import ExplorePage from "./components/ExplorePage";
import DocsPage from "./components/DocsPage";
import ApiConsolePage from "./components/ApiConsolePage";
import DataStreamsPage from "./components/DataStreamsPage";
import ClusterOverviewPage from "./components/ClusterOverviewPage";
import ChatPage from "./components/ChatPage";
import SettingsPage from "./components/SettingsPage";
import TracesPage from "./components/traces/TracesPage";
import DashboardManagementPage from "./components/DashboardManagementPage";

const currentYear = new Date().getFullYear();

export default function App() {
  const themeMode = useDashboardStore((s) => s.themeMode);
  const connected = useDashboardStore((s) => s.connected);
  const currentPage = useDashboardStore((s) => s.currentPage);
  const resetState = useDashboardStore((s) => s.resetState);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const theme = useMemo(() => (themeMode === "dark" ? darkTheme : lightTheme), [themeMode]);
  const requiresConnectionPage =
    currentPage === "dashboard" ||
    currentPage === "discover" ||
    currentPage === "dataStreams" ||
    currentPage === "clusterOverview" ||
    currentPage === "explore" ||
    currentPage === "console" ||
    currentPage === "settings" ||
    currentPage === "dashboardManagement";
  const shouldShowWelcome = !connected && requiresConnectionPage;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        <AppHeader />
        <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
          {connected && (
            <AppSidebar
              collapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
            />
          )}
          <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            {connected && currentPage === "dashboard" && <ParameterBar />}
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
              {shouldShowWelcome ? (
                <WelcomeScreen />
              ) : currentPage === "docs" ? (
                <DocsPage />
              ) : currentPage === "settings" ? (
                <SettingsPage />
              ) : currentPage === "dashboardManagement" ? (
                <DashboardManagementPage />
              ) : currentPage === "chat" ? (
                <ChatPage />
              ) : currentPage === "dataStreams" ? (
                <DataStreamsPage />
              ) : currentPage === "clusterOverview" ? (
                <ClusterOverviewPage />
              ) : currentPage === "explore" ? (
                <ExplorePage />
              ) : currentPage === "discover" ? (
                <DiscoverPage />
              ) : currentPage === "traces" ? (
                <TracesPage />
              ) : currentPage === "console" ? (
                <ApiConsolePage />
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
                position: "relative",
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
              <Button
                size="small"
                color="error"
                variant="text"
                onClick={resetState}
                aria-label="Reset state"
                sx={{ position: "absolute", right: 8 }}
              >
                Reset
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
      <ConnectionDialog />
      <PanelEditor />
    </ThemeProvider>
  );
}
