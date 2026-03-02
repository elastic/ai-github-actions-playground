/**
 * Design-token literal types.
 *
 * These union types encode the approved design language so that invalid values
 * fail at compile time rather than landing in code review.
 */

/** Semantic status colors used across cards, badges, and indicators. */
export type StatusColor = "healthy" | "warning" | "critical" | "unknown" | "info";

/**
 * Canonical status color hex values — single source of truth.
 * Use these for contexts outside React (e.g. ECharts configs) where
 * `theme.palette.status.*` is not available.
 */
export const STATUS_COLORS = {
  success: "#36B37E",
  warning: "#FFAB00",
  error: "#DE350B",
  info: "#0065FF",
  unknown: "#6B778C",
  inProgress: "#00B8D9",
} as const;

/** Heatmap gradient stops from deep blue through teal/yellow to red. */
export const HEATMAP_GRADIENT = [
  "#0A1A3F",
  "#0077CC",
  "#00BFB3",
  "#FFE27A",
  "#F5A623",
  "#E03E36",
] as const;

/** Approved MUI spacing multipliers. Maps to `theme.spacing(n)`. */
export type SpaceToken = 0 | 0.5 | 1 | 1.5 | 2 | 2.5 | 3 | 4 | 6;

/**
 * Approved Typography variants from the design-language type scale.
 * Components should restrict their `variant` prop to this set.
 */
export type TypographyVariant =
  | "h5"
  | "h6"
  | "subtitle1"
  | "subtitle2"
  | "body1"
  | "body2"
  | "caption"
  | "overline";

/** Metric-only typography variants (stat values, KPI cards). */
export type MetricTypographyVariant = "h3";

/**
 * Component height constants from DESIGN_LANGUAGE.md § Component Heights.
 * All values are in pixels. Use these instead of hardcoded numbers.
 */
export const COMPONENT_HEIGHTS = {
  /** Default button height (36 px). */
  button: 36,
  /** Small button height (28 px). */
  buttonSmall: 28,
  /** Text input and select control height (36 px). */
  input: 36,
  /** Table row height (36 px). */
  tableRow: 36,
  /** Sidebar navigation item height (32 px). */
  sidebarNavItem: 32,
  /** Toolbar row height including vertical padding (44 px). */
  toolbarRow: 44,
  /** Tab control height (36 px). */
  tab: 36,
  /** Minimum touch-target size for mobile / coarse pointer (44 px). */
  touchTarget: 44,
} as const;

/**
 * Shared sx for compact (small) Chip instances.
 * Use when a Chip needs a reduced height and smaller font.
 */
export const COMPACT_CHIP_SX = { height: 20, fontSize: "0.7rem" } as const;
