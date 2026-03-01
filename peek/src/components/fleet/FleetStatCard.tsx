import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";

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
  const theme = useTheme();
  const content = (
    <>
      <Typography variant="caption" color="text.primary" noWrap>
        {title}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5 }}>
        <Typography
          variant="h5"
          component="div"
          sx={{ fontWeight: 600, color: color ?? "text.primary" }}
        >
          {value ?? "—"}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
    </>
  );

  const paperSx = {
    p: 1.5,
    minWidth: 100,
    flex: 1,
    borderColor: selected ? "primary.main" : undefined,
    borderWidth: selected ? 2 : 1,
    transition: "border-color 0.2s",
  };

  if (onClick) {
    return (
      <Paper variant="outlined" sx={paperSx}>
        <ButtonBase
          onClick={onClick}
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            width: "100%",
            textAlign: "left",
            "&:hover": { bgcolor: "action.hover" },
            "&.Mui-focusVisible": {
              boxShadow: `0 0 0 2px ${theme.palette.primary.main}`,
            },
          }}
        >
          {content}
        </ButtonBase>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={paperSx}>
      {content}
    </Paper>
  );
}
