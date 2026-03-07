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

export function fmtLoadAvg(value: number | null): string {
  if (value == null) return "—";
  return value.toFixed(2);
}

export function fmtBytesRate(value: number | null): string {
  if (value == null) return "—";
  if (value < 1024) return `${value.toFixed(1)} B/s`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB/s`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)} MB/s`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB/s`;
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
