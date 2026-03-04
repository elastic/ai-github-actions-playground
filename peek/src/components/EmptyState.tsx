import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
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
  /** When set, renders a subtle "Add data" link pointing to the given href. */
  addDataHref?: string;
}

export default function EmptyState({
  icon,
  heading,
  description,
  action,
  size = "medium",
  verticalAlign = "center",
  addDataHref,
}: EmptyStateProps) {
  const iconSize = size === "small" ? 28 : 40;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1,
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
          width: size === "small" ? 44 : 56,
          height: size === "small" ? 44 : 56,
          borderRadius: "50%",
          bgcolor: "background.subtle",
          color: "text.secondary",
        }}
      >
        {icon ?? <SearchIcon sx={{ fontSize: iconSize }} />}
      </Box>
      <Typography variant="subtitle1" color="text.primary" sx={{ fontWeight: 600 }}>
        {heading}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
      {addDataHref && (
        <Link
          component={RouterLink}
          to={addDataHref}
          underline="hover"
          variant="body2"
          color="text.secondary"
          sx={{ display: "inline-flex", gap: 0.5, alignItems: "center", mt: 1 }}
        >
          <RocketLaunchIcon sx={{ fontSize: 16 }} />
          Add data
        </Link>
      )}
    </Box>
  );
}
