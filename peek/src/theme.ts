import { createTheme, type ThemeOptions } from "@mui/material/styles";

const baseOptions: ThemeOptions = {
  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiCssBaseline: {
      styleOverrides: `
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `,
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 500 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
  },
};

export const lightTheme = createTheme({
  ...baseOptions,
  palette: {
    mode: "light",
    primary: { main: "#0077CC" },
    secondary: { main: "#00BFB3" },
    background: { default: "#F5F7FA", paper: "#FFFFFF" },
    text: { primary: "#1A1C21", secondary: "#69707D" },
  },
});

export const darkTheme = createTheme({
  ...baseOptions,
  palette: {
    mode: "dark",
    primary: { main: "#36A2EF" },
    secondary: { main: "#7DE2D1" },
    background: { default: "#1D1E24", paper: "#25262E" },
    text: { primary: "#DFE5EF", secondary: "#B0B8C4" },
  },
});

/** Tooltip background colors for chart themes */
export const CHART_TOOLTIP_BG_DARK = "#2D2E36";
export const CHART_TOOLTIP_BG_LIGHT = "#FFFFFF";

/** Color palette for chart series, inspired by Elastic's visualization palette */
export const CHART_COLORS = [
  "#0077CC",
  "#00BFB3",
  "#BD271E",
  "#F5A623",
  "#6092C0",
  "#D36086",
  "#9170B8",
  "#CA8EAE",
  "#54B399",
  "#DA8B45",
  "#AA6556",
  "#E7664C",
];
