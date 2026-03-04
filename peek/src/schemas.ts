import { z } from "zod";

import {
  THRESHOLD_COLORS,
  PARAMETER_TYPES,
  PARAMETER_SOURCE_MODES,
} from "./contracts/dashboard/literals";
import { PERSES_PANEL_TYPES } from "./components/perses/panelRegistry";

export const VISUALIZATION_TYPES = PERSES_PANEL_TYPES;

const thresholdColor = z.enum(THRESHOLD_COLORS);

const thresholdStep = z.object({
  value: z.number(),
  color: thresholdColor,
});

export const thresholdsSchema = z.object({
  steps: z.array(thresholdStep),
  baseColor: thresholdColor.optional(),
});

export const visualizationTypeSchema = z.enum(VISUALIZATION_TYPES);

const panelLayoutSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});

const timeRangeSchema = z.object({
  from: z.string(),
  to: z.string(),
});

function isValidTimeZone(timeZone: string): boolean {
  if (typeof Intl.supportedValuesOf === "function") {
    return timeZone === "UTC" || Intl.supportedValuesOf("timeZone").includes(timeZone);
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Well-known IANA timezone values offered in the dashboard timezone selector. */
export const DASHBOARD_TIMEZONE_OPTIONS = [
  { label: "Browser local", value: "" },
  { label: "UTC", value: "UTC" },
  { label: "New York (ET)", value: "America/New_York" },
  { label: "Chicago (CT)", value: "America/Chicago" },
  { label: "Denver (MT)", value: "America/Denver" },
  { label: "Los Angeles (PT)", value: "America/Los_Angeles" },
  { label: "London (GMT/BST)", value: "Europe/London" },
  { label: "Paris (CET/CEST)", value: "Europe/Paris" },
  { label: "Tokyo (JST)", value: "Asia/Tokyo" },
  { label: "Shanghai (CST)", value: "Asia/Shanghai" },
  { label: "Sydney (AEST/AEDT)", value: "Australia/Sydney" },
] as const;

export const panelDefinitionSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  query: z.string(),
  queries: z.array(z.string().min(1)).optional(),
  visualization: visualizationTypeSchema,
  layout: panelLayoutSchema,
  options: z.record(z.string(), z.unknown()).optional(),
  refreshInterval: z.number().optional(),
});

const parameterSourceSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal(PARAMETER_SOURCE_MODES.text) }),
  z.object({ mode: z.literal(PARAMETER_SOURCE_MODES.options), values: z.array(z.string()) }),
  z.object({ mode: z.literal(PARAMETER_SOURCE_MODES.esql), query: z.string() }),
]);

export const dashboardParameterSchema = z
  .object({
    name: z.string().min(1),
    label: z.string().min(1),
    type: z.enum(PARAMETER_TYPES).default("keyword"),
    source: parameterSourceSchema,
    value: z.union([z.string(), z.number(), z.boolean()]),
  })
  .superRefine((param, ctx) => {
    if (param.type === "keyword" && typeof param.value !== "string") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Keyword parameters require a string value",
      });
    }
    if (param.type === "number" && typeof param.value !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Number parameters require a numeric value",
      });
    }
    if (param.type === "boolean" && typeof param.value !== "boolean") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Boolean parameters require true/false",
      });
    }
    if (param.type === "date") {
      if (typeof param.value !== "string") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["value"],
          message: "Date parameters require an ISO-8601 string value",
        });
        return;
      }
      if (Number.isNaN(Date.parse(param.value))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["value"],
          message: "Date parameters require a valid date value",
        });
      }
    }
  });

export const dashboardDefinitionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  archived: z.boolean().optional(),
  favoritedAt: z.string().optional(),
  preferredProfileId: z.string().min(1).optional(),
  panels: z.array(panelDefinitionSchema),
  parameters: z.array(dashboardParameterSchema).optional(),
  timeRange: timeRangeSchema,
  timeZone: z
    .string()
    .optional()
    .refine((tz) => !tz || isValidTimeZone(tz), {
      message: "timeZone must be a valid IANA timezone identifier",
    }),
  refreshInterval: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const workspaceSnapshotSchema = z.object({
  dashboards: z.array(dashboardDefinitionSchema).min(1),
  activeDashboardId: z.string().min(1),
});

const persesDisplaySchema = z.object({
  name: z.string().min(1),
});

const persesPanelPluginSchema = z.object({
  kind: z.string().min(1),
  spec: z.record(z.string(), z.unknown()).optional(),
});

const persesPanelQuerySchema = z
  .object({
    kind: z.string().min(1).optional(),
    spec: z.object({ query: z.string() }).passthrough().optional(),
    query: z.string().optional(),
  })
  .superRefine((query, ctx) => {
    if (!query.query && !query.spec?.query) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["query"],
        message: "query entry must include a query string",
      });
    }
  });

const persesPanelSpecSchema = z
  .object({
    display: persesDisplaySchema,
    layout: panelLayoutSchema,
    plugin: persesPanelPluginSchema.optional(),
    queries: z.array(persesPanelQuerySchema).optional(),
    refreshInterval: z.number().optional(),
    // Legacy hybrid support for backward-compatible imports.
    query: z.string().optional(),
    visualization: visualizationTypeSchema.optional(),
    options: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((spec, ctx) => {
    const hasCanonical = !!spec.plugin && (spec.queries?.length ?? 0) > 0;
    const hasLegacy = typeof spec.query === "string" && !!spec.visualization;
    if (!hasCanonical && !hasLegacy) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message:
          "panel spec must include either canonical plugin+queries or legacy query+visualization fields",
      });
    }
  });

const persesPanelSchema = z.object({
  kind: z.literal("Panel"),
  spec: persesPanelSpecSchema,
});

const persesVariableSchema = z.object({
  kind: z.enum(["TextVariable", "ListVariable", "QueryVariable"]),
  spec: z.object({
    name: z.string().min(1),
    display: persesDisplaySchema,
    type: z.enum(PARAMETER_TYPES).default("keyword"),
    source: parameterSourceSchema,
    value: z.union([z.string(), z.number(), z.boolean()]),
  }),
});

export const persesDashboardSchema = z.object({
  kind: z.literal("Dashboard"),
  metadata: z.object({
    name: z.string().min(1),
    labels: z.array(z.string()).optional(),
    annotations: z
      .object({
        description: z.string().optional(),
        archived: z.boolean().optional(),
        favoritedAt: z.string().optional(),
        preferredProfileId: z.string().min(1).optional(),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional(),
      })
      .optional(),
  }),
  spec: z.object({
    display: persesDisplaySchema,
    panels: z.record(z.string().min(1), persesPanelSchema),
    variables: z.array(persesVariableSchema).optional(),
    timeRange: timeRangeSchema,
    timeZone: z
      .string()
      .optional()
      .refine((tz) => !tz || isValidTimeZone(tz), {
        message: "timeZone must be a valid IANA timezone identifier",
      }),
    refreshInterval: z.number().optional(),
  }),
});

export const persesWorkspaceSnapshotSchema = z.object({
  kind: z.literal("Workspace"),
  spec: z.object({
    dashboards: z.array(persesDashboardSchema).min(1),
    activeDashboardId: z.string().min(1),
  }),
});
