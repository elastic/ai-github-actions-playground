import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import type { SxProps, Theme } from "@mui/material/styles";

import ScrollableLayout from "./ScrollableLayout";

interface DetailSurfaceProps {
  /** Whether the drawer is open. */
  open: boolean;
  /** Called when the drawer should close. */
  onClose: () => void;
  /** Title displayed in the header. Truncated with ellipsis when too long. */
  title: string;
  /** Accessible label for the close button. Defaults to `Close ${title}`. */
  ariaLabel?: string;
  /** Drawer width on md+ screens (px). Defaults to `560`. */
  width?: number;
  /** Scrollable body content. */
  children: React.ReactNode;
  /** Optional footer rendered below the scrollable area. */
  footer?: React.ReactNode;
  /** Extra sx applied to the scrollable body. */
  bodySx?: SxProps<Theme>;
}

export default function DetailSurface({
  open,
  onClose,
  title,
  ariaLabel,
  width = 560,
  children,
  footer,
  bodySx,
}: DetailSurfaceProps) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            boxSizing: "border-box",
            width: { xs: "calc(100vw - 16px)", md: width },
            maxWidth: "100vw",
            display: "flex",
            flexDirection: "column",
            p: 1,
            backgroundColor: "background.default",
          },
        },
      }}
    >
      <Box
        data-testid="detail-surface-mobile-offset"
        sx={(theme) => ({
          ...theme.mixins.toolbar,
          display: { xs: "block", md: "none" },
          flexShrink: 0,
        })}
      />
      <ScrollableLayout
        header={
          <Box
            sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1 }}
          >
            <Typography variant="subtitle1" noWrap sx={{ minWidth: 0, flex: 1 }}>
              {title}
            </Typography>
            <IconButton size="small" aria-label={ariaLabel ?? `Close ${title}`} onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        }
        footer={footer}
        bodySx={bodySx}
      >
        {children}
      </ScrollableLayout>
    </Drawer>
  );
}
