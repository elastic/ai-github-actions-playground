import CloudIcon from "@mui/icons-material/Cloud";
import CodeIcon from "@mui/icons-material/Code";
import DesktopWindowsIcon from "@mui/icons-material/DesktopWindows";
import DnsIcon from "@mui/icons-material/Dns";
import IntegrationInstructionsIcon from "@mui/icons-material/IntegrationInstructions";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import JavascriptIcon from "@mui/icons-material/Javascript";
import LanIcon from "@mui/icons-material/Lan";
import LaptopMacIcon from "@mui/icons-material/LaptopMac";
import MemoryIcon from "@mui/icons-material/Memory";
import SettingsInputAntennaIcon from "@mui/icons-material/SettingsInputAntenna";
import StorageIcon from "@mui/icons-material/Storage";
import TerminalIcon from "@mui/icons-material/Terminal";
import ViewInArIcon from "@mui/icons-material/ViewInAr";

import type {
  AddDataExpectedSignal,
  AddDataGuidedExperience,
} from "../../services/addData/catalog";

export const SIGNAL_COLORS: Record<AddDataExpectedSignal, "info" | "success" | "warning"> = {
  logs: "info",
  metrics: "success",
  traces: "warning",
};

export const EXPERIENCE_ICONS: Record<AddDataGuidedExperience, React.ReactElement> = {
  cloud_providers: <CloudIcon />,
  kubernetes: <ViewInArIcon />,
  servers: <DnsIcon />,
  saas_databases: <IntegrationInstructionsIcon />,
  advanced: <TerminalIcon />,
};

export const TECHNOLOGY_ICONS: Record<string, React.ReactElement> = {
  aws: <CloudIcon fontSize="small" />,
  "vpc-flow-logs": <LanIcon fontSize="small" />,
  kubernetes: <ViewInArIcon fontSize="small" />,
  docker: <Inventory2Icon fontSize="small" />,
  "linux-host": <TerminalIcon fontSize="small" />,
  "windows-host": <DesktopWindowsIcon fontSize="small" />,
  "macos-host": <LaptopMacIcon fontSize="small" />,
  nginx: <DnsIcon fontSize="small" />,
  postgresql: <StorageIcon fontSize="small" />,
  redis: <MemoryIcon fontSize="small" />,
  mysql: <StorageIcon fontSize="small" />,
  mongodb: <StorageIcon fontSize="small" />,
  "java-apm": <CodeIcon fontSize="small" />,
  "python-apm": <CodeIcon fontSize="small" />,
  "nodejs-apm": <JavascriptIcon fontSize="small" />,
  "go-apm": <CodeIcon fontSize="small" />,
  "dotnet-apm": <CodeIcon fontSize="small" />,
  "ruby-apm": <CodeIcon fontSize="small" />,
  "php-apm": <CodeIcon fontSize="small" />,
  "fluent-bit": <SettingsInputAntennaIcon fontSize="small" />,
};
