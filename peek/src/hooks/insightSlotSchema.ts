import { z } from "zod";

/**
 * Zod schema for the structured output returned by the LLM when generating
 * page slot insights.  Used with `generateObject` from the AI SDK.
 */
export const pageInsightsSchema = z.object({
  summary: z.string().describe("High-level page summary"),
  insights: z.array(
    z.object({
      slotId: z.string().describe("Slot identifier matching InsightSlotDefinition.slotId"),
      text: z.string().describe("Concise insight text for the slot"),
      severity: z
        .enum(["info", "warning", "critical"])
        .optional()
        .describe("Optional severity hint"),
    }),
  ),
});

export type PageInsightsSchemaOutput = z.infer<typeof pageInsightsSchema>;
