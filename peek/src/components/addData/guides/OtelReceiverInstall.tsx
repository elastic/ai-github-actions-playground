import { useMemo, useState, useCallback } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import { copyToClipboard } from "../../../utils/copyToClipboard";
import { useCopyFeedbackTimeout } from "../../../hooks/useCopyFeedbackTimeout";
import {
  interpolateReceiverTemplate,
  buildFullOtelConfig,
  mergeIntoExistingOtelConfig,
} from "../../../services/addData/otelReceiverCatalog";
import type { OtelReceiverDefinition } from "../../../services/addData/otelReceiverCatalog";

import CompactSegmentedControl from "./CompactSegmentedControl";
import QuickCommandPanel from "./QuickCommandPanel";
import { CODE_BLOCK_SX } from "./sharedStyles";

export interface OtelReceiverInstallProps {
  receiver: OtelReceiverDefinition;
  fieldValues: Record<string, string>;
  esUrl: string;
  apiKey: string;
  existingCollectorConfig: string;
  useExistingConfig: boolean;
}

const RUN_COMMAND = "./elastic-agent otel --config otel-collector-config.yaml";

export default function OtelReceiverInstall({
  receiver,
  fieldValues,
  esUrl,
  apiKey,
  existingCollectorConfig,
  useExistingConfig,
}: OtelReceiverInstallProps) {
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [copiedRun, setCopiedRun] = useState(false);
  const [commandView, setCommandView] = useState<"quick" | "steps">("quick");
  const scheduleCopyConfigReset = useCopyFeedbackTimeout(() => setCopiedConfig(false));
  const scheduleCopyRunReset = useCopyFeedbackTimeout(() => setCopiedRun(false));

  const resolvedValues = useMemo(() => {
    const result: Record<string, string> = {};
    for (const field of receiver.fields) {
      result[field.key] = fieldValues[field.key] ?? field.defaultValue;
    }
    return result;
  }, [receiver.fields, fieldValues]);

  const receiverBlock = useMemo(
    () => interpolateReceiverTemplate(receiver.yamlTemplate, resolvedValues),
    [receiver.yamlTemplate, resolvedValues],
  );

  const { fullConfig, mergeError } = useMemo(() => {
    const buildOpts = {
      receiverType: receiver.receiverType,
      esUrl,
      apiKey,
      signals: receiver.signals,
    };

    if (useExistingConfig && existingCollectorConfig.trim()) {
      try {
        return {
          fullConfig: mergeIntoExistingOtelConfig(
            existingCollectorConfig,
            receiverBlock,
            buildOpts,
          ),
          mergeError: null,
        };
      } catch (err: unknown) {
        return {
          fullConfig: buildFullOtelConfig(receiverBlock, buildOpts),
          mergeError: err instanceof Error ? err.message : "Failed to parse existing config.",
        };
      }
    }

    return {
      fullConfig: buildFullOtelConfig(receiverBlock, buildOpts),
      mergeError: null,
    };
  }, [
    receiverBlock,
    receiver.receiverType,
    esUrl,
    apiKey,
    receiver.signals,
    useExistingConfig,
    existingCollectorConfig,
  ]);

  const handleCopyConfig = useCallback(async () => {
    const ok = await copyToClipboard(fullConfig);
    if (!ok) return;
    setCopiedConfig(true);
    scheduleCopyConfigReset();
  }, [fullConfig, scheduleCopyConfigReset]);

  const handleCopyRun = useCallback(async () => {
    const ok = await copyToClipboard(RUN_COMMAND);
    if (!ok) return;
    setCopiedRun(true);
    scheduleCopyRunReset();
  }, [scheduleCopyRunReset]);
  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        Use the options below to copy and run commands for the {receiver.label} receiver.
      </Typography>

      {/* Step 1: Save config */}
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Chip label="1" size="small" color="primary" sx={{ minWidth: 28, fontWeight: 700 }} />
          <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
            Save the collector configuration
          </Typography>
          <Button
            size="small"
            variant="text"
            startIcon={<ContentCopyIcon fontSize="small" />}
            onClick={() => void handleCopyConfig()}
          >
            {copiedConfig ? "Copied!" : "Copy"}
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          Save this as <code>otel-collector-config.yaml</code>
        </Typography>
        {mergeError && (
          <Alert severity="warning" sx={{ mb: 1 }}>
            Could not merge into existing config: {mergeError}. Showing a standalone config instead.
          </Alert>
        )}
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
          {fullConfig}
        </Box>
      </Paper>

      {commandView === "quick" ? (
        <QuickCommandPanel command={quickCommand} />
      ) : (
        <Stack spacing={1.5}>
          {/* Step 1: Save config */}
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Chip label="1" size="small" color="primary" sx={{ minWidth: 28, fontWeight: 700 }} />
              <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
                Save the collector configuration
              </Typography>
              <Button
                size="small"
                variant="text"
                startIcon={<ContentCopyIcon fontSize="small" />}
                onClick={() => void handleCopyConfig()}
              >
                {copiedConfig ? "Copied!" : "Copy"}
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
              Save this as <code>otel-collector-config.yaml</code>
            </Typography>
            <Box component="pre" sx={CODE_BLOCK_SX}>
              {fullConfig}
            </Box>
          </Paper>

          {/* Step 2: Run the collector */}
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Chip label="2" size="small" color="primary" sx={{ minWidth: 28, fontWeight: 700 }} />
              <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
                Start the EDOT Collector
              </Typography>
              <Button
                size="small"
                variant="text"
                startIcon={<ContentCopyIcon fontSize="small" />}
                onClick={() => void handleCopyRun()}
              >
                {copiedRun ? "Copied!" : "Copy"}
              </Button>
            </Stack>
            <Box component="pre" sx={CODE_BLOCK_SX}>
              {RUN_COMMAND}
            </Box>
          </Paper>
        </Stack>
      )}

      <Button
        size="small"
        variant="outlined"
        href="https://www.elastic.co/docs/solutions/observability/get-started/opentelemetry"
        target="_blank"
        rel="noopener noreferrer"
        endIcon={<OpenInNewIcon fontSize="small" />}
        sx={{ alignSelf: "flex-start" }}
      >
        {receiver.label} receiver docs
      </Button>
    </Stack>
  );
}
