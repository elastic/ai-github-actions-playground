import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  ariaLabel?: string;
  width?: number;
  children: React.ReactNode;
}

export default function DetailDrawer({
  open,
  onClose,
  title,
  ariaLabel,
  width = 560,
  children,
}: DetailDrawerProps) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", md: width },
          p: 1,
          backgroundColor: "background.default",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1 }}>
        <Typography variant="subtitle1">{title}</Typography>
        <IconButton
          size="small"
          aria-label={ariaLabel ?? `Close ${title.toLowerCase()}`}
          onClick={onClose}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>{children}</Box>
    </Drawer>
  );
}
