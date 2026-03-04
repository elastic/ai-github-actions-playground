import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import type { AddDataTechnologyCatalogEntry } from "../../services/addData/catalog";
import { SIGNAL_NAV } from "../../utils/addDataUtils";
import type { AddDataSuccessCta, TelemetrySignal } from "../../utils/addDataUtils";

interface AddDataStepSuccessProps {
  selectedTechnology: AddDataTechnologyCatalogEntry | null;
  foundSignals: Set<TelemetrySignal>;
  selectedSignals: readonly TelemetrySignal[];
  onAddAnotherSource: () => void;
  onBack: () => void;
}

export default function AddDataStepSuccess({
  selectedTechnology,
  foundSignals,
  selectedSignals,
  onAddAnotherSource,
  onBack,
}: AddDataStepSuccessProps) {
  const navigate = useNavigate();

  const hasVerifiedSignals = foundSignals.size > 0;
  const outcomeSignals: TelemetrySignal[] = hasVerifiedSignals
    ? (Array.from(foundSignals).sort() as TelemetrySignal[])
    : Array.from(selectedSignals);

  const outcomeCtas = useMemo(() => {
    const ctas: AddDataSuccessCta[] = [];

    // Prefer technology-specific recommended next steps
    if (
      selectedTechnology?.recommendedNextSteps &&
      selectedTechnology.recommendedNextSteps.length > 0
    ) {
      for (const step of selectedTechnology.recommendedNextSteps) {
        ctas.push({ id: step.id, label: step.label, path: step.path });
      }
    } else {
      // Fallback to generic signal-based CTAs
      for (const signal of outcomeSignals) {
        ctas.push(...SIGNAL_NAV[signal].successCtas);
      }
    }

    // Always include "Add another source" CTA
    ctas.push({ id: "additional_source", label: "Add another source", path: "/add-data" });

    // Deduplicate
    const unique = new Map<string, AddDataSuccessCta>();
    for (const cta of ctas) {
      unique.set(`${cta.id}:${cta.path}`, cta);
    }
    return Array.from(unique.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcomeSignals.join(","), selectedTechnology]);

  const techName = selectedTechnology?.technology ?? "Your source";

  return (
    <Paper variant="outlined" sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: 1.5 }}>
      <Typography variant="h6">
        {hasVerifiedSignals ? "Explore your data + next steps" : "Next steps"}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {hasVerifiedSignals
          ? `${techName} is configured. Choose a next action to explore dashboards, set up alerting, or onboard another source.`
          : `${techName} setup is complete but data has not been verified yet. You can explore your data or go back to verify.`}
      </Typography>
      {outcomeSignals.length > 0 && (
        <Alert severity={hasVerifiedSignals ? "success" : "info"}>
          {hasVerifiedSignals
            ? `Verified signals: ${outcomeSignals.map((signal) => SIGNAL_NAV[signal].label).join(", ")}.`
            : `Expected signals: ${outcomeSignals.map((signal) => SIGNAL_NAV[signal].label).join(", ")}. Run the collector and check back to verify.`}
        </Alert>
      )}
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {outcomeCtas.map((cta, index) => (
          <Button
            key={`${cta.id}:${cta.path}`}
            size="small"
            variant={index === 0 ? "contained" : "outlined"}
            onClick={() => {
              if (cta.id === "additional_source") {
                onAddAnotherSource();
                return;
              }
              navigate(cta.path);
            }}
          >
            {cta.label}
          </Button>
        ))}
      </Stack>
      <Stack direction="row" justifyContent="flex-start">
        <Button variant="outlined" onClick={onBack}>
          Back
        </Button>
      </Stack>
    </Paper>
  );
}
