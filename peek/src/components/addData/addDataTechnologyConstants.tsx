import CloudIcon from "@mui/icons-material/Cloud";
import DesktopWindowsIcon from "@mui/icons-material/DesktopWindows";
import DnsIcon from "@mui/icons-material/Dns";
import IntegrationInstructionsIcon from "@mui/icons-material/IntegrationInstructions";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import LanIcon from "@mui/icons-material/Lan";
import LaptopMacIcon from "@mui/icons-material/LaptopMac";
import MemoryIcon from "@mui/icons-material/Memory";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import SettingsInputAntennaIcon from "@mui/icons-material/SettingsInputAntenna";
import StorageIcon from "@mui/icons-material/Storage";
import TerminalIcon from "@mui/icons-material/Terminal";
import ViewInArIcon from "@mui/icons-material/ViewInAr";
import Box from "@mui/material/Box";

import type {
  AddDataExpectedSignal,
  AddDataGuidedExperience,
} from "../../services/addData/catalog";

const KUBERNETES_BRAND_COLOR = "#326CE5";

type LanguageLogoVariant = "java" | "python" | "node" | "go" | "dotnet" | "ruby" | "php";

function languageLogo(label: string, variant: LanguageLogoVariant): React.ReactElement {
  const accentPathByVariant: Record<LanguageLogoVariant, string> = {
    java: "M5 9l3-3h8l3 3v6l-3 3H8l-3-3z",
    python: "M12 4l6 4v8l-6 4-6-4V8z",
    node: "M12 3l8 4.5v9L12 21l-8-4.5v-9z",
    go: "M6 7h12v10H6z",
    dotnet: "M4 12l8-8 8 8-8 8z",
    ruby: "M12 3l7 6-3 9h-8L5 9z",
    php: "M4 7h16v10H4z",
  };
  return (
    <Box
      component="svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      sx={{
        display: "block",
        width: 20,
        height: 20,
      }}
    >
      <rect
        x="2.5"
        y="2.5"
        width="19"
        height="19"
        rx="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d={accentPathByVariant[variant]} fill="currentColor" opacity="0.2" />
      <text
        x="12"
        y="14"
        textAnchor="middle"
        fontSize="7"
        fontWeight="700"
        fill="currentColor"
        fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
      >
        {label}
      </text>
    </Box>
  );
}

export const SIGNAL_COLORS: Record<AddDataExpectedSignal, "info" | "success" | "warning"> = {
  logs: "info",
  metrics: "success",
  traces: "warning",
};

export const EXPERIENCE_ICONS: Record<AddDataGuidedExperience, React.ReactElement> = {
  cloud_providers: <CloudIcon />,
  kubernetes: <ViewInArIcon sx={{ color: KUBERNETES_BRAND_COLOR }} />,
  servers: <DnsIcon />,
  saas_databases: <IntegrationInstructionsIcon />,
  advanced: <TerminalIcon />,
};

export const TECHNOLOGY_ICONS: Record<string, React.ReactElement> = {
  aws: (
    <Box
      component="span"
      sx={{
        lineHeight: 1,
        letterSpacing: 0.2,
        textTransform: "lowercase",
        fontWeight: 700,
        fontSize: 11,
      }}
    >
      aws
    </Box>
  ),
  "vpc-flow-logs": <LanIcon fontSize="small" />,
  kubernetes: <ViewInArIcon fontSize="small" sx={{ color: KUBERNETES_BRAND_COLOR }} />,
  docker: <Inventory2Icon fontSize="small" />,
  "linux-host": <TerminalIcon fontSize="small" />,
  "windows-host": <DesktopWindowsIcon fontSize="small" />,
  "macos-host": <LaptopMacIcon fontSize="small" />,
  nginx: <DnsIcon fontSize="small" />,
  postgresql: <StorageIcon fontSize="small" />,
  redis: <MemoryIcon fontSize="small" />,
  mysql: <StorageIcon fontSize="small" />,
  mongodb: <StorageIcon fontSize="small" />,
  "java-apm": languageLogo("J", "java"),
  "python-apm": languageLogo("Py", "python"),
  "nodejs-apm": languageLogo("JS", "node"),
  "go-apm": languageLogo("Go", "go"),
  "dotnet-apm": languageLogo(".N", "dotnet"),
  "ruby-apm": languageLogo("Rb", "ruby"),
  "php-apm": languageLogo("PHP", "php"),
  "prometheus-scrape": <QueryStatsIcon fontSize="small" />,
  "prometheus-remote-write": <QueryStatsIcon fontSize="small" />,
  "fluent-bit": <SettingsInputAntennaIcon fontSize="small" />,
  vector: <SettingsInputAntennaIcon fontSize="small" />,
  fluentd: <SettingsInputAntennaIcon fontSize="small" />,
  filebeat: <SettingsInputAntennaIcon fontSize="small" />,
  logstash: <SettingsInputAntennaIcon fontSize="small" />,
};
