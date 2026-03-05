import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import SearchIcon from "@mui/icons-material/Search";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import { Link as RouterLink } from "react-router-dom";

interface EmptyStateProps {
  icon?: React.ReactNode;
  heading: string;
  description?: string;
  action?: React.ReactNode;
  size?: "small" | "medium";
  verticalAlign?: "center" | "start";
  wrapDescription?: boolean;
  /** When set, renders an "Add data" button pointing to the given href. */
  addDataHref?: string;
}

export default function EmptyState({
  icon,
  heading,
  description,
  action,
  size = "medium",
  verticalAlign = "center",
  wrapDescription = false,
  addDataHref,
}: EmptyStateProps) {
  const iconSize = size === "small" ? 28 : 40;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        justifyContent: verticalAlign === "start" ? "flex-start" : "center",
        alignItems: "center",
        maxWidth: 400,
        height: verticalAlign === "start" ? "auto" : "100%",
        mx: "auto",
        py: verticalAlign === "start" ? (size === "small" ? 1.5 : 2) : size === "small" ? 3 : 6,
        px: 2,
        textAlign: "center",
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: size === "small" ? 44 : 64,
          height: size === "small" ? 44 : 64,
          borderRadius: "50%",
          bgcolor: "background.subtle",
          color: "text.secondary",
        }}
      >
        {icon ?? <SearchIcon sx={{ fontSize: iconSize }} />}
      </Box>
      <Typography variant="h6" component="h2" color="text.primary" fontWeight={700}>
        {heading}
      </Typography>
      {description && (
        <Typography
          variant="body2"
          color="text.secondary"
          noWrap={!wrapDescription}
          sx={{ maxWidth: 320 }}
        >
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 0.5 }}>{action}</Box>}
      {addDataHref && (
        <Button
          component={RouterLink}
          to={addDataHref}
          variant="outlined"
          startIcon={<RocketLaunchIcon sx={{ fontSize: 16 }} />}
          sx={{ mt: 0.5 }}
        >
          Add data
        </Button>
      )}
    </Box>
  );
}
