import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";

export type InfoCardSeverity = "success" | "warning" | "error";

interface InfoCardProps {
  title: string;
  value: string;
  detail?: string;
  severity?: InfoCardSeverity;
}

export default function InfoCard({ title, value, detail, severity }: InfoCardProps) {
  const theme = useTheme();
  const borderColor = severity ? theme.palette[severity].main : undefined;

  return (
    <Paper
      variant="outlined"
      sx={{
        flex: 1,
        minWidth: 180,
        p: 2,
        borderLeftWidth: severity ? 4 : 1,
        borderLeftColor: borderColor,
      }}
      role="group"
      aria-label={title}
    >
      <Typography variant="overline" color="text.secondary" gutterBottom component="div">
        {title}
      </Typography>
      <Typography variant="h5" component="div" sx={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Typography>
      {detail ? (
        <Typography variant="body2" color="text.secondary">
          {detail}
        </Typography>
      ) : null}
    </Paper>
  );
}
