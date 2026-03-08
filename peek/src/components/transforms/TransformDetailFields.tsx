import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

export function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}
      >
        {title}
      </Typography>
      <Paper variant="outlined" sx={{ p: 1.5, mt: 0.5 }}>
        {children}
      </Paper>
    </Box>
  );
}

export function DetailField({
  label,
  children,
  warn,
}: {
  label: string;
  children: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <Box sx={{ mb: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontFamily: "monospace",
          wordBreak: "break-all",
          ...(warn && { color: "error.main" }),
        }}
      >
        {children}
      </Typography>
    </Box>
  );
}
