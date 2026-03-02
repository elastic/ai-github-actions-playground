import { useMemo, useState, useEffect, Suspense } from "react";
import { Routes, Route, Navigate, useMatch, useLocation, matchPath } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import LinearProgress from "@mui/material/LinearProgress";
import Drawer from "@mui/material/Drawer";
import useMediaQuery from "@mui/material/useMediaQuery";
import { Toaster, toast } from "sonner";

import { lightTheme, darkTheme } from "./theme";
import { useConnectionStore } from "./store/useConnectionStore";
import { useUIStore } from "./store/useUIStore";
import { useDashboardHistoryStore } from "./store/useDashboardHistoryStore";
import { useDashboardEditorStore } from "./store/useDashboardEditorStore";
import { useResetAllStores } from "./hooks/useResetAllStores";
import { useSessionResume } from "./hooks/useSessionResume";
import AppHeader from "./components/AppHeader";
import AppSidebar from "./components/AppSidebar";
import AiAssistantDrawer from "./components/AiAssistantDrawer";
import ParameterBar from "./components/ParameterBar";
import ConnectionDialog from "./components/ConnectionDialog";
import ResetConfirmationDialog from "./components/ResetConfirmationDialog";
import PanelEditor from "./components/PanelEditor";
import CommandPalette from "./components/CommandPalette";
import DashboardViewPage from "./components/DashboardViewPage";
import WelcomeScreen from "./components/WelcomeScreen";
import ErrorBoundary from "./components/ErrorBoundary";
import PersesProviders from "./components/perses/PersesProviders";
import { PAGE_MANIFEST } from "./routes/manifest";

const currentYear = new Date().getFullYear();

export default function App() {
  const themeMode = useUIStore((s) => s.themeMode);
  const setConnectionDialogOpen = useUIStore((s) => s.setConnectionDialogOpen);
  const connected = useConnectionStore((s) => s.connected);
  const resetState = useResetAllStores();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const handleRequestReset = () => setResetDialogOpen(true);
  const theme = useMemo(() => (themeMode === "dark" ? darkTheme : lightTheme), [themeMode]);
  const dashboardTimeZone = useDashboardEditorStore((s) => s.dashboard.timeZone);
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isDashboardView = Boolean(useMatch("/dashboards/:id"));
  const { resumeError, clearResumeError } = useSessionResume();

  const undoDashboardChange = useDashboardHistoryStore((s) => s.undoDashboardChange);
  const redoDashboardChange = useDashboardHistoryStore((s) => s.redoDashboardChange);

  const location = useLocation();
  useEffect(() => {
    const match = Object.values(PAGE_MANIFEST).find((p) => matchPath(p.path, location.pathname));
    document.title = match ? `${match.nav.label} — Elastic Peek` : "Elastic Peek";
  }, [location.pathname]);

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

  useEffect(() => {
    if (!resumeError) return;
    toast.warning(`Could not resume session: ${resumeError}`, {
      action: {
        label: "Reconnect",
        onClick: () => {
          setConnectionDialogOpen(true);
        },
      },
    });
    clearResumeError();
  }, [resumeError, clearResumeError, setConnectionDialogOpen]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <PersesProviders timeZone={dashboardTimeZone}>
        <Box
          sx={{ display: "flex", flexDirection: "column", height: "100vh", overflowX: "hidden" }}
        >
          <AppHeader
            showMobileNavToggle={connected && isMobile}
            onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)}
          />
          <Box sx={{ display: "flex", flex: 1, minHeight: 0, overflowX: "hidden" }}>
            {connected &&
              (isMobile ? (
                <Drawer
                  anchor="left"
                  open={mobileNavOpen}
                  onClose={() => setMobileNavOpen(false)}
                  variant="temporary"
                  ModalProps={{ keepMounted: true }}
                >
                  <AppSidebar
                    mobile
                    onNavigate={() => setMobileNavOpen(false)}
                    onRequestReset={handleRequestReset}
                  />
                </Drawer>
              ) : (
                <AppSidebar
                  collapsed={sidebarCollapsed}
                  onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
                  onRequestReset={handleRequestReset}
                />
              ))}
            <Box sx={{ display: "flex", flex: 1, flexDirection: "column", minWidth: 0 }}>
              {connected && isDashboardView && <ParameterBar />}
              <Box
                component="main"
                sx={{
                  display: "flex",
                  flex: 1,
                  flexDirection: "column",
                  minHeight: 0,
                  overflowX: "hidden",
                  overflowY: "auto",
                  p: { sm: 2, xs: 1.5 },
                }}
              >
                <Suspense fallback={<LinearProgress />}>
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
                              <ErrorBoundary>
                                <PageComponent />
                              </ErrorBoundary>
                            )
                          }
                        />
                      );
                    })}
                    <Route
                      path="/dashboards/:id"
                      element={
                        !connected ? (
                          <WelcomeScreen />
                        ) : (
                          <ErrorBoundary>
                            <DashboardViewPage />
                          </ErrorBoundary>
                        )
                      }
                    />
                    <Route path="/" element={<Navigate to="/dashboards" replace />} />
                    <Route path="*" element={<Navigate to="/dashboards" replace />} />
                  </Routes>
                </Suspense>
              </Box>
              <Box
                component="footer"
                sx={{
                  position: "relative",
                  display: "flex",
                  flexShrink: 0,
                  gap: 1,
                  justifyContent: "center",
                  alignItems: "center",
                  py: 1,
                  px: 2,
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
                    py: 0.5,
                    px: 1,
                    borderRadius: 1,
                    bgcolor: "warning.main",
                    color: "warning.contrastText",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    fontSize: "0.7rem",
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
            {connected && <AiAssistantDrawer isMobile={isMobile} />}
          </Box>
        </Box>
        <ConnectionDialog />
        <ResetConfirmationDialog
          open={resetDialogOpen}
          onConfirm={() => {
            resetState();
            setResetDialogOpen(false);
          }}
          onCancel={() => setResetDialogOpen(false)}
        />
        <PanelEditor />
        <CommandPalette />
        <Toaster theme={themeMode} position="bottom-left" />
      </PersesProviders>
    </ThemeProvider>
  );
}
