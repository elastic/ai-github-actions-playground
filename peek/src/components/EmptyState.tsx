import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import SearchIcon from "@mui/icons-material/Search";

interface EmptyStateProps {
  icon?: React.ReactNode;
  heading: string;
  description?: string;
  action?: React.ReactNode;
  size?: "small" | "medium";
}

export default function EmptyState({
  icon,
  heading,
  description,
  action,
  size = "medium",
}: EmptyStateProps) {
  const iconSize = size === "small" ? 28 : 40;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        py: size === "small" ? 3 : 6,
        px: 2,
        gap: 1,
        height: "100%",
        maxWidth: 400,
        mx: "auto",
        textAlign: "center",
      }}
    >
      <Box
        sx={{
          width: size === "small" ? 44 : 56,
          height: size === "small" ? 44 : 56,
          borderRadius: "50%",
          bgcolor: "background.subtle",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
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
    </Box>
  );
}
