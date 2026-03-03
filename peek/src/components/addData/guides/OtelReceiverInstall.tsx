import { useMemo, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { copyToClipboard } from "../../../utils/copyToClipboard";
import { useCopyFeedbackTimeout } from "../../../hooks/useCopyFeedbackTimeout";
import {
  interpolateReceiverTemplate,
  buildFullOtelConfig,
} from "../../../services/addData/otelReceiverCatalog";
import type { OtelReceiverDefinition } from "../../../services/addData/otelReceiverCatalog";

export interface OtelReceiverInstallProps {
  receiver: OtelReceiverDefinition;
  fieldValues: Record<string, string>;
  esUrl: string;
  apiKey: string;
}

export default function OtelReceiverInstall({
  receiver,
  fieldValues,
  esUrl,
  apiKey,
}: OtelReceiverInstallProps) {
  const [copied, setCopied] = useState(false);
  const scheduleCopyFeedbackReset = useCopyFeedbackTimeout(() => setCopied(false));

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

  const fullConfig = useMemo(
    () =>
      buildFullOtelConfig(receiverBlock, {
        esUrl,
        apiKey,
        signals: receiver.signals,
      }),
    [receiverBlock, esUrl, apiKey, receiver.signals],
  );

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(fullConfig);
    if (!ok) return;
    setCopied(true);
    scheduleCopyFeedbackReset();
  }, [fullConfig, scheduleCopyFeedbackReset]);

  return (
    <>
      <Typography variant="body2" color="text.secondary">
        Save this configuration as <code>otel-collector-config.yaml</code> and start the EDOT
        Collector with <code>--config otel-collector-config.yaml</code>.
      </Typography>

      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>
          Generated OTel Collector configuration
        </Typography>
        <Button size="small" variant="outlined" onClick={() => void handleCopy()}>
          {copied ? "Copied!" : "Copy config"}
        </Button>
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
        {fullConfig}
      </Box>
    </>
  );
}
