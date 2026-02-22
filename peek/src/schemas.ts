import { z } from "zod";

const visualizationType = z.enum(["timeseries", "bar", "table", "stat", "gauge", "pie"]);

const panelLayout = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});

const timeRange = z.object({
  from: z.string(),
  to: z.string(),
});

const panelDefinition = z.object({
  id: z.string().min(1),
  title: z.string(),
  query: z.string(),
  visualization: visualizationType,
  layout: panelLayout,
  options: z.record(z.string(), z.unknown()).optional(),
  refreshInterval: z.number().optional(),
});

const parameterSource = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("text") }),
  z.object({ mode: z.literal("options"), values: z.array(z.string()) }),
  z.object({ mode: z.literal("esql"), query: z.string() }),
]);

const dashboardParameter = z.object({
  name: z.string().min(1),
  label: z.string(),
  type: z.literal("keyword"),
  source: parameterSource,
  value: z.string(),
});

export const dashboardDefinitionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  panels: z.array(panelDefinition),
  parameters: z.array(dashboardParameter).optional(),
  timeRange,
  refreshInterval: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
