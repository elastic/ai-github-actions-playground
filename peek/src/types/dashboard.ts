import type { z } from "zod";

import type { dashboardDefinitionSchema, panelDefinitionSchema } from "../schemas";
import type { EsqlResponse, ElasticsearchError } from "../services/es";
import type { ParameterType } from "../contracts/dashboard/literals";

import type { VisualizationOptions } from "./visualization";

type InferredPanelDefinition = z.infer<typeof panelDefinitionSchema>;
export type PanelDefinition = Omit<InferredPanelDefinition, "options"> & {
  /** Visualization-specific options */
  options?: VisualizationOptions;
};

/** How a dashboard parameter gets its selectable values. */
export type ParameterSource =
  | { mode: "text" }
  | { mode: "options"; values: string[] }
  | { mode: "esql"; query: string };

/** A user-defined dashboard variable referenced as `?name` in ES|QL queries. */
export interface DashboardParameter {
  /** Identifier used in ES|QL queries (e.g. `service` → `?service`). */
  name: string;
  /** Human-readable label shown in the parameter bar. */
  label: string;
  /** ES|QL parameter type. */
  type: ParameterType;
  /** How values are provided. */
  source: ParameterSource;
  /** Current value of the parameter. */
  value: string | number | boolean;
}

type InferredDashboardDefinition = z.infer<typeof dashboardDefinitionSchema>;
export type DashboardDefinition = Omit<InferredDashboardDefinition, "panels"> & {
  panels: PanelDefinition[];
  tags?: string[];
  archived?: boolean;
  favoritedAt?: string;
  preferredProfileId?: string;
};

export interface TimeRange {
  from: string;
  to: string;
}

/** Default auto-refresh interval in seconds */
export const DEFAULT_REFRESH_INTERVAL = 15;

export type QueryResult =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: EsqlResponse; executionTimeMs: number }
  | { status: "error"; error: ElasticsearchError };
