import { useMemo } from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Box from "@mui/material/Box";
import { lightTheme, darkTheme } from "./theme";
import { useDashboardStore } from "./store/useDashboardStore";
import AppHeader from "./components/AppHeader";
import DashboardGrid from "./components/DashboardGrid";
import ConnectionDialog from "./components/ConnectionDialog";
import PanelEditor from "./components/PanelEditor";
import WelcomeScreen from "./components/WelcomeScreen";

export default function App() {
  const themeMode = useDashboardStore((s) => s.themeMode);
  const connected = useDashboardStore((s) => s.connected);
  const theme = useMemo(() => (themeMode === "dark" ? darkTheme : lightTheme), [themeMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <AppHeader />
        <Box component="main" sx={{ flex: 1, p: 2, overflow: "auto" }}>
          {connected ? <DashboardGrid /> : <WelcomeScreen />}
        </Box>
      </Box>
      <ConnectionDialog />
      <PanelEditor />
    </ThemeProvider>
  );
}
