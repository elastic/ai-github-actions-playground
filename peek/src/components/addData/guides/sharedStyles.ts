import type { SxProps, Theme } from "@mui/material/styles";

export const CODE_BLOCK_SX: SxProps<Theme> = {
  overflow: "auto",
  m: 0,
  p: 1.5,
  borderRadius: 1,
  bgcolor: "background.default",
  wordBreak: "break-all",
  whiteSpace: "pre-wrap",
  fontSize: "0.8rem",
  fontFamily: "monospace",
} as const;

export const PULSE_KEYFRAMES = {
  "@keyframes pulse": {
    "0%, 100%": { opacity: 1 },
    "50%": { opacity: 0.3 },
  },
} as const;
