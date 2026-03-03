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
import type { FluentBitOutputMode } from "../../../services/addData/fluentBitConfig";

export interface FluentBitInstallProps {
  outputMode: FluentBitOutputMode;
  esUrl: string;
  apiKey: string;
}

export default function FluentBitInstall({ outputMode, esUrl, apiKey }: FluentBitInstallProps) {
  const [copiedSection, setCopiedSection] = useState<"config" | "install" | null>(null);
  const scheduleReset = useCopyFeedbackTimeout(() => setCopiedSection(null));

  const config = useMemo(
    () => generateFluentBitConfig({ outputMode, esUrl, apiKey }),
    [outputMode, esUrl, apiKey],
  );

  const installCommand = useMemo(() => generateFluentBitInstallCommand(), []);

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
    <>
      <Typography variant="body2" color="text.secondary">
        Save the generated configuration and install Fluent Bit on your host.
      </Typography>

      <Stack spacing={2}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>
              1. Fluent Bit configuration
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => void handleCopy("config", config)}
            >
              {copiedSection === "config" ? "Copied!" : "Copy config"}
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
              whiteSpace: "pre-wrap",
              fontSize: "0.8rem",
              fontFamily: "monospace",
            }}
          >
            {config}
          </Box>
        </Box>

        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>
              2. Install and start Fluent Bit
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => void handleCopy("install", installCommand)}
            >
              {copiedSection === "install" ? "Copied!" : "Copy"}
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
              whiteSpace: "pre-wrap",
              fontSize: "0.8rem",
              fontFamily: "monospace",
            }}
          >
            {installCommand}
          </Box>
        </Box>
      </Stack>
    </>
  );
}
