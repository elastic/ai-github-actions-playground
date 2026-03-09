import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

export interface ToolbarRowProps {
  children: React.ReactNode;
  sx?: SxProps<Theme>;
}

export default function ToolbarRow({ children, sx }: ToolbarRowProps) {
  return (
    <Box
      sx={[
        { display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {children}
    </Box>
  );
}
