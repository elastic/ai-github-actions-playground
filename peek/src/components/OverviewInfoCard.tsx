import ButtonBase from "@mui/material/ButtonBase";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

export interface OverviewInfoCardProps {
  title: string;
  children: React.ReactNode;
  /** When provided the entire card becomes a clickable drill-down link. */
  onClick?: () => void;
}

export function OverviewInfoCard({ title, children, onClick }: OverviewInfoCardProps) {
  const paper = (
    <Paper
      variant="outlined"
      sx={{
        height: "100%",
        p: 2,
        textAlign: "left",
        ...(onClick && {
          cursor: "pointer",
          transition: "border-color 0.15s",
          "&:hover": { borderColor: "primary.main" },
        }),
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600 }}
        gutterBottom
        component="div"
      >
        {title}
      </Typography>
      {children}
    </Paper>
  );

  if (!onClick) return paper;

  return (
    <ButtonBase
      component="div"
      onClick={onClick}
      aria-label={`View ${title}`}
      sx={{ display: "block", width: "100%", textAlign: "left" }}
    >
      {paper}
    </ButtonBase>
  );
}
