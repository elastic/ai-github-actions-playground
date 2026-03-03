import { useCallback, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { copyToClipboard } from "../../../utils/copyToClipboard";
import { useCopyFeedbackTimeout } from "../../../hooks/useCopyFeedbackTimeout";
import { parseCommandSteps, PLATFORM_GUIDES } from "../../../utils/addDataUtils";
import type { EndpointType, Platform } from "../../../utils/addDataUtils";
import AskAiButton from "../../AskAiButton";

export interface EdotCollectorInstallProps {
  technologyLabel: string;
  platform: Platform;
  esUrl: string;
  version: string;
  apiKey: string;
  endpointType: EndpointType;
  otlpUrl: string;
  apiKeyValue: string | null;
  hasEndpoint: boolean;
  prefilledCount: number;
  derivedOtlpUrl: string | null;
  clusterVersion: string | null;
  connectionUrl: string | null;
}

export default function EdotCollectorInstall({
  technologyLabel,
  platform,
  esUrl,
  version,
  apiKey,
  endpointType,
  otlpUrl,
  apiKeyValue,
  hasEndpoint,
  prefilledCount,
  derivedOtlpUrl,
  clusterVersion,
  connectionUrl,
}: EdotCollectorInstallProps) {
  const [copied, setCopied] = useState(false);
  const scheduleCopyFeedbackReset = useCopyFeedbackTimeout(() => setCopied(false));
  const [stepCopiedIndex, setStepCopiedIndex] = useState<number | null>(null);
  const scheduleStepCopyReset = useCopyFeedbackTimeout(() => setStepCopiedIndex(null));

  const activeGuide = useMemo(() => PLATFORM_GUIDES[platform], [platform]);

  const fullCommand = useMemo(
    () => activeGuide.command({ esUrl, version, apiKey, endpointType, otlpUrl }),
    [activeGuide, esUrl, version, apiKey, endpointType, otlpUrl],
  );
  const commandSteps = useMemo(() => parseCommandSteps(fullCommand), [fullCommand]);

  const handleCopyAll = useCallback(async () => {
    const ok = await copyToClipboard(fullCommand);
    if (!ok) return;
    setCopied(true);
    scheduleCopyFeedbackReset();
  }, [fullCommand, scheduleCopyFeedbackReset]);

  const handleCopyStep = useCallback(
    async (index: number) => {
      const step = commandSteps[index];
      if (!step) return;
      const ok = await copyToClipboard(step.command);
      if (!ok) return;
      setStepCopiedIndex(index);
      scheduleStepCopyReset();
    },
    [commandSteps, scheduleStepCopyReset],
  );

  return (
    <>
      <Typography variant="body2" color="text.secondary">
        Use the generated {activeGuide.label} quickstart commands for {technologyLabel}.
      </Typography>

      <Box role="tabpanel">
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" sx={{ flex: 1 }}>
            {activeGuide.label} quickstart
          </Typography>
          <Button size="small" variant="outlined" onClick={() => void handleCopyAll()}>
            {copied ? "Copied!" : "Copy all"}
          </Button>
          <Button
            size="small"
            variant="outlined"
            href={activeGuide.quickstartUrl}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<OpenInNewIcon fontSize="small" />}
          >
            Open official docs
          </Button>
        </Stack>

        <Stack spacing={1.5} sx={{ mt: 1.5 }}>
          {commandSteps.map((step, index) => {
            const safeCommand =
              apiKeyValue && apiKeyValue.length > 0
                ? step.command.split(apiKeyValue).join("<REDACTED_API_KEY>")
                : step.command;
            return (
              <Paper key={index} variant="outlined" sx={{ p: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Chip
                    label={step.number}
                    size="small"
                    color="primary"
                    sx={{ minWidth: 28, fontWeight: 700 }}
                  />
                  <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
                    {step.title}
                  </Typography>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<ContentCopyIcon fontSize="small" />}
                    onClick={() => void handleCopyStep(index)}
                  >
                    {stepCopiedIndex === index ? "Copied!" : "Copy"}
                  </Button>
                  <AskAiButton
                    label="Explain"
                    prompt={`Explain what this onboarding command step does and why it matters.\nStep ${step.number}: ${step.title}\nCommand:\n${safeCommand}`}
                  />
                </Stack>
                <Box
                  component="pre"
                  sx={{
                    overflow: "auto",
                    m: 0,
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: "background.default",
                    wordBreak: "break-all",
                    whiteSpace: "pre-wrap",
                    fontSize: "0.8rem",
                    fontFamily: "monospace",
                  }}
                >
                  {step.command}
                </Box>
              </Paper>
            );
          })}
        </Stack>

        <Alert severity="info" sx={{ mt: 1.5 }}>
          {apiKeyValue
            ? "Your generated API key" + (hasEndpoint || clusterVersion ? ", " : " ")
            : "Generate an API key below (or provide your own) — "}
          {endpointType === "managed_otlp" && derivedOtlpUrl
            ? "OTLP endpoint, "
            : connectionUrl
              ? "Elasticsearch endpoint, "
              : ""}
          {clusterVersion ? `and EDOT Collector v${clusterVersion} ` : ""}
          {apiKeyValue ||
          (endpointType === "managed_otlp" ? Boolean(derivedOtlpUrl) : Boolean(connectionUrl)) ||
          clusterVersion
            ? (prefilledCount > 1 ? "have" : "has") + " been pre-filled in the command above."
            : "Replace the placeholders before running."}
          {!apiKeyValue && (
            <>
              {" "}
              Replace <code>&lt;YOUR_API_KEY&gt;</code> with a generated or existing key.
            </>
          )}
        </Alert>
      </Box>
    </>
  );
}
