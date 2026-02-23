import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

interface FleetStatCardProps {
  title: string;
  value: number | string | null;
  color?: string;
  subtitle?: string;
  onClick?: () => void;
  selected?: boolean;
}

export default function FleetStatCard({
  title,
  value,
  color,
  subtitle,
  onClick,
  selected,
}: FleetStatCardProps) {
  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{
        p: 1.5,
        minWidth: 100,
        flex: 1,
        cursor: onClick ? "pointer" : "default",
        borderColor: selected ? "primary.main" : undefined,
        borderWidth: selected ? 2 : 1,
        "&:hover": onClick ? { bgcolor: "action.hover" } : undefined,
        transition: "border-color 0.2s",
      }}
    >
      <Typography variant="caption" color="text.secondary" noWrap>
        {title}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: color ?? "text.primary" }}>
          {value ?? "—"}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
    </Paper>
  );
}
