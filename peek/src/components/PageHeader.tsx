import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

export default function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", flexWrap: "wrap" }}>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="h6" component="h1">
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        )}
      </Box>
      {actions && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          {actions}
        </Box>
      )}
    </Box>
  );
}
