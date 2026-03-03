import { useState, useEffect, useCallback } from "react";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { useShallow } from "zustand/react/shallow";

import { useLLMStore } from "../store/useLLMStore";

const MAX_CACHE_SIZE = 50;

/** LRU-bounded cache of cacheKey → insight text. */
const insightCache = new Map<string, string>();

export function clearInsightCache() {
  insightCache.clear();
}

function cacheSet(key: string, value: string) {
  insightCache.delete(key);
  insightCache.set(key, value);
  if (insightCache.size > MAX_CACHE_SIZE) {
    const oldest = insightCache.keys().next().value;
    if (oldest !== undefined) insightCache.delete(oldest);
  }
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

  const cachedInsight = insightCache.get(cacheKey) ?? null;

  const [asyncResult, setAsyncResult] = useState<{ key: string; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const insight = cachedInsight ?? (asyncResult?.key === cacheKey ? asyncResult.text : null);

  useEffect(() => {
    if (!enabled || !hasApiKey || !context.trim() || cachedInsight) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const openai = createOpenAI({
          apiKey,
          ...(provider === "openrouter" ? { baseURL: "https://openrouter.ai/api/v1" } : {}),
        });
        const model = provider === "openrouter" ? openai.chat(llmModel) : openai(llmModel);

        const result = await generateText({
          model,
          system: systemPrompt,
          messages: [{ role: "user", content: context }],
          abortSignal: controller.signal,
        });

        const text = result.text.trim();
        if (text) {
          cacheSet(cacheKey, text);
          setAsyncResult({ key: cacheKey, text });
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError" && !controller.signal.aborted) {
          setError((err as Error).message ?? "Failed to generate insight");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [
    enabled,
    hasApiKey,
    apiKey,
    provider,
    llmModel,
    context,
    systemPrompt,
    cacheKey,
    cachedInsight,
    refreshCounter,
  ]);

  const refresh = useCallback(() => {
    insightCache.delete(cacheKey);
    setAsyncResult(null);
    setRefreshCounter((c) => c + 1);
  }, [cacheKey]);

  return { insight, loading, error, refresh };
}
