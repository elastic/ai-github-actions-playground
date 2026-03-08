import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export interface PageHeaderProps {
  title: string;
  leading?: React.ReactNode;
  titleAdornment?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

export default function PageHeader({
  title,
  leading,
  titleAdornment,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "flex-start" }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          {leading}
          <Typography variant="h5" component="h1">
            {title}
          </Typography>
          {titleAdornment}
        </Box>
        {description && (
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        )}
      </Box>
      {actions && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
          {actions}
        </Box>
      )}
    </Box>
  );
}
