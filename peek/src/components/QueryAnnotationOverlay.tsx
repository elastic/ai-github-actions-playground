import { useState, useEffect, useCallback, useMemo } from "react";
import ButtonBase from "@mui/material/ButtonBase";
import Fade from "@mui/material/Fade";
import { alpha } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { useShallow } from "zustand/react/shallow";

import { useLLMStore } from "../store/useLLMStore";

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLocalTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function buildExplainSystemPrompt(today: string, nowTime: string): string {
  return (
    "You are an ES|QL expert. The user will show you an ES|QL query. " +
    `Today's date is ${today}. ` +
    `Current local time is ${nowTime}. ` +
    "Respond with a short plain-language phrase (not a full sentence) describing what it does. " +
    'Start directly with the meaning, for example: "most recent 50 logs over the last hour". ' +
    'Do not start with phrases like "this query", "the query", or "it". ' +
    "Avoid repeating the same idea twice; mention each key concept only once. " +
    'For example, do not combine redundant phrasing like "most recent" with "sorted by timestamp". ' +
    'If the query window includes the current day, prefer "today" phrasing when natural. ' +
    'If the query is centered on very recent data (roughly within 60 minutes of now), prefer wording like "within the last hour". ' +
    'When you use relative time wording such as "within the last hour" or "over the next hour", do not also include explicit clock times for that same window. ' +
    "No code, no markdown, no quotes, no bullet points."
  );
}

const MAX_CACHE_SIZE = 50;
const OVERLAY_BG_ALPHA = 0.82;
const OVERLAY_BG_HOVER_ALPHA = 0.65;

/** LRU-bounded cache of `provider::model::query` → explanation. */
const explanationCache = new Map<string, string>();

export function clearQueryAnnotationExplanationCache() {
  explanationCache.clear();
}

function getCacheKey(query: string, provider: string, model: string) {
  return `${provider}::${model}::${query}`;
}

function cacheSet(key: string, value: string) {
  explanationCache.delete(key);
  explanationCache.set(key, value);
  if (explanationCache.size > MAX_CACHE_SIZE) {
    const oldest = explanationCache.keys().next().value;
    if (oldest !== undefined) explanationCache.delete(oldest);
  }
}

function normalizeExplanation(text: string): string {
  return text
    .trim()
    .replace(/^(this query|the query|it)\s+(shows?|returns?|fetches?|finds?|gets?|lists?)\s+/i, "")
    .replace(/^(this query|the query|it)\s+/i, "")
    .replace(/[.。\s]+$/u, "");
}

/**
 * Synchronously reads a cached explanation for the given query.
 * Returns null when no explanation has been generated yet.
 */
export function useQueryExplanation(query: string): string | null {
  const { provider, model } = useLLMStore(
    useShallow((s) => ({
      provider: s.config.provider,
      model: s.config.model,
    })),
  );
  const cacheKey = getCacheKey(query, provider, model);
  return useMemo(() => explanationCache.get(cacheKey) ?? null, [cacheKey]);
}

interface QueryAnnotationOverlayProps {
  query: string;
  editorFocused: boolean;
  height: number;
}

/**
 * Overlays a plain-language LLM-generated explanation on top of the editor
 * when the editor is not focused and the user hasn't recently edited it.
 * Clicking the overlay dismisses it and returns focus to the editor.
 */
export default function QueryAnnotationOverlay({
  query,
  editorFocused,
  height,
}: QueryAnnotationOverlayProps) {
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

  // Derive the cache key and check synchronously during render (avoids setState-in-effect)
  const cacheKey = useMemo(
    () => getCacheKey(query, provider, llmModel),
    [query, provider, llmModel],
  );
  const cachedExplanation = useMemo(() => explanationCache.get(cacheKey) ?? null, [cacheKey]);

  // Async-fetched result, keyed to its query to auto-invalidate when query changes
  const [asyncResult, setAsyncResult] = useState<{ query: string; text: string } | null>(null);

  // `dismissed` is keyed to the dismissed query string — auto-resets when query changes
  // and when the editor regains focus so the overlay reappears on each blur.
  const [dismissedForQuery, setDismissedForQuery] = useState<string | null>(null);
  const [prevFocused, setPrevFocused] = useState(editorFocused);
  // React "getDerivedStateFromProps" pattern: reset dismissed when editor gains focus
  // so the annotation reappears each time the user blurs out of the editor.
  if (editorFocused !== prevFocused) {
    setPrevFocused(editorFocused);
    if (editorFocused && dismissedForQuery !== null) {
      setDismissedForQuery(null);
    }
  }
  const dismissed = dismissedForQuery === query;

  const explanation = cachedExplanation ?? (asyncResult?.query === query ? asyncResult.text : null);

  // Fetch explanation when unfocused, not dismissed, and not already in cache
  useEffect(() => {
    if (editorFocused || dismissed || !query.trim() || !hasApiKey || cachedExplanation) {
      return;
    }

    const controller = new AbortController();

    void (async () => {
      try {
        const openai = createOpenAI({
          apiKey,
          ...(provider === "openrouter" ? { baseURL: "https://openrouter.ai/api/v1" } : {}),
        });
        const model = provider === "openrouter" ? openai.chat(llmModel) : openai(llmModel);

        const now = new Date();
        const result = await generateText({
          model,
          system: buildExplainSystemPrompt(formatLocalDate(now), formatLocalTime(now)),
          messages: [{ role: "user", content: query }],
          abortSignal: controller.signal,
        });

        const text = normalizeExplanation(result.text);
        if (text) {
          cacheSet(cacheKey, text);
          setAsyncResult({ query, text });
        }
      } catch (err: unknown) {
        if ((err as Error).name !== "AbortError") {
          console.error("Query annotation failed:", err);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [
    editorFocused,
    dismissed,
    query,
    hasApiKey,
    apiKey,
    provider,
    llmModel,
    cacheKey,
    cachedExplanation,
  ]);

  const handleClick = useCallback(() => {
    setDismissedForQuery(query);
  }, [query]);

  // Don't render when focused, dismissed, no API key, or explanation not yet ready
  if (editorFocused || dismissed || !hasApiKey || !explanation) {
    return null;
  }

  return (
    <Fade in timeout={400}>
      <ButtonBase
        onClick={handleClick}
        aria-label="Click to edit the ES|QL query"
        sx={{
          position: "absolute",
          zIndex: 2,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: `${height}px`,
          px: 2,
          borderRadius: 1,
          bgcolor: (theme) => alpha(theme.palette.background.default, OVERLAY_BG_ALPHA),
          transition: "background-color 0.2s",
          "&:hover": {
            bgcolor: (theme) => alpha(theme.palette.background.default, OVERLAY_BG_HOVER_ALPHA),
          },
          backdropFilter: "blur(2px)",
          inset: 0,
        }}
      >
        <Typography
          variant="body2"
          sx={{
            maxWidth: "90%",
            color: "text.secondary",
            textAlign: "center",
            lineHeight: 1.6,
            fontStyle: "italic",
          }}
        >
          {explanation}
        </Typography>
      </ButtonBase>
    </Fade>
  );
}
