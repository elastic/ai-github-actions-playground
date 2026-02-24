import { useMemo, useState, useEffect } from "react";
import { Routes, Route, Navigate, useMatch } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

import { lightTheme, darkTheme } from "./theme";
import { useConnectionStore } from "./store/useConnectionStore";
import { useUIStore } from "./store/useUIStore";
import { useDashboardStore } from "./store/useDashboardStore";
import { useResetAllStores } from "./hooks/useResetAllStores";
import { useSessionResume } from "./hooks/useSessionResume";
import AppHeader from "./components/AppHeader";
import AppSidebar from "./components/AppSidebar";
import ParameterBar from "./components/ParameterBar";
import ConnectionDialog from "./components/ConnectionDialog";
import PanelEditor from "./components/PanelEditor";
import CommandPalette from "./components/CommandPalette";
import DashboardViewPage from "./components/DashboardViewPage";
import WelcomeScreen from "./components/WelcomeScreen";
import { PAGE_MANIFEST } from "./routes/manifest";

const currentYear = new Date().getFullYear();

export default function App() {
  const themeMode = useUIStore((s) => s.themeMode);
  const setConnectionDialogOpen = useUIStore((s) => s.setConnectionDialogOpen);
  const connected = useConnectionStore((s) => s.connected);
  const resetState = useResetAllStores();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const theme = useMemo(() => (themeMode === "dark" ? darkTheme : lightTheme), [themeMode]);
  const isDashboardView = Boolean(useMatch("/dashboards/:id"));
  const { resumeError, clearResumeError } = useSessionResume();

  const undoDashboardChange = useDashboardStore((s) => s.undoDashboardChange);
  const redoDashboardChange = useDashboardStore((s) => s.redoDashboardChange);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isUndo = (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z";
      const isRedo =
        (e.ctrlKey || e.metaKey) &&
        ((e.shiftKey && e.key.toLowerCase() === "z") || (!e.shiftKey && e.key === "y"));
      if (!isUndo && !isRedo) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const inEditableRegion =
        target?.isContentEditable ||
        Boolean(
          target?.closest('[contenteditable="true"],[contenteditable=""],.cm-editor,.cm-content'),
        );
      if (tag === "INPUT" || tag === "TEXTAREA" || inEditableRegion) return;
      e.preventDefault();
      if (isUndo) undoDashboardChange();
      else redoDashboardChange();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoDashboardChange, redoDashboardChange]);

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
            {connected && isDashboardView && <ParameterBar />}
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
              <Routes>
                {Object.entries(PAGE_MANIFEST).map(([, config]) => {
                  const PageComponent = config.component;
                  return (
                    <Route
                      key={config.path}
                      path={config.path}
                      element={
                        !connected && config.requiresConnection ? (
                          <WelcomeScreen />
                        ) : (
                          <PageComponent />
                        )
                      }
                    />
                  );
                })}
                <Route
                  path="/dashboards/:id"
                  element={!connected ? <WelcomeScreen /> : <DashboardViewPage />}
                />
                <Route path="/" element={<Navigate to="/dashboards" replace />} />
                <Route path="*" element={<Navigate to="/dashboards" replace />} />
              </Routes>
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
      <CommandPalette />
      <Snackbar
        open={Boolean(resumeError)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        onClose={clearResumeError}
      >
        <Alert
          severity="warning"
          onClose={clearResumeError}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                clearResumeError();
                setConnectionDialogOpen(true);
              }}
            >
              Reconnect
            </Button>
          }
          sx={{ width: "100%" }}
        >
          Could not resume session: {resumeError}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}
