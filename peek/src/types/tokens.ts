/**
 * Design-token literal types.
 *
 * These union types encode the approved design language so that invalid values
 * fail at compile time rather than landing in code review.
 */

/** Semantic status colors used across cards, badges, and indicators. */
export type StatusColor = "healthy" | "warning" | "critical" | "unknown" | "info";

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
  /** Minimum touch-target size for mobile / coarse pointer (44 px). */
  touchTarget: 44,
} as const;
