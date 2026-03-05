import { useMemo, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { copyToClipboard } from "../../../utils/copyToClipboard";
import { useCopyFeedbackTimeout } from "../../../hooks/useCopyFeedbackTimeout";
import {
  generateFluentBitConfig,
  generateFluentBitInstallCommand,
} from "../../../services/addData/fluentBitConfig";
import type {
  FluentBitOutputMode,
  ThirdPartyCollectorId,
} from "../../../services/addData/fluentBitConfig";

import { CODE_BLOCK_SX } from "./sharedStyles";

export interface FluentBitInstallProps {
  collectorId: ThirdPartyCollectorId;
  technologyLabel: string;
  outputMode: FluentBitOutputMode;
  esUrl: string;
  otlpUrl: string;
  apiKey: string;
}

export default function FluentBitInstall({
  collectorId,
  technologyLabel,
  outputMode,
  esUrl,
  otlpUrl,
  apiKey,
}: FluentBitInstallProps) {
  const [copiedSection, setCopiedSection] = useState<"config" | "install" | null>(null);
  const scheduleReset = useCopyFeedbackTimeout(() => setCopiedSection(null));

  const config = useMemo(
    () => generateFluentBitConfig({ collectorId, outputMode, esUrl, otlpUrl, apiKey }),
    [collectorId, outputMode, esUrl, otlpUrl, apiKey],
  );

  const installCommand = useMemo(() => generateFluentBitInstallCommand(collectorId), [collectorId]);

  const handleCopy = useCallback(
    async (section: "config" | "install", text: string) => {
      const ok = await copyToClipboard(text);
      if (!ok) return;
      setCopiedSection(section);
      scheduleReset();
    },
    [scheduleReset],
  );

  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        {`Save the generated configuration and install ${technologyLabel} on your host.`}
      </Typography>
      <Box>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>
            {`1. ${technologyLabel} configuration`}
          </Typography>
          <Button size="small" variant="outlined" onClick={() => void handleCopy("config", config)}>
            {copiedSection === "config" ? "Copied!" : "Copy config"}
          </Button>
        </Stack>
        <Box component="pre" sx={CODE_BLOCK_SX}>
          {config}
        </Box>
      </Box>

      <Box>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>
            {`2. Install and start ${technologyLabel}`}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={() => void handleCopy("install", installCommand)}
          >
            {copiedSection === "install" ? "Copied!" : "Copy"}
          </Button>
        </Stack>
        <Box component="pre" sx={CODE_BLOCK_SX}>
          {installCommand}
        </Box>
      </Box>
    </Stack>
  );
}
