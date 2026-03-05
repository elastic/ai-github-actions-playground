import { useCallback, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import { useCopyFeedbackTimeout } from "../../../hooks/useCopyFeedbackTimeout";
import { copyToClipboard } from "../../../utils/copyToClipboard";

import { buildCommandPreview } from "./commandPreview";
import { CODE_BLOCK_SX } from "./sharedStyles";

interface QuickCommandPanelProps {
  command: string;
  title?: string;
  previewLines?: number;
}

export default function QuickCommandPanel({
  command,
  title = "Quick command",
  previewLines = 5,
}: QuickCommandPanelProps) {
  const [showFull, setShowFull] = useState(false);
  const [copied, setCopied] = useState(false);
  const scheduleCopyReset = useCopyFeedbackTimeout(() => setCopied(false));

  const preview = useMemo(
    () => buildCommandPreview(command, previewLines),
    [command, previewLines],
  );
  const canExpand = preview !== command;

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(command);
    if (!ok) return;
    setCopied(true);
    scheduleCopyReset();
  }, [command, scheduleCopyReset]);

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>
          {title}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ContentCopyIcon fontSize="small" />}
          onClick={() => void handleCopy()}
        >
          {copied ? "Copied!" : "Copy"}
        </Button>
      </Stack>
      {canExpand && !showFull ? (
        <ButtonBase
          component="pre"
          onClick={() => setShowFull(true)}
          sx={{
            ...CODE_BLOCK_SX,
            display: "block",
            width: "100%",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          {preview}
        </ButtonBase>
      ) : (
        <Box component="pre" sx={CODE_BLOCK_SX}>
          {showFull ? command : preview}
        </Box>
      )}
      {!showFull && canExpand && (
        <Button
          size="small"
          variant="text"
          onClick={() => setShowFull(true)}
          sx={{ alignSelf: "flex-start", mt: 1 }}
        >
          Show full command
        </Button>
      )}
      {showFull && canExpand && (
        <Button
          size="small"
          variant="text"
          onClick={() => setShowFull(false)}
          sx={{ alignSelf: "flex-start", mt: 1 }}
        >
          Show preview
        </Button>
      )}
    </Paper>
  );
}
