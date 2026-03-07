import { createTheme, type ThemeOptions } from "@mui/material/styles";

import {
  COMPONENT_HEIGHTS,
  MOBILE_OR_COARSE_QUERY,
  STATUS_COLORS,
  type SpaceToken,
} from "./types/tokens";
const MOBILE_ICON_BUTTON_VISUAL_SIZE = 20;
const MOBILE_BUTTON_VERTICAL_PADDING_SPACE: SpaceToken = 1.5;
const MOBILE_ICON_BUTTON_PADDING =
  (COMPONENT_HEIGHTS.touchTarget - MOBILE_ICON_BUTTON_VISUAL_SIZE) / 2;
const LIGHT_PRIMARY = "#0070C5";
const DARK_PRIMARY = "#3BAAFF";
const LIGHT_TEXT = { primary: "#1A1C21", secondary: "#676F7B" };
const DARK_TEXT = { primary: "#DFE5EF", secondary: "#AEB6C1" };
const LIGHT_BORDER = { subtle: "#E0E4EA", default: "#C5CBD3", strong: "#98A2B3" };
const DARK_BORDER = { subtle: "#2A2E3D", default: "#3D4255", strong: "#5A6070" };
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
          transition: "background-color 150ms ease",
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
          "tbody &": {
            transition: "background-color 150ms ease",
          },
          "tbody &:hover": { backgroundColor: theme.palette.background.subtle },
        }),
      },
    },
    MuiChip: {
      styleOverrides: {
        labelSmall: { paddingLeft: 4, paddingRight: 4 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          minHeight: COMPONENT_HEIGHTS.tab,
          [MOBILE_OR_COARSE_QUERY]: {
            minHeight: COMPONENT_HEIGHTS.touchTarget,
          },
        },
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

interface ScrollbarColors {
  thumb: string;
  thumbHover: string;
  track: string;
}

const LIGHT_SCROLLBAR: ScrollbarColors = {
  thumb: LIGHT_TEXT.secondary,
  thumbHover: LIGHT_TEXT.primary,
  track: "transparent",
};

const DARK_SCROLLBAR: ScrollbarColors = {
  thumb: DARK_TEXT.secondary,
  thumbHover: DARK_TEXT.primary,
  track: "transparent",
};

interface CodeMirrorGutterColors {
  background: string;
  text: string;
  border: string;
}

/** Build CssBaseline overrides with theme-aware scrollbars and CodeMirror focus ring. */
function cssBaselineOverrides(
  primaryColor: string,
  scrollbar: ScrollbarColors,
  gutter: CodeMirrorGutterColors,
): string {
  return `
    ${REDUCED_MOTION_CSS}
    .cm-editor.cm-focused {
      outline: 2px solid ${primaryColor};
    }
    .cm-editor .cm-gutters {
      background-color: ${gutter.background};
      color: ${gutter.text};
      border-right: 1px solid ${gutter.border};
    }

    /* Firefox */
    * {
      scrollbar-width: thin;
      scrollbar-color: ${scrollbar.thumb} ${scrollbar.track};
    }

    /* Webkit (Chrome, Edge, Safari) */
    *::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    *::-webkit-scrollbar-track {
      background: ${scrollbar.track};
    }
    *::-webkit-scrollbar-thumb {
      background: ${scrollbar.thumb};
      border-radius: 3px;
    }
    *::-webkit-scrollbar-thumb:hover {
      background: ${scrollbar.thumbHover};
    }
    *::-webkit-scrollbar-corner {
      background: ${scrollbar.track};
    }

    @media (forced-colors: active) {
      * {
        scrollbar-width: auto;
        scrollbar-color: auto;
      }
      *::-webkit-scrollbar {
        width: auto;
        height: auto;
      }
      *::-webkit-scrollbar-track,
      *::-webkit-scrollbar-thumb,
      *::-webkit-scrollbar-thumb:hover,
      *::-webkit-scrollbar-corner {
        background: initial;
      }
      *::-webkit-scrollbar-thumb {
        border-radius: 0;
      }
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
    text: LIGHT_TEXT,
    border: LIGHT_BORDER,
    status: { ...STATUS_COLORS },
  },
  components: {
    ...baseOptions.components,
    MuiCssBaseline: {
      styleOverrides: cssBaselineOverrides(LIGHT_PRIMARY, LIGHT_SCROLLBAR, {
        background: "#EDF0F7",
        text: LIGHT_TEXT.secondary,
        border: LIGHT_BORDER.subtle,
      }),
    },
  },
});

export const darkTheme = createTheme({
  ...baseOptions,
  palette: {
    mode: "dark",
    primary: { main: DARK_PRIMARY },
    secondary: { main: "#5EECD5" },
    background: { default: "#0F1118", paper: "#1A1D27", subtle: "#141720", elevated: "#242838" },
    text: DARK_TEXT,
    border: DARK_BORDER,
    status: { ...STATUS_COLORS },
  },
  components: {
    ...baseOptions.components,
    MuiCssBaseline: {
      styleOverrides: cssBaselineOverrides(DARK_PRIMARY, DARK_SCROLLBAR, {
        background: "#1A1D27",
        text: DARK_TEXT.secondary,
        border: DARK_BORDER.subtle,
      }),
    },
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
