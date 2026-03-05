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

const COLLECTOR_OPTIONS = [
  {
    id: "fluent-bit" as const,
    label: "Fluent Bit onboarding",
    description: "Use Fluent Bit forwarding and continue in the dedicated Fluent Bit guide.",
  },
  {
    id: "vector" as const,
    label: "Vector onboarding",
    description: "Use Vector forwarding and continue in the dedicated Vector guide.",
  },
];

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
      {COLLECTOR_OPTIONS.map((opt) => (
        <ButtonBase
          key={opt.id}
          onClick={() => onSwitchToTechnology(opt.id)}
          sx={{ display: "block", borderRadius: 1, textAlign: "left" }}
        >
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {opt.label}
              </Typography>
              <LinkIcon fontSize="inherit" color="action" />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {opt.description}
            </Typography>
          </Paper>
        </ButtonBase>
      ))}
    </ExpandableAlternatives>
  );
}
