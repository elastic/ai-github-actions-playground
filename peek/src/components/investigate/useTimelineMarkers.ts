import { useCallback, useMemo } from "react";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";
import { z } from "zod";

import { useLLMStore } from "../../store/useLLMStore";

import {
  type InvestigateTab,
  type TimelineEvent,
  type TimelineMarker,
  buildTimelineContext,
  TIMELINE_MARKERS_SYSTEM_PROMPT,
} from "./investigateUtils";

const timelineMarkersSchema = z.object({
  markers: z.array(
    z.object({
      timestamp: z.string(),
      label: z.string(),
      description: z.string(),
      severity: z.enum(["info", "warning", "critical"]),
    }),
  ),
});

interface UseTimelineMarkersOptions {
  events: TimelineEvent[];
  activeTab: InvestigateTab;
  searchedEntity: string;
}

/**
 * Ask the LLM to identify notable events and return structured timeline
 * markers.  Falls back gracefully when no API key is configured.
 */
export function useTimelineMarkers({
  events,
  activeTab,
  searchedEntity,
}: UseTimelineMarkersOptions) {
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

  const context = useMemo(
    () => buildTimelineContext(events, activeTab, searchedEntity),
    [events, activeTab, searchedEntity],
  );

  const cacheKey = useMemo(
    () =>
      `investigate-markers::${activeTab}::${searchedEntity}::${events.length}::${events[0]?.timestamp ?? ""}`,
    [activeTab, searchedEntity, events],
  );

  const {
    data: markers = [],
    isFetching: loading,
    error: queryError,
  } = useQuery({
    queryKey: ["timeline-markers", cacheKey, apiKey, provider, llmModel] as const,
    queryFn: async ({ signal }) => {
      const openai = createOpenAI({
        apiKey,
        ...(provider === "openrouter" ? { baseURL: "https://openrouter.ai/api/v1" } : {}),
      });
      const model = provider === "openrouter" ? openai.chat(llmModel) : openai(llmModel);

      const result = await generateObject({
        model,
        schema: timelineMarkersSchema,
        system: TIMELINE_MARKERS_SYSTEM_PROMPT,
        messages: [{ role: "user", content: context }],
        abortSignal: signal,
      });

      return (result.object.markers ?? []) as TimelineMarker[];
    },
    enabled: hasApiKey && events.length > 0 && Boolean(context.trim()),
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const error = queryError ? ((queryError as Error).message ?? "Failed to generate markers") : null;

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["timeline-markers", cacheKey] });
  }, [queryClient, cacheKey]);

  return { markers, loading, error, refresh, hasApiKey };
}
