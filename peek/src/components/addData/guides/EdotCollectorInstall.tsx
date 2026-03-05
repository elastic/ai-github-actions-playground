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
import {
  linuxChoiceToContext,
  parseCommandSteps,
  PLATFORM_GUIDES,
} from "../../../utils/addDataUtils";
import type { EndpointType, LinuxInstallChoice, Platform } from "../../../utils/addDataUtils";
import AskAiButton from "../../AskAiButton";

import CompactSegmentedControl from "./CompactSegmentedControl";
import QuickCommandPanel from "./QuickCommandPanel";
import SectionWithOptions from "./SectionWithOptions";
import { CODE_BLOCK_SX } from "./sharedStyles";

const LINUX_INSTALL_OPTIONS: { value: LinuxInstallChoice; label: string }[] = [
  { value: "run_once", label: "Run once" },
  { value: "deb", label: "Install on Debian/Ubuntu (.deb)" },
  { value: "rpm", label: "Install on Red Hat/CentOS (.rpm)" },
];

export interface EdotCollectorInstallProps {
  technologyLabel: string;
  platform: Platform;
  esUrl: string;
  version: string;
  apiKey: string;
  endpointType: EndpointType;
  otlpUrl: string;
  apiKeyValue: string | null;
  prefilledCount: number;
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
  prefilledCount,
}: EdotCollectorInstallProps) {
  const [linuxChoice, setLinuxChoice] = useState<LinuxInstallChoice>("run_once");
  const [commandView, setCommandView] = useState<"quick" | "steps">("quick");
  const [copied, setCopied] = useState(false);
  const scheduleCopyFeedbackReset = useCopyFeedbackTimeout(() => setCopied(false));
  const [stepCopiedIndex, setStepCopiedIndex] = useState<number | null>(null);
  const scheduleStepCopyReset = useCopyFeedbackTimeout(() => setStepCopiedIndex(null));

  const activeGuide = useMemo(() => PLATFORM_GUIDES[platform], [platform]);
  const showRunModeTabs = platform === "linux";

  const commandContext = useMemo(() => {
    const base = { esUrl, version, apiKey, endpointType, otlpUrl };
    if (platform === "linux") {
      const { runMode, linuxPackageFormat } = linuxChoiceToContext(linuxChoice);
      return { ...base, runMode, linuxPackageFormat };
    }
    return base;
  }, [platform, linuxChoice, esUrl, version, apiKey, endpointType, otlpUrl]);

  const fullCommand = useMemo(
    () => activeGuide.command(commandContext),
    [activeGuide, commandContext],
  );
  const commandSteps = useMemo(() => parseCommandSteps(fullCommand), [fullCommand]);

  const handleCopyAll = useCallback(async () => {
    const ok = await copyToClipboard(fullCommand);
    if (!ok) return;
    setCopied(true);
    scheduleCopyFeedbackReset();
  }, [fullCommand, scheduleCopyFeedbackReset]);

  const redactApiKey = useCallback(
    (cmd: string) =>
      apiKeyValue?.length ? cmd.split(apiKeyValue).join("<REDACTED_API_KEY>") : cmd,
    [apiKeyValue],
  );

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
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        Use the options below to copy and run commands for {technologyLabel}.
      </Typography>

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography variant="body2" sx={{ flex: 1, minWidth: 120 }}>
          {activeGuide.label} command guide
        </Typography>
        <CompactSegmentedControl
          value={commandView}
          options={[
            { value: "quick", label: "Quick command" },
            { value: "steps", label: "Step by step" },
          ]}
          onChange={(v) => setCommandView(v)}
        />
        <Button
          size="small"
          variant="outlined"
          href={activeGuide.quickstartUrl}
          target="_blank"
          rel="noopener noreferrer"
          endIcon={<OpenInNewIcon fontSize="small" />}
        >
          Docs
        </Button>
      </Stack>

      <Box>
        {showRunModeTabs ? (
          <SectionWithOptions
            label="Install method"
            options={LINUX_INSTALL_OPTIONS}
            value={linuxChoice}
            onChange={(v) => setLinuxChoice(v)}
          >
            {commandView === "quick" ? (
              <Box sx={{ mt: 1 }}>
                <QuickCommandPanel command={fullCommand} />
              </Box>
            ) : (
              <Stack spacing={1.5} sx={{ mt: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => void handleCopyAll()}
                  sx={{ alignSelf: "flex-end" }}
                >
                  {copied ? "Copied!" : "Copy all steps"}
                </Button>
                {commandSteps.map((step, index) => {
                  const safeCommand = redactApiKey(step.command);
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
                      <Box component="pre" sx={CODE_BLOCK_SX}>
                        {step.command}
                      </Box>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </SectionWithOptions>
        ) : (
          <>
            {commandView === "quick" ? (
              <Box sx={{ mt: 1 }}>
                <QuickCommandPanel command={fullCommand} />
              </Box>
            ) : (
              <Stack spacing={1.5} sx={{ mt: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => void handleCopyAll()}
                  sx={{ alignSelf: "flex-end" }}
                >
                  {copied ? "Copied!" : "Copy all steps"}
                </Button>
                {commandSteps.map((step, index) => {
                  const safeCommand = redactApiKey(step.command);
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
                      <Box component="pre" sx={CODE_BLOCK_SX}>
                        {step.command}
                      </Box>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </>
        )}

        <Alert severity="info" sx={{ mt: 1.5 }}>
          {apiKeyValue
            ? "API key, endpoint, and version are pre-filled. Copy and run the commands to complete setup."
            : `Replace \`<YOUR_API_KEY>\` in the commands with your API key. ${prefilledCount > 1 ? "Endpoint and version are" : "The version is"} pre-filled.`}
        </Alert>
      </Box>
    </Stack>
  );
}
