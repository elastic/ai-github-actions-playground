import ButtonBase from "@mui/material/ButtonBase";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

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
        borderColor: "border.subtle",
        bgcolor: "background.subtle",
        textAlign: "left",
        ...(onClick && {
          cursor: "pointer",
          transition: "border-color 0.15s",
          "&:hover": { borderColor: "primary.main" },
        }),
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}
          gutterBottom
          component="div"
        >
          {title}
        </Typography>
        {onClick && (
          <OpenInNewIcon
            aria-hidden="true"
            sx={{ flexShrink: 0, mb: 0.5, color: "text.secondary", fontSize: 14 }}
          />
        )}
      </Box>
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
