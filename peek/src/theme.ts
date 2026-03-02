import { createTheme, type ThemeOptions } from "@mui/material/styles";

import { COMPONENT_HEIGHTS, STATUS_COLORS, type SpaceToken } from "./types/tokens";

const MOBILE_OR_COARSE_QUERY = "@media (max-width:767.95px), (pointer: coarse)";
const MOBILE_ICON_BUTTON_VISUAL_SIZE = 20;
const MOBILE_BUTTON_VERTICAL_PADDING_SPACE: SpaceToken = 1.5;
const MOBILE_ICON_BUTTON_PADDING =
  (COMPONENT_HEIGHTS.touchTarget - MOBILE_ICON_BUTTON_VISUAL_SIZE) / 2;
const LIGHT_PRIMARY = "#0070C5";
const DARK_PRIMARY = "#3BAAFF";
const REDUCED_MOTION_CSS = `
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

const baseOptions: ThemeOptions = {
  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
    h3: { fontSize: "2rem", fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 },
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
  shape: { borderRadius: 8 },
  components: {
    MuiCssBaseline: {
      styleOverrides: REDUCED_MOTION_CSS,
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: ({ theme }) => ({
          textTransform: "none",
          fontWeight: 500,
          height: COMPONENT_HEIGHTS.button,
          borderRadius: 8,
          [MOBILE_OR_COARSE_QUERY]: {
            height: "auto",
            minHeight: COMPONENT_HEIGHTS.touchTarget,
            paddingTop: theme.spacing(MOBILE_BUTTON_VERTICAL_PADDING_SPACE),
            paddingBottom: theme.spacing(MOBILE_BUTTON_VERTICAL_PADDING_SPACE),
          },
        }),
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
            padding: MOBILE_ICON_BUTTON_PADDING,
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

/** Build CssBaseline overrides with a theme-aware CodeMirror focus ring. */
function cssBaselineOverrides(primaryColor: string): string {
  return `
    ${REDUCED_MOTION_CSS}
    .cm-editor.cm-focused {
      outline: 2px solid ${primaryColor};
    }
  `;
}

export const lightTheme = createTheme({
  ...baseOptions,
  palette: {
    mode: "light",
    primary: { main: LIGHT_PRIMARY },
    secondary: { main: "#00B5A9" },
    background: { default: "#F4F6FB", paper: "#FFFFFF", subtle: "#EDF0F7", elevated: "#FFFFFF" },
    text: { primary: "#1A1C21", secondary: "#676F7B" },
    border: { subtle: "#E0E4EA", default: "#C5CBD3", strong: "#98A2B3" },
    status: { ...STATUS_COLORS },
  },
  components: {
    ...baseOptions.components,
    MuiCssBaseline: { styleOverrides: cssBaselineOverrides(LIGHT_PRIMARY) },
  },
});

export const darkTheme = createTheme({
  ...baseOptions,
  palette: {
    mode: "dark",
    primary: { main: DARK_PRIMARY },
    secondary: { main: "#5EECD5" },
    background: { default: "#0F1118", paper: "#1A1D27", subtle: "#141720", elevated: "#242838" },
    text: { primary: "#DFE5EF", secondary: "#98A2B3" },
    border: { subtle: "#2A2E3D", default: "#3D4255", strong: "#5A6070" },
    status: { ...STATUS_COLORS },
  },
  components: {
    ...baseOptions.components,
    MuiCssBaseline: { styleOverrides: cssBaselineOverrides(DARK_PRIMARY) },
  },
});

/** Tooltip background colors for chart themes */
export const CHART_TOOLTIP_BG_DARK = "#242838";
export const CHART_TOOLTIP_BG_LIGHT = "#FFFFFF";

/** Color palette for chart series — 12 vibrant, perceptually balanced hues */
export const CHART_COLORS = [
  "#0077CC",
  "#00BFB3",
  "#E03E36",
  "#F5A623",
  "#7B68EE",
  "#E05A9C",
  "#A86FDB",
  "#2ECC71",
  "#FFD166",
  "#FF7849",
  "#45B7D1",
  "#96CEB4",
];
