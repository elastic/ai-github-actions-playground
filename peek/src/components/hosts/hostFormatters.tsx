import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

export function fmtPct(value: number | null): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

export function fmtCount(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString();
}

export function fmtTimestamp(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

interface MetricCardProps {
  label: string;
  value: string;
}

export function MetricCard({ label, value }: MetricCardProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 140 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
        {value}
      </Typography>
    </Paper>
  );
}
