import { useMemo, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { copyToClipboard } from "../../../utils/copyToClipboard";
import { useCopyFeedbackTimeout } from "../../../hooks/useCopyFeedbackTimeout";
import type { ApmLanguageDefinition } from "../../../services/addData/apmCatalog";

import { CODE_BLOCK_SX } from "./sharedStyles";

export interface ApmInstallProps {
  language: ApmLanguageDefinition;
  endpoint: string;
  apiKey: string;
}

export default function ApmInstall({ language, endpoint, apiKey }: ApmInstallProps) {
  const [copiedSection, setCopiedSection] = useState<"install" | "init" | null>(null);
  const scheduleReset = useCopyFeedbackTimeout(() => setCopiedSection(null));

  const resolvedInit = useMemo(
    () =>
      language.initSnippet.replaceAll("{{endpoint}}", endpoint).replaceAll("{{apiKey}}", apiKey),
    [language.initSnippet, endpoint, apiKey],
  );

  const handleCopy = useCallback(
    async (section: "install" | "init", text: string) => {
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
        Install the Elastic APM {language.label} agent and add the initialization snippet to your
        application.
      </Typography>
      <Box>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>
            1. Install the agent
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={() => void handleCopy("install", language.installCommand)}
          >
            {copiedSection === "install" ? "Copied!" : "Copy"}
          </Button>
        </Stack>
        <Box component="pre" sx={CODE_BLOCK_SX}>
          {language.installCommand}
        </Box>
      </Box>

      <Box>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>
            2. Initialize in your app
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={() => void handleCopy("init", resolvedInit)}
          >
            {copiedSection === "init" ? "Copied!" : "Copy"}
          </Button>
        </Stack>
        <Box component="pre" sx={CODE_BLOCK_SX}>
          {resolvedInit}
        </Box>
      </Box>

      <Link
        href={language.docsUrl}
        target="_blank"
        rel="noopener noreferrer"
        sx={{ display: "inline-flex", gap: 0.5, alignItems: "center" }}
      >
        {language.label} APM agent docs <OpenInNewIcon fontSize="small" />
      </Link>
    </Stack>
  );
}
