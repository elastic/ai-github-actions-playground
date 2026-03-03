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
  markers: z
    .array(
      z.object({
        timestamp: z.string(),
        label: z.string(),
        description: z.string(),
        severity: z.enum(["info", "warning", "critical"]),
      }),
    )
    .max(8),
});

interface UseTimelineMarkersOptions {
  events: TimelineEvent[];
  activeTab: InvestigateTab;
  searchedEntity: string;
}

function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
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
  const normalizedApiKey = apiKey?.trim() ?? "";
  const hasApiKey = normalizedApiKey.length > 0;
  const queryClient = useQueryClient();

  const context = useMemo(
    () => buildTimelineContext(events, activeTab, searchedEntity),
    [events, activeTab, searchedEntity],
  );

  const eventFingerprint = useMemo(() => {
    const raw = events
      .map(
        (e) => `${e.timestamp}|${e.category}|${e.action}|${e.outcome}|${e.dataSource}|${e.message}`,
      )
      .join("||");
    return fnv1a32(raw);
  }, [events]);
  const hashedSearchedEntity = useMemo(() => fnv1a32(searchedEntity), [searchedEntity]);

  const cacheKey = useMemo(
    () => `investigate-markers::${activeTab}::${hashedSearchedEntity}::${eventFingerprint}`,
    [activeTab, hashedSearchedEntity, eventFingerprint],
  );

  const {
    data: markers = [],
    isFetching: loading,
    error: queryError,
  } = useQuery({
    queryKey: ["timeline-markers", cacheKey, provider, llmModel, hasApiKey] as const,
    queryFn: async ({ signal }) => {
      const openai = createOpenAI({
        apiKey: normalizedApiKey,
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

      const eventTimestampMs = new Set(
        events.map((e) => Date.parse(e.timestamp)).filter((t) => Number.isFinite(t)),
      );
      return ((result.object.markers ?? []) as TimelineMarker[])
        .filter((m) => {
          const ms = Date.parse(m.timestamp);
          return Number.isFinite(ms) && eventTimestampMs.has(ms);
        })
        .slice(0, Math.min(8, events.length));
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
