import { useCallback } from "react";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";

import { useLLMStore } from "../store/useLLMStore";
import type { InsightSlotDefinition, PageInsightsResponse } from "../types/insightSlots";

import { pageInsightsSchema } from "./insightSlotSchema";

export interface UsePageSlotInsightsOptions {
  /** Serialized page context passed as the user message to the LLM */
  context: string;
  /** System prompt tailored to the page domain */
  systemPrompt: string;
  /** Stable cache key (e.g. "cluster-overview-slots::<hash>") */
  cacheKey: string;
  /** Slot definitions so the LLM knows which slots to populate */
  slots: InsightSlotDefinition[];
  /** Whether to fetch insights (default: true) */
  enabled?: boolean;
}

const QUERY_KEY_PREFIX = "page-slot-insights" as const;

/**
 * Fetches structured per-slot insights in a single LLM call.
 *
 * Follows the same React Query conventions as `usePageInsight` and
 * `useTimelineMarkers` (`staleTime: Infinity`, `retry: false`, manual refresh).
 */
export function usePageSlotInsights({
  context,
  systemPrompt,
  cacheKey,
  slots,
  enabled = true,
}: UsePageSlotInsightsOptions) {
  const {
    apiKey,
    provider,
    model: llmModel,
  } = useLLMStore(
    useShallow((s) => ({
      apiKey: s.config.apiKey,
      provider: s.config.provider,
      model: s.config.model,
    })),
  );
  const hasApiKey = Boolean(apiKey?.trim());
  const queryClient = useQueryClient();

  const {
    data,
    isFetching: loading,
    error: queryError,
  } = useQuery({
    queryKey: [QUERY_KEY_PREFIX, cacheKey, provider, llmModel, hasApiKey] as const,
    queryFn: async ({ signal }) => {
      const slotList = slots.map((s) => `- ${s.slotId}: ${s.label}`).join("\n");
      const augmentedSystem = `${systemPrompt}\n\nTarget insight slots:\n${slotList}`;

      const openai = createOpenAI({
        apiKey,
        ...(provider === "openrouter" ? { baseURL: "https://openrouter.ai/api/v1" } : {}),
      });
      const model = provider === "openrouter" ? openai.chat(llmModel) : openai(llmModel);

      const result = await generateObject({
        model,
        schema: pageInsightsSchema,
        system: augmentedSystem,
        messages: [{ role: "user", content: context }],
        abortSignal: signal,
      });

      const allowedSlotIds = new Set(slots.map((slot) => slot.slotId));
      const insightBySlotId = new Map<string, PageInsightsResponse["insights"][number]>();
      for (const insight of result.object.insights) {
        if (allowedSlotIds.has(insight.slotId) && !insightBySlotId.has(insight.slotId)) {
          insightBySlotId.set(insight.slotId, insight);
        }
      }
      const insights = slots.flatMap((slot) => {
        const insight = insightBySlotId.get(slot.slotId);
        return insight ? [insight] : [];
      });

      return {
        summary: result.object.summary,
        insights,
      } satisfies PageInsightsResponse;
    },
    enabled: enabled && hasApiKey && slots.length > 0 && Boolean(context.trim()),
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const error = queryError
    ? ((queryError as Error).message ?? "Failed to generate slot insights")
    : null;

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [QUERY_KEY_PREFIX, cacheKey] });
  }, [queryClient, cacheKey]);

  return {
    summary: data?.summary ?? null,
    insights: data?.insights ?? [],
    loading,
    error,
    refresh,
  };
}
