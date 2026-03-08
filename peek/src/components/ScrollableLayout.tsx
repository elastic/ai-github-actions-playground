import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

interface ScrollableLayoutProps {
  /** Fixed content rendered above the scrollable area. */
  header?: React.ReactNode;
  /** Fixed content rendered below the scrollable area. */
  footer?: React.ReactNode;
  /** Scrollable main content. */
  children: React.ReactNode;
  /** Gap between flex children (MUI spacing units). */
  gap?: number;
  /** Extra sx applied to the scrollable body. */
  bodySx?: SxProps<Theme>;
  /** Extra sx applied to the outer container. */
  sx?: SxProps<Theme>;
}

export default function ScrollableLayout({
  header,
  footer,
  children,
  gap,
  bodySx,
  sx,
}: ScrollableLayoutProps) {
  return (
    <Box
      sx={[
        { display: "flex", flexDirection: "column", height: "100%", minHeight: 0 },
        ...(gap !== undefined ? [{ gap }] : []),
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {header}
      <Box
        sx={[
          { flex: 1, minHeight: 0, overflow: "auto" },
          ...(Array.isArray(bodySx) ? bodySx : bodySx ? [bodySx] : []),
        ]}
      >
        {children}
      </Box>
      {footer}
    </Box>
  );
}
