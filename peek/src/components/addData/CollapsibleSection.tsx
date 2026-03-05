import { type ReactNode } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Collapse from "@mui/material/Collapse";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  expanded: boolean;
  onToggle: () => void;
  /** Optional leading icon in header (left side, before title). */
  leading?: ReactNode;
  /** Show a green checkmark to indicate the section is "done". */
  completed?: boolean;
  /** Optional trailing element in the header (e.g. a status indicator). */
  trailing?: ReactNode;
  children: ReactNode;
}

export default function CollapsibleSection({
  title,
  subtitle,
  expanded,
  onToggle,
  leading,
  completed,
  trailing,
  children,
}: CollapsibleSectionProps) {
  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <ButtonBase
        onClick={onToggle}
        sx={{
          display: "flex",
          gap: 1,
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          p: 1.5,
          textAlign: "left",
        }}
      >
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", minWidth: 0 }}>
          {leading}
          {completed && <CheckCircleIcon color="success" fontSize="small" />}
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ display: "flex", flexShrink: 0, gap: 1, alignItems: "center" }}>
          {trailing}
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </Box>
      </ButtonBase>
      <Collapse in={expanded} unmountOnExit={false}>
        <Box sx={{ pb: 1.5, px: 1.5 }}>{children}</Box>
      </Collapse>
    </Paper>
  );
}
