import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import type { IlmPolicyRow } from "../services/es/ilmTypes";

import DetailSurface from "./DetailSurface";
import EmptyState from "./EmptyState";

const PHASE_COLORS: Record<string, "info" | "success" | "warning" | "error" | "default"> = {
  hot: "error",
  warm: "warning",
  cold: "info",
  frozen: "info",
  delete: "default",
};

const PHASE_ORDER = ["hot", "warm", "cold", "frozen", "delete"] as const;

interface IlmPolicyDetailDrawerProps {
  policy: IlmPolicyRow | null;
  onClose: () => void;
}

export default function IlmPolicyDetailDrawer({ policy, onClose }: IlmPolicyDetailDrawerProps) {
  return (
    <DetailSurface
      open={Boolean(policy)}
      onClose={onClose}
      title={policy?.name ?? "Policy Details"}
      ariaLabel="Close policy details"
      bodySx={{ px: 1, py: 1 }}
    >
      {policy && (
        <>
          <Divider sx={{ mb: 1 }} />
          {/* Version & Modified */}
          <Box sx={{ display: "flex", gap: 3, mb: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                VERSION
              </Typography>
              <Typography variant="body2">{policy.version}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                MODIFIED
              </Typography>
              <Typography variant="body2">{policy.modifiedDate || "\u2014"}</Typography>
            </Box>
          </Box>

          {/* Phase configuration */}
          <Typography variant="subtitle1" gutterBottom>
            Phase Configuration
          </Typography>
          {PHASE_ORDER.map((phaseName) => {
            const phaseDef = policy.raw?.policy?.phases?.[phaseName];
            if (!phaseDef) return null;
            const actions = phaseDef.actions ?? {};
            const actionNames = Object.keys(actions);
            return (
              <Accordion
                key={phaseName}
                defaultExpanded
                disableGutters
                variant="outlined"
                sx={{ mb: 1, "&:before": { display: "none" } }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Chip
                      label={phaseName}
                      size="small"
                      color={PHASE_COLORS[phaseName] ?? "default"}
                      variant="outlined"
                    />
                    {phaseDef.min_age && (
                      <Typography variant="body2" color="text.secondary">
                        min_age: {phaseDef.min_age}
                      </Typography>
                    )}
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  {actionNames.length === 0 ? (
                    <EmptyState size="small" heading="No actions configured" />
                  ) : (
                    actionNames.map((actionName) => (
                      <Box key={actionName} sx={{ mb: 1.5 }}>
                        <Typography variant="body2" fontWeight={600} gutterBottom>
                          {actionName}
                        </Typography>
                        <Paper
                          variant="outlined"
                          sx={{ p: 1, fontSize: "0.75rem", overflow: "auto" }}
                        >
                          <pre
                            style={{
                              margin: 0,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                            }}
                          >
                            {JSON.stringify(actions[actionName], null, 2)}
                          </pre>
                        </Paper>
                      </Box>
                    ))
                  )}
                </AccordionDetails>
              </Accordion>
            );
          })}

          {/* In Use By */}
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" gutterBottom>
            In Use By
          </Typography>
          <InUseBySection label="INDICES" items={policy.raw?.in_use_by?.indices} />
          <InUseBySection label="DATA STREAMS" items={policy.raw?.in_use_by?.data_streams} />
          <InUseBySection
            label="COMPOSABLE TEMPLATES"
            items={policy.raw?.in_use_by?.composable_templates}
          />

          {/* Raw JSON */}
          <Divider sx={{ my: 2 }} />
          <Accordion disableGutters sx={{ "&:before": { display: "none" } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">Raw JSON</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Paper
                variant="outlined"
                sx={{ p: 1, maxHeight: 400, overflow: "auto", fontSize: "0.75rem" }}
              >
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {JSON.stringify(policy.raw ?? policy, null, 2)}
                </pre>
              </Paper>
            </AccordionDetails>
          </Accordion>
        </>
      )}
    </DetailSurface>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function InUseBySection({ label, items }: { label: string; items?: string[] }) {
  const list = items ?? [];
  return (
    <Box sx={{ mb: 1 }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label} ({list.length})
      </Typography>
      {list.length > 0 ? (
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.5 }}>
          {list.map((item) => (
            <Chip
              key={item}
              label={item}
              size="small"
              variant="outlined"
              sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}
            />
          ))}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {"\u2014"}
        </Typography>
      )}
    </Box>
  );
}
