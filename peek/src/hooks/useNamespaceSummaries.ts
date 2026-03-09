import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
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

const LOW_SIGNAL_TOKENS = new Set([
  "1m",
  "5m",
  "15m",
  "30m",
  "60m",
  "time",
  "timestamp",
  "count",
  "total",
  "sum",
  "avg",
  "min",
  "max",
  "p50",
  "p75",
  "p90",
  "p95",
  "p99",
  "value",
  "values",
  "metric",
  "metrics",
  "rate",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((t) => t.trim())
    .filter(Boolean);
}

function isInformativeToken(token: string): boolean {
  if (LOW_SIGNAL_TOKENS.has(token)) return false;
  if (/^\d+$/.test(token)) return false;
  if (/^\d+[smhdw]$/.test(token)) return false;
  return token.length >= 3;
}

function stripNamespacePrefix(metricName: string, namespace: string): string {
  const prefix = `${namespace}.`;
  return metricName.startsWith(prefix) ? metricName.slice(prefix.length) : metricName;
}

function extractSignalTerms(metricNames: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const name of metricNames) {
    for (const token of tokenize(name)) {
      if (!isInformativeToken(token) || seen.has(token)) continue;
      seen.add(token);
      out.push(token);
      if (out.length >= 8) return out;
    }
  }
  return out;
}

function representativeMetrics(metricNames: string[], namespace: string): string[] {
  const normalized = metricNames.map((name) => stripNamespacePrefix(name, namespace));
  const withSignal = normalized.filter((name) =>
    tokenize(name).some((token) => isInformativeToken(token)),
  );
  const chosen = withSignal.length > 0 ? withSignal : normalized;
  return Array.from(new Set(chosen)).slice(0, 12);
}

function isLowSignalSummary(summary: string): boolean {
  const tokens = tokenize(summary);
  if (tokens.length === 0) return true;
  return !tokens.some((token) => isInformativeToken(token));
}

function fallbackSummary(metricNames: string[]): string {
  const terms = extractSignalTerms(metricNames);
  if (terms.length === 0) {
    return "Includes operational metrics for this domain.";
  }
  return `Includes ${terms.slice(0, 3).join(", ")} metrics.`;
}

function parseJsonObjectFromText(text: string): unknown {
  const trimmed = text.trim();
  const withoutFenceStart = trimmed.replace(/^```(?:json)?\s*/i, "");
  const withoutFences = withoutFenceStart.replace(/\s*```$/, "").trim();
  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  const jsonSlice =
    start >= 0 && end >= start ? withoutFences.slice(start, end + 1) : withoutFences;
  return JSON.parse(jsonSlice);
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
  const authScope = apiKey?.trim() ?? "";

  const contextJson = JSON.stringify(
    namespaces.map((n) => ({
      namespace: n.namespace,
      metricCount: n.metricCount,
      sampleMetrics: representativeMetrics(n.sampleMetricNames, n.namespace),
      signalTerms: extractSignalTerms(n.sampleMetricNames).slice(0, 6),
    })),
  );

  const { data, isFetching, error } = useQuery({
    queryKey: ["namespace-summaries", contextJson, provider, llmModel, authScope] as const,
    queryFn: async ({ signal }) => {
      const systemPrompt =
        "You are a metrics observability assistant. " +
        "For each metric namespace provided, write a TL;DR in exactly one short sentence (max 18 words). " +
        "Base your summary on the namespace name, sample metric field names, and signal terms. " +
        "Focus on what the metrics describe (for example: CPU, memory, latency, errors, throughput). " +
        "Do not write summaries that only list generic suffixes like count/time/rate/1m/5m/15m. " +
        "Use plain language, avoid IDs/timestamps/version strings unless essential, and prioritize the main signal over details. " +
        "Return a JSON object with a 'summaries' key mapping each namespace string to its summary string.";

      const openai = createOpenAI({
        apiKey,
        ...(provider === "openrouter" ? { baseURL: "https://openrouter.ai/api/v1" } : {}),
      });
      const model = provider === "openrouter" ? openai.chat(llmModel) : openai(llmModel);
      let resultObject: z.infer<typeof namespaceSummariesSchema>;
      try {
        const result = await generateObject({
          model,
          schema: namespaceSummariesSchema,
          system: systemPrompt,
          messages: [{ role: "user", content: contextJson }],
          abortSignal: signal,
        });
        resultObject = result.object;
      } catch (structuredOutputError) {
        if (signal.aborted) throw structuredOutputError;
        console.debug("Structured namespace summary failed; using text fallback", {
          provider,
          model: llmModel,
          namespaceCount: namespaces.length,
          error: structuredOutputError,
        });
        // Some provider/model combos reject structured output; fall back to text and parse strict JSON.
        const fallback = await generateText({
          model,
          system:
            `${systemPrompt}\n\n` +
            "Return ONLY valid JSON with this exact shape: " +
            '{"summaries":{"<namespace>":"<one sentence TL;DR>"}}. ' +
            "Do not include markdown fences or extra keys.",
          messages: [{ role: "user", content: contextJson }],
          abortSignal: signal,
        });
        const parsed = namespaceSummariesSchema.safeParse(parseJsonObjectFromText(fallback.text));
        if (!parsed.success) {
          throw new Error("Failed to parse namespace summaries response", { cause: structuredOutputError });
        }
        resultObject = parsed.data;
      }

      const cleaned: Record<string, string> = {};
      for (const n of namespaces) {
        const raw = resultObject.summaries[n.namespace]?.trim() ?? "";
        cleaned[n.namespace] =
          raw.length > 0 && !isLowSignalSummary(raw) ? raw : fallbackSummary(n.sampleMetricNames);
      }
      return cleaned;
    },
    enabled:
      enabled && hasApiKey && namespaces.length > 0 && namespaces.every((n) => n.metricCount > 0),
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const fallbackSummaries = useMemo(() => {
    const out: Record<string, string> = {};
    for (const n of namespaces) {
      out[n.namespace] = fallbackSummary(n.sampleMetricNames);
    }
    return out;
  }, [namespaces]);

  return {
    summaries: data ? { ...fallbackSummaries, ...data } : fallbackSummaries,
    loading: isFetching,
    error: error ? (error as Error).message : null,
  };
}
