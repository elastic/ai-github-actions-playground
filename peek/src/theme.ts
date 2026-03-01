import { createTheme, type ThemeOptions } from "@mui/material/styles";

const baseOptions: ThemeOptions = {
  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
    h3: { fontWeight: 600, fontVariantNumeric: "tabular-nums", lineHeight: 1.3 },
    h4: { fontWeight: 600, fontVariantNumeric: "tabular-nums", lineHeight: 1.35 },
    h5: { fontWeight: 600, fontVariantNumeric: "tabular-nums", lineHeight: 1.4 },
    h6: { fontWeight: 600, lineHeight: 1.4 },
    overline: {
      fontWeight: 600,
      fontSize: "0.625rem",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      lineHeight: 1.6,
    },
  },
  shape: { borderRadius: 6 },
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
      defaultProps: { size: "small", disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 500,
          height: 32,
          borderRadius: 6,
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundImage: "none",
          border: `1px solid ${theme.palette.border.subtle}`,
        }),
        outlined: ({ theme }) => ({
          border: `1px solid ${theme.palette.border.subtle}`,
        }),
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: ({ theme }) => ({
          borderBottom: `1px solid ${theme.palette.border.subtle}`,
        }),
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        sizeSmall: { height: 32 },
      },
    },
    MuiTable: {
      defaultProps: { size: "small" },
    },
    MuiTableHead: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: theme.palette.background.subtle,
        }),
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: ({ theme }) => ({
          "&:hover": { backgroundColor: theme.palette.background.subtle },
        }),
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: "none", minHeight: 36 },
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
    background: { default: "#F5F7FA", paper: "#FFFFFF", subtle: "#F0F2F5", elevated: "#FFFFFF" },
    text: { primary: "#1A1C21", secondary: "#69707D" },
    border: { subtle: "#E0E4EA", default: "#C5CBD3", strong: "#98A2B3" },
  },
});

export const darkTheme = createTheme({
  ...baseOptions,
  palette: {
    mode: "dark",
    primary: { main: "#36A2EF" },
    secondary: { main: "#7DE2D1" },
    background: { default: "#111217", paper: "#25262E", subtle: "#1A1B22", elevated: "#2D2E36" },
    text: { primary: "#DFE5EF", secondary: "#B0B8C4" },
    border: { subtle: "#3D3F48", default: "#5A5D68", strong: "#7A7E8A" },
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
