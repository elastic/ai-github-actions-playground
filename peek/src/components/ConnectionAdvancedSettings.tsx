import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ExpandLess from "@mui/icons-material/ExpandLess";

import { deriveIngestUrlOrEmpty } from "../hooks/useConnectionForm";

interface ConnectionAdvancedSettingsProps {
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  proxyUrl: string;
  onProxyUrlChange: (v: string) => void;
  ingestUrl: string;
  onIngestUrlChange: (v: string) => void;
  url: string;
}

export default function ConnectionAdvancedSettings({
  showAdvanced,
  onToggleAdvanced,
  proxyUrl,
  onProxyUrlChange,
  ingestUrl,
  onIngestUrlChange,
  url,
}: ConnectionAdvancedSettingsProps) {
  return (
    <>
      <Button
        size="small"
        onClick={onToggleAdvanced}
        endIcon={showAdvanced ? <ExpandLess /> : <ExpandMore />}
        sx={{ alignSelf: "flex-start" }}
      >
        Advanced Connection Settings
      </Button>
      <Collapse in={showAdvanced} unmountOnExit>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <TextField
            label="Proxy URL"
            placeholder="http://localhost:3000/_es"
            fullWidth
            value={proxyUrl}
            onChange={(e) => onProxyUrlChange(e.target.value)}
            helperText="Requests are sent to this URL; the Elasticsearch URL is forwarded as a header."
          />
          <TextField
            label="Ingest URL"
            placeholder={
              deriveIngestUrlOrEmpty(url) || "https://<id>.ingest.<region>.<provider>.elastic.cloud"
            }
            fullWidth
            value={ingestUrl}
            onChange={(e) => onIngestUrlChange(e.target.value)}
            helperText="Override OTLP ingest base URL (optional). Browser Tracing settings are now in Settings."
          />
        </Box>
      </Collapse>
    </>
  );
}
