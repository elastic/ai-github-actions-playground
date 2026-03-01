import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import SearchIcon from "@mui/icons-material/Search";

interface EmptyStateProps {
  icon?: React.ReactNode;
  heading: string;
  description?: string;
}

export default function EmptyState({ icon, heading, description }: EmptyStateProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        py: 6,
        px: 2,
        gap: 1,
        height: "100%",
      }}
    >
      {icon ?? <SearchIcon sx={{ fontSize: 48, color: "text.secondary", mb: 0.5 }} />}
      <Typography variant="subtitle1" color="text.primary" sx={{ fontWeight: 600 }}>
        {heading}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      )}
    </Box>
  );
}
