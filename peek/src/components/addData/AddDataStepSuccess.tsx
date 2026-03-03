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

  const outcomeSignals: TelemetrySignal[] =
    foundSignals.size > 0
      ? (Array.from(foundSignals).sort() as TelemetrySignal[])
      : Array.from(selectedSignals);
  const outcomeSignalsKey = outcomeSignals.join(",");

  const outcomeCtas = useMemo(() => {
    const ctas: AddDataSuccessCta[] = [];
    for (const signal of outcomeSignals) {
      ctas.push(...SIGNAL_NAV[signal].successCtas);
    }
    if (ctas.length === 0) {
      ctas.push({ id: "additional_source", label: "Add another source", path: "/add-data" });
    }
    const unique = new Map<string, AddDataSuccessCta>();
    for (const cta of ctas) {
      unique.set(`${cta.id}:${cta.path}`, cta);
    }
    return Array.from(unique.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcomeSignalsKey]);

  return (
    <Paper variant="outlined" sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: 1.5 }}>
      <Typography variant="h6">Explore your data + next steps</Typography>
      <Typography variant="body2" color="text.secondary">
        {selectedTechnology?.technology ?? "Your source"} is configured. Choose a next action to
        explore dashboards, set up alerting, or onboard another source.
      </Typography>
      {outcomeSignals.length > 0 && (
        <Alert severity="success">
          Ready signals: {outcomeSignals.map((signal) => SIGNAL_NAV[signal].label).join(", ")}.
        </Alert>
      )}
      <Stack direction="row" spacing={1} flexWrap="wrap">
        {outcomeCtas.map((cta) => (
          <Button
            key={`${cta.id}:${cta.path}`}
            size="small"
            variant={cta.id === "signal" ? "contained" : "outlined"}
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
