import { z } from "zod";

const thresholdColor = z.enum(["success", "warning", "error"]);

const thresholdStep = z.object({
  value: z.number(),
  color: thresholdColor,
});

export const thresholdsSchema = z.object({
  steps: z.array(thresholdStep),
  baseColor: thresholdColor.optional(),
});

export const VISUALIZATION_TYPES = [
  "timeseries",
  "bar",
  "table",
  "stat",
  "gauge",
  "pie",
  "heatmap",
  "scatter",
  "histogram",
  "markdown",
] as const;

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

export const panelDefinitionSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  query: z.string(),
  visualization: visualizationTypeSchema,
  layout: panelLayoutSchema,
  options: z.record(z.string(), z.unknown()).optional(),
  refreshInterval: z.number().optional(),
});

const parameterSourceSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("text") }),
  z.object({ mode: z.literal("options"), values: z.array(z.string()) }),
  z.object({ mode: z.literal("esql"), query: z.string() }),
]);

const dashboardParameterSchema = z
  .object({
    name: z.string().min(1),
    label: z.string().min(1),
    type: z.enum(["keyword", "number", "boolean", "date"]).default("keyword"),
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
  panels: z.array(panelDefinitionSchema),
  parameters: z.array(dashboardParameterSchema).optional(),
  timeRange: timeRangeSchema,
  refreshInterval: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
