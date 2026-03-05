import { z } from "zod";

/**
 * Zod schema for the structured output returned by the LLM when generating
 * page slot insights.  Used with `generateObject` from the AI SDK.
 */
export const pageInsightsSchema = z.object({
  summary: z.string().trim().min(1).describe("High-level page summary"),
  insights: z.array(
    z.object({
      slotId: z
        .string()
        .trim()
        .min(1)
        .describe("Slot identifier matching InsightSlotDefinition.slotId"),
      text: z.string().trim().min(1).describe("Concise insight text for the slot"),
      severity: z
        .enum(["info", "warning", "critical"])
        .optional()
        .describe("Optional severity hint"),
      suggestedDimension: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe(
          "For metrics chart slots: when suggesting a dimension to group by, include the exact field name (e.g. host.name) so the UI can offer an Apply action",
        ),
    }),
  ),
});

export type PageInsightsSchemaOutput = z.infer<typeof pageInsightsSchema>;
