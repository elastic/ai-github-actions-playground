import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { useQuery } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";
import { z } from "zod";

import { useLLMStore } from "../store/useLLMStore";

const namespaceSummariesSchema = z.object({
  summaries: z.record(z.string(), z.string()),
});

export interface NamespaceInfo {
  namespace: string;
  metricCount: number;
  sampleMetricNames: string[];
}

/**
 * Fetches LLM-generated summaries for metric namespaces.
 * Each summary describes what kinds of metrics exist in that namespace.
 */
export function useNamespaceSummaries(namespaces: NamespaceInfo[], enabled: boolean) {
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

  const contextJson = JSON.stringify(
    namespaces.map((n) => ({
      namespace: n.namespace,
      metricCount: n.metricCount,
      sampleMetrics: n.sampleMetricNames.slice(0, 12),
    })),
  );

  const { data, isFetching, error } = useQuery({
    queryKey: ["namespace-summaries", contextJson, provider, llmModel, hasApiKey] as const,
    queryFn: async ({ signal }) => {
      const systemPrompt =
        "You are a metrics observability assistant. " +
        "For each metric namespace provided, write a 1–2 sentence summary of what kinds of metrics it contains. " +
        "Base your summary on the namespace name and sample metric field names. " +
        "Be concise and descriptive. Use plain language. " +
        "Return a JSON object with a 'summaries' key mapping each namespace string to its summary string.";

      const openai = createOpenAI({
        apiKey,
        ...(provider === "openrouter" ? { baseURL: "https://openrouter.ai/api/v1" } : {}),
      });
      const model = provider === "openrouter" ? openai.chat(llmModel) : openai(llmModel);

      const result = await generateObject({
        model,
        schema: namespaceSummariesSchema,
        system: systemPrompt,
        messages: [{ role: "user", content: contextJson }],
        abortSignal: signal,
      });

      return result.object.summaries;
    },
    enabled:
      enabled && hasApiKey && namespaces.length > 0 && namespaces.every((n) => n.metricCount > 0),
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return {
    summaries: data ?? {},
    loading: isFetching,
    error: error ? (error as Error).message : null,
  };
}
