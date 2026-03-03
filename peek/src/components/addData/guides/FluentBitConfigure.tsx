import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { FLUENT_BIT_OUTPUT_CONFIGS } from "../../../services/addData/fluentBitConfig";
import type { FluentBitOutputMode } from "../../../services/addData/fluentBitConfig";

export interface FluentBitConfigureProps {
  outputMode: FluentBitOutputMode;
  onOutputModeChange: (mode: FluentBitOutputMode) => void;
}

export default function FluentBitConfigure({
  outputMode,
  onOutputModeChange,
}: FluentBitConfigureProps) {
  return (
    <>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        Select output mode
      </Typography>
      <Stack spacing={1}>
        {FLUENT_BIT_OUTPUT_CONFIGS.map((config) => (
          <Paper
            key={config.mode}
            variant="outlined"
            onClick={() => onOutputModeChange(config.mode)}
            sx={{
              p: 1.5,
              borderWidth: outputMode === config.mode ? 2 : 1,
              borderColor: outputMode === config.mode ? "primary.main" : undefined,
              cursor: "pointer",
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {config.label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {config.description}
            </Typography>
          </Paper>
        ))}
      </Stack>
    </>
  );
}
