import CloudIcon from "@mui/icons-material/Cloud";
import CodeIcon from "@mui/icons-material/Code";
import DevicesIcon from "@mui/icons-material/Devices";
import LanIcon from "@mui/icons-material/Lan";
import StorageIcon from "@mui/icons-material/Storage";
import ViewInArIcon from "@mui/icons-material/ViewInAr";

import type { AddDataTechnologyCategory } from "../../services/addData/catalog";

export const SIGNAL_COLORS: Record<string, "info" | "success" | "warning"> = {
  logs: "info",
  metrics: "success",
  traces: "warning",
};

export const CATEGORY_ICONS: Record<AddDataTechnologyCategory, React.ReactElement> = {
  cloud: <CloudIcon fontSize="small" />,
  containers: <ViewInArIcon fontSize="small" />,
  databases: <StorageIcon fontSize="small" />,
  applications: <CodeIcon fontSize="small" />,
  operating_systems: <DevicesIcon fontSize="small" />,
  network: <LanIcon fontSize="small" />,
};
