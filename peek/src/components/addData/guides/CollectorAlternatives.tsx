import ButtonBase from "@mui/material/ButtonBase";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LinkIcon from "@mui/icons-material/Link";

import ExpandableAlternatives from "./ExpandableAlternatives";

interface CollectorAlternativesProps {
  idPrefix: string;
  onSwitchToTechnology?: (technologyId: "fluent-bit" | "vector") => void;
}

export default function CollectorAlternatives({
  idPrefix,
  onSwitchToTechnology,
}: CollectorAlternativesProps) {
  if (!onSwitchToTechnology) return null;

  return (
    <ExpandableAlternatives
      idPrefix={`${idPrefix}-collectors`}
      label="Other collector options"
      expandedLabel="Hide other collector options"
    >
      <ButtonBase
        onClick={() => onSwitchToTechnology("fluent-bit")}
        sx={{ display: "block", borderRadius: 1, textAlign: "left" }}
      >
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Fluent Bit onboarding
            </Typography>
            <LinkIcon fontSize="inherit" color="action" />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Use Fluent Bit forwarding and continue in the dedicated Fluent Bit guide.
          </Typography>
        </Paper>
      </ButtonBase>
      <ButtonBase
        onClick={() => onSwitchToTechnology("vector")}
        sx={{ display: "block", borderRadius: 1, textAlign: "left" }}
      >
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Vector onboarding
            </Typography>
            <LinkIcon fontSize="inherit" color="action" />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Use Vector forwarding and continue in the dedicated Vector guide.
          </Typography>
        </Paper>
      </ButtonBase>
    </ExpandableAlternatives>
  );
}
