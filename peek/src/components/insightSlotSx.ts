/** Severity-keyed glow colors (subtle, non-disruptive). */
const glowColor: Record<string, string> = {
  info: "rgba(33,150,243,0.18)",
  warning: "rgba(255,152,0,0.22)",
  critical: "rgba(244,67,54,0.22)",
};

/** Return a box-shadow glow for the given severity. */
export function severityGlow(severity: string): string {
  const color = glowColor[severity] ?? glowColor.info;
  return `0 0 0 2px ${color}`;
}

/** Map insight severity to a MUI palette colour channel. */
export function severityColor(severity: string): string {
  switch (severity) {
    case "critical":
      return "error.main";
    case "warning":
      return "warning.main";
    default:
      return "info.main";
  }
}

/** Pulse animation for the indicator dot (respects prefers-reduced-motion). */
export const pulseSx = {
  "@keyframes insightPulse": {
    "0%": { transform: "scale(1)", opacity: 1 },
    "50%": { transform: "scale(1.6)", opacity: 0.5 },
    "100%": { transform: "scale(1)", opacity: 1 },
  },
  animation: "insightPulse 2s ease-in-out infinite",
  "@media (prefers-reduced-motion: reduce)": {
    animation: "none",
  },
} as const;

/** sx for markdown rendered inside the insight popover. */
export const popoverMarkdownSx = {
  "& p": { mt: 0, mb: 1 },
  "& p:last-child": { mb: 0 },
  "& ul,& ol": { mb: 1, pl: 2.5 },
  "& li": { mb: 0.5 },
  "& h1,& h2,& h3,& h4,& h5,& h6": { mt: 1, mb: 0.5 },
  "& code": {
    px: 0.5,
    borderRadius: 0.5,
    bgcolor: "action.selected",
    fontSize: "0.85em",
    fontFamily: "monospace",
  },
  "& pre": {
    overflow: "auto",
    p: 1,
    borderRadius: 1,
    bgcolor: "action.selected",
    "& code": { p: 0, bgcolor: "transparent" },
  },
} as const;
