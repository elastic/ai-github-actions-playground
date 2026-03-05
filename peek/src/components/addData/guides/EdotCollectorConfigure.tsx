import ButtonBase from "@mui/material/ButtonBase";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";

import { COMPONENT_HEIGHTS } from "../../../types/tokens";
import type { Platform } from "../../../utils/addDataUtils";
import type { AddDataEnvironment } from "../../../services/addData/catalog";

import CollectorAlternatives from "./CollectorAlternatives";

const ALL_PLATFORM_TABS: { value: Platform; label: string }[] = [
  { value: "kubernetes", label: "Kubernetes" },
  { value: "docker", label: "Docker" },
  { value: "linux", label: "Linux" },
  { value: "macos", label: "macOS" },
  { value: "windows", label: "Windows" },
];

export interface EdotCollectorConfigureProps {
  recommendedSelected: boolean;
  onSelectRecommended: () => void;
  platform: Platform;
  onPlatformChange: (platform: Platform) => void;
  supportedEnvironments?: readonly AddDataEnvironment[];
  onSwitchToTechnology?: (technologyId: "fluent-bit" | "vector") => void;
}

export default function EdotCollectorConfigure({
  recommendedSelected,
  onSelectRecommended,
  platform,
  onPlatformChange,
  supportedEnvironments,
  onSwitchToTechnology,
}: EdotCollectorConfigureProps) {
  const displayTabs = (supportedEnvironments ?? []).length
    ? ALL_PLATFORM_TABS.filter((tab) =>
        (supportedEnvironments ?? []).includes(tab.value as AddDataEnvironment),
      )
    : [];

  return (
    <>
      <Stack spacing={1}>
        <ButtonBase
          onClick={onSelectRecommended}
          aria-pressed={recommendedSelected}
          sx={{ display: "block", borderRadius: 1, textAlign: "left" }}
        >
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              borderWidth: recommendedSelected ? 2 : 1,
              borderColor: recommendedSelected ? "primary.main" : undefined,
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Monitor with OpenTelemetry Collector
              </Typography>
              <Chip size="small" color="primary" label="Recommended" />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Full telemetry support with the guided EDOT onboarding flow.
            </Typography>
          </Paper>
        </ButtonBase>
        <CollectorAlternatives idPrefix="edot" onSwitchToTechnology={onSwitchToTechnology} />
      </Stack>

      {displayTabs.length > 1 && (
        <Tabs
          value={platform}
          onChange={(_, value: Platform) => onPlatformChange(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: COMPONENT_HEIGHTS.tab,
            "& .MuiTab-root": { minHeight: COMPONENT_HEIGHTS.tab, py: 0.5 },
          }}
        >
          {displayTabs.map((tab) => (
            <Tab key={tab.value} value={tab.value} label={tab.label} />
          ))}
        </Tabs>
      )}
    </>
  );
}
