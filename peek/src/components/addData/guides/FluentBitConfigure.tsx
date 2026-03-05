import { useMemo } from "react";
import ButtonBase from "@mui/material/ButtonBase";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import type {
  FluentBitOutputMode,
  ThirdPartyCollectorId,
} from "../../../services/addData/fluentBitConfig";
import { getCollectorOutputConfigs } from "../../../services/addData/fluentBitConfig";

export interface FluentBitConfigureProps {
  collectorId: ThirdPartyCollectorId;
  technologyLabel: string;
  outputMode: FluentBitOutputMode;
  onOutputModeChange: (mode: FluentBitOutputMode) => void;
}

export default function FluentBitConfigure({
  collectorId,
  technologyLabel,
  outputMode,
  onOutputModeChange,
}: FluentBitConfigureProps) {
  const supportedOutputs = useMemo(() => getCollectorOutputConfigs(collectorId), [collectorId]);
  return (
    <>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        Select output mode
      </Typography>
      <Stack spacing={1}>
        {supportedOutputs.map((config) => {
          const isSelected = outputMode === config.mode;
          return (
            <ButtonBase
              key={config.mode}
              onClick={() => onOutputModeChange(config.mode)}
              aria-pressed={isSelected}
              sx={{ display: "block", borderRadius: 1, textAlign: "left" }}
            >
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? "primary.main" : undefined,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {config.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {`${config.description} (${technologyLabel})`}
                </Typography>
              </Paper>
            </ButtonBase>
          );
        })}
      </Stack>
    </>
  );
}
