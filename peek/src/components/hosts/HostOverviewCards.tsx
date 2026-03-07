import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import type { HostRow } from "./hostTypes";

interface HostOverviewCardsProps {
  hostRows: HostRow[];
}

interface StatCardProps {
  label: string;
  value: string | number;
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 120 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
        {value}
      </Typography>
    </Paper>
  );
}

export default function HostOverviewCards({ hostRows }: HostOverviewCardsProps) {
  const total = hostRows.length;
  const linux = hostRows.filter((r) => r.osType === "linux").length;
  const windows = hostRows.filter((r) => r.osType === "windows").length;
  const macos = hostRows.filter((r) => r.osType === "macos").length;

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
      <StatCard label="Total Hosts" value={total} />
      <StatCard label="Linux" value={linux} />
      <StatCard label="Windows" value={windows} />
      <StatCard label="macOS" value={macos} />
    </Box>
  );
}
