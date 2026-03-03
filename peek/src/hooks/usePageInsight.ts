import { useCallback } from "react";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";

import { useLLMStore } from "../store/useLLMStore";

export function clearInsightCache() {
  // No-op: cache is now managed by React Query. Callers that relied on this
  // to force re-fetch should use the `refresh` callback returned by the hook.
  // Kept as export so existing call sites (e.g. tests) continue to compile.
}

interface UsePageInsightOptions {
  /** Serialized page context passed as the user message to the LLM */
  context: string;
  /** System prompt tailored to the page domain */
  systemPrompt: string;
  /** Stable cache key (e.g. "cluster-overview::<hash>") */
  cacheKey: string;
  /** Whether to fetch the insight (default: true) */
  enabled?: boolean;
}

export function usePageInsight({
  context,
  systemPrompt,
  cacheKey,
  enabled = true,
}: UsePageInsightOptions) {
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
    data: insight = null,
    isFetching: loading,
    error: queryError,
  } = useQuery({
    queryKey: ["page-insight", cacheKey, provider, llmModel] as const,
    queryFn: async ({ signal }) => {
      const openai = createOpenAI({
        apiKey,
        ...(provider === "openrouter" ? { baseURL: "https://openrouter.ai/api/v1" } : {}),
      });
      const model = provider === "openrouter" ? openai.chat(llmModel) : openai(llmModel);

      const result = await generateText({
        model,
        system: systemPrompt,
        messages: [{ role: "user", content: context }],
        abortSignal: signal,
      });

      const text = result.text.trim();
      return text || null;
    },
    enabled: enabled && hasApiKey && Boolean(context.trim()),
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const error = queryError ? ((queryError as Error).message ?? "Failed to generate insight") : null;

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["page-insight", cacheKey] });
  }, [queryClient, cacheKey]);

  return { insight, loading, error, refresh };
}
