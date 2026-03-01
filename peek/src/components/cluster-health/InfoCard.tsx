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
        p: 2,
        flex: 1,
        minWidth: 180,
        borderLeftWidth: severity ? 4 : 1,
        borderLeftColor: borderColor,
      }}
      role="group"
      aria-label={title}
    >
      <Typography variant="subtitle2" color="text.primary" gutterBottom>
        {title}
      </Typography>
      <Typography variant="h5" component="div">
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
