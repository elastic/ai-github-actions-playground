import { createTheme, type ThemeOptions } from "@mui/material/styles";

import { COMPONENT_HEIGHTS } from "./types/tokens";

const MOBILE_OR_COARSE_QUERY = "@media (max-width:767.95px), (pointer: coarse)";

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
          height: COMPONENT_HEIGHTS.button,
          borderRadius: 6,
          [MOBILE_OR_COARSE_QUERY]: {
            height: "auto",
            minHeight: COMPONENT_HEIGHTS.touchTarget,
            paddingTop: 12,
            paddingBottom: 12,
          },
        },
        sizeSmall: {
          height: COMPONENT_HEIGHTS.buttonSmall,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          [MOBILE_OR_COARSE_QUERY]: {
            width: COMPONENT_HEIGHTS.touchTarget,
            height: COMPONENT_HEIGHTS.touchTarget,
            padding: 12,
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          [MOBILE_OR_COARSE_QUERY]: {
            minHeight: COMPONENT_HEIGHTS.touchTarget,
          },
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
        root: {
          "&.MuiInputBase-sizeSmall:not(.MuiInputBase-multiline)": {
            height: COMPONENT_HEIGHTS.input,
            [MOBILE_OR_COARSE_QUERY]: {
              height: "auto",
              minHeight: COMPONENT_HEIGHTS.touchTarget,
            },
          },
        },
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
          "tbody &:hover": { backgroundColor: theme.palette.background.subtle },
        }),
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: "none", minHeight: COMPONENT_HEIGHTS.tab },
      },
    },
    MuiTypography: {
      defaultProps: {
        variantMapping: {
          subtitle1: "p",
          subtitle2: "p",
        },
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
    text: { primary: "#1A1C21", secondary: "#676F7B" },
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
