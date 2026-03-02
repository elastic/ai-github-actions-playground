import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

export interface OverviewInfoCardProps {
  title: string;
  children: React.ReactNode;
}

export function OverviewInfoCard({ title, children }: OverviewInfoCardProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        height: "100%",
        p: 2,
        bgcolor: "background.subtle",
        borderColor: "border.subtle",
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}
        gutterBottom
        component="div"
      >
        {title}
      </Typography>
      {children}
    </Paper>
  );
}
