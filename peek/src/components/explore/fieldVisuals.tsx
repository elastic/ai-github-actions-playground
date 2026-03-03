import type { ReactElement } from "react";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import NumbersIcon from "@mui/icons-material/Numbers";
import SellIcon from "@mui/icons-material/Sell";
import StorageIcon from "@mui/icons-material/Storage";

import type { MetricTypeClassification } from "../../services/es";

export type FieldVisualKind =
  | "metric-gauge"
  | "metric-counter"
  | "resource-attribute"
  | "attribute"
  | "none";

const RESOURCE_ATTRIBUTE_PREFIXES = [
  "service.",
  "host.",
  "k8s.",
  "container.",
  "telemetry.",
  "process.",
];

export function classifyFieldVisual(
  fieldName: string,
  metricType: MetricTypeClassification,
): FieldVisualKind {
  if (metricType === "gauge") return "metric-gauge";
  if (metricType === "counter") return "metric-counter";
  if (
    fieldName.startsWith("resource.attributes.") ||
    RESOURCE_ATTRIBUTE_PREFIXES.some((prefix) => fieldName.startsWith(prefix))
  ) {
    return "resource-attribute";
  }
  if (fieldName.startsWith("attributes.")) return "attribute";
  return "none";
}

export function getFieldVisualIcon(
  kind: FieldVisualKind,
  fontSize: number = 14,
): ReactElement | undefined {
  const iconSx = { fontSize, color: "text.secondary" };
  switch (kind) {
    case "metric-gauge":
      return <ShowChartIcon sx={iconSx} />;
    case "metric-counter":
      return <NumbersIcon sx={iconSx} />;
    case "resource-attribute":
      return <StorageIcon sx={iconSx} />;
    case "attribute":
      return <SellIcon sx={iconSx} />;
    default:
      return undefined;
  }
}
