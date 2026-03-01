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
  | "h3"
  | "h5"
  | "h6"
  | "subtitle1"
  | "subtitle2"
  | "body1"
  | "body2"
  | "caption"
  | "overline";
