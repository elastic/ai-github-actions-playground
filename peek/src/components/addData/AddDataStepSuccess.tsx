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

  // Only count signals that are both detected AND expected for this technology.
  // This prevents false positives — e.g. pre-existing logs data streams should
  // not appear as "verified" for an APM agent that only expects traces + metrics.
  const relevantFoundSignals = new Set(
    Array.from(foundSignals).filter((s) => selectedSignals.includes(s)),
  );
  const hasVerifiedSignals = relevantFoundSignals.size > 0;
  const outcomeSignals: TelemetrySignal[] = hasVerifiedSignals
    ? (Array.from(relevantFoundSignals).sort() as TelemetrySignal[])
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
      <Typography variant="h6">{hasVerifiedSignals ? "You're all set" : "Next steps"}</Typography>
      <Typography variant="body2" color="text.secondary">
        {hasVerifiedSignals
          ? `Data is flowing from ${techName}. Explore dashboards, set up alerting, or add another source.`
          : `${techName} setup is complete, but data is not verified yet. Start your collector, then verify or explore now.`}
      </Typography>
      {outcomeSignals.length > 0 && (
        <Alert
          severity={hasVerifiedSignals ? "success" : "info"}
          action={
            !hasVerifiedSignals ? (
              <Button color="inherit" size="small" onClick={onBack}>
                Verify now
              </Button>
            ) : undefined
          }
        >
          {hasVerifiedSignals
            ? `Verified signals: ${outcomeSignals.map((signal) => SIGNAL_NAV[signal].label).join(", ")}.`
            : `Expected signals: ${outcomeSignals.map((signal) => SIGNAL_NAV[signal].label).join(", ")}. Run your collector and verify again.`}
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
