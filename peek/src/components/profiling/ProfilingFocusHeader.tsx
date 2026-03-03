import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import SpeedIcon from "@mui/icons-material/Speed";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";

import { PROFILING_DIMENSION_LABELS, type ProfilingFocusDimension } from "./profilingQueryBuilder";

interface ProfilingFocusHeaderProps {
  dimension: ProfilingFocusDimension | null;
  value: string | null;
  onChangeFocus: () => void;
}

export default function ProfilingFocusHeader({
  dimension,
  value,
  onChangeFocus,
}: ProfilingFocusHeaderProps) {
  const dimensionLabel = dimension ? PROFILING_DIMENSION_LABELS[dimension] : null;

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 1,
        justifyContent: "space-between",
        alignItems: "center",
        mb: 2,
      }}
    >
      <Breadcrumbs aria-label="profiling focus breadcrumb">
        <Link
          component="button"
          underline="hover"
          color="inherit"
          variant="body2"
          onClick={onChangeFocus}
          sx={{ display: "flex", gap: 0.5, alignItems: "center" }}
        >
          <SpeedIcon sx={{ fontSize: 14 }} />
          Profiling
        </Link>
        {dimensionLabel && (
          <Link
            component="button"
            underline="hover"
            color="inherit"
            variant="body2"
            onClick={onChangeFocus}
          >
            {dimensionLabel}
          </Link>
        )}
        {value && (
          <Typography variant="body2" color="text.primary" fontWeight={600}>
            {value}
          </Typography>
        )}
      </Breadcrumbs>

      <Button size="small" variant="outlined" startIcon={<SwapHorizIcon />} onClick={onChangeFocus}>
        Change focus
      </Button>
    </Box>
  );
}
