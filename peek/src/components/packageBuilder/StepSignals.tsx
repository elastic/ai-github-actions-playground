import { useMemo } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";

import { usePackageBuilderStore } from "../../store/usePackageBuilderStore";
import type { InsightSlotDefinition } from "../../types/insightSlots";
import { usePageSlotInsights } from "../../hooks/usePageSlotInsights";
import { InsightSlotProvider } from "../InsightSlotContext";
import InsightSlot from "../InsightSlot";
import type { SignalType } from "../../types/packageBuilder";

const ALL_SIGNAL_TYPES: SignalType[] = ["metrics", "logs", "traces", "synthetics", "profiles"];

const POLICY_SLOTS: readonly InsightSlotDefinition[] = [
  { slotId: "policy-name", label: "Policy template name field" },
  { slotId: "policy-title", label: "Policy template title field" },
  { slotId: "policy-description", label: "Policy template description field" },
  { slotId: "policy-signals", label: "Signal types and dynamic toggle" },
];

const POLICY_SYSTEM_PROMPT = `You are reviewing form fields for an Elastic OTel input package policy template.
Each field is a slot you can annotate with a brief suggestion.

**Elastic OTel Input Package Policy Template Rules:**
- **name** (policy-name): The OTel Collector receiver name, lowercase, no spaces/hyphens. Examples: "redisreceiver", "apachereceiver", "mysqlreceiver", "hostmetricsreceiver". If the package is named "redis", this should be "redisreceiver". Maps to the actual OTel Collector receiver component.
- **title** (policy-title): Pattern: "{Technology} {Signal Types} (OpenTelemetry)" — e.g. "Redis Metrics (OpenTelemetry)". Should reflect the selected signal types.
- **description** (policy-description): One sentence: "Collect {Technology} {signal type} using OpenTelemetry Collector".
- **signal types** (policy-signals): Which telemetry signals this handles. Most OTel receiver packages are "metrics" only. Some also produce "logs" or "traces". Choose based on what the OTel receiver actually emits.
- **dynamic signal types** (policy-signals): Available with format_version 3.6.0. When enabled alongside signal types, Fleet can enable additional signal types beyond the primary type. Both type and dynamic_signal_types coexist in the manifest.

Only annotate fields that are empty, have wrong values, or could be improved. Skip fields that are correct.`;

export default function StepSignals() {
  const pt = usePackageBuilderStore((s) => s.policyTemplate);
  const identity = usePackageBuilderStore((s) => s.identity);
  const formatVersion = identity.formatVersion;
  const setPolicyTemplate = usePackageBuilderStore((s) => s.setPolicyTemplate);

  const canUseDynamic = formatVersion === "3.6.0";

  const handleToggleSignal = (signal: SignalType) => {
    const current = pt.signalTypes;
    if (current.includes(signal)) {
      if (current.length > 1) {
        setPolicyTemplate({ signalTypes: current.filter((s) => s !== signal) });
      }
    } else {
      setPolicyTemplate({ signalTypes: [...current, signal] });
    }
  };

  const insightContext = useMemo(() => {
    if (!identity.name) return "";
    return `Package name: "${identity.name}"
Package title: "${identity.title}"
Package description: "${identity.description}"
Policy template name: "${pt.name}"
Policy template title: "${pt.title}"
Policy template description: "${pt.description}"
Signal types: ${JSON.stringify(pt.signalTypes)}
Dynamic signal types: ${pt.dynamicSignalTypes}
Format version: "${formatVersion}"`;
  }, [identity, pt, formatVersion]);

  const { insights, loading, error, refresh } = usePageSlotInsights({
    context: insightContext,
    systemPrompt: POLICY_SYSTEM_PROMPT,
    cacheKey: `pkg-policy-slots::${insightContext.length}::${insightContext.slice(0, 100)}`,
    slots: POLICY_SLOTS,
    enabled: Boolean(identity.name),
  });

  return (
    <InsightSlotProvider
      summary={null}
      insights={insights}
      loading={loading}
      error={error}
      refresh={refresh}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, maxWidth: 700 }}>
        <Typography variant="h6">Policy Template &amp; Signals</Typography>

        <InsightSlot slotId="policy-name">
          <TextField
            label="Policy template name"
            value={pt.name}
            onChange={(e) =>
              setPolicyTemplate({ name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })
            }
            helperText="Identifier, e.g. redisreceiver"
            fullWidth
            size="small"
          />
        </InsightSlot>

        <InsightSlot slotId="policy-title">
          <TextField
            label="Title"
            value={pt.title}
            onChange={(e) => setPolicyTemplate({ title: e.target.value })}
            placeholder="e.g. Redis Metrics (OpenTelemetry)"
            fullWidth
            size="small"
          />
        </InsightSlot>

        <InsightSlot slotId="policy-description">
          <TextField
            label="Description"
            value={pt.description}
            onChange={(e) => setPolicyTemplate({ description: e.target.value })}
            multiline
            rows={2}
            fullWidth
            size="small"
          />
        </InsightSlot>

        <Box>
          <TextField
            label="Input type"
            value="otelcol"
            disabled
            size="small"
            sx={{ width: 200 }}
            helperText="OTel input packages always use otelcol"
          />
        </Box>

        <InsightSlot slotId="policy-signals">
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }} gutterBottom>
              Signal types
            </Typography>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {ALL_SIGNAL_TYPES.map((signal) => (
                <Chip
                  key={signal}
                  label={signal}
                  color={pt.signalTypes.includes(signal) ? "primary" : "default"}
                  variant={pt.signalTypes.includes(signal) ? "filled" : "outlined"}
                  onClick={() => handleToggleSignal(signal)}
                />
              ))}
              {canUseDynamic && (
                <Chip
                  label="+ dynamic"
                  color={pt.dynamicSignalTypes ? "secondary" : "default"}
                  variant={pt.dynamicSignalTypes ? "filled" : "outlined"}
                  onClick={() => setPolicyTemplate({ dynamicSignalTypes: !pt.dynamicSignalTypes })}
                />
              )}
            </Box>
            {pt.dynamicSignalTypes && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                Dynamic: Fleet can enable additional signal types from this receiver beyond the
                primary type.
              </Typography>
            )}
          </Box>
        </InsightSlot>
      </Box>
    </InsightSlotProvider>
  );
}
