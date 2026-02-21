import { z } from "zod";

const visualizationType = z.enum(["timeseries", "bar", "table", "stat", "gauge", "pie"]);

const panelLayout = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

const timeRange = z.object({
  from: z.string(),
  to: z.string(),
});

const panelDefinition = z.object({
  id: z.string(),
  title: z.string(),
  query: z.string(),
  visualization: visualizationType,
  layout: panelLayout,
  options: z.record(z.string(), z.unknown()).optional(),
  refreshInterval: z.number().optional(),
});

export const dashboardDefinitionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  panels: z.array(panelDefinition),
  timeRange,
  refreshInterval: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
