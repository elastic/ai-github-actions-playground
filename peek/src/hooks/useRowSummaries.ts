import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { useShallow } from "zustand/react/shallow";

import { useLLMStore } from "../store/useLLMStore";
import type { EsqlColumn } from "../types";

/**
 * Maximum number of concurrent in-flight LLM requests.
 * Kept low (2) to avoid hitting provider rate limits while still
 * allowing the next summary to start before the current one finishes,
 * giving the user a sense of progressive loading.
 */
const MAX_CONCURRENT = 2;

/** Maximum columns included in the LLM prompt to keep token count reasonable. */
const MAX_PROMPT_COLUMNS = 30;
const MAX_PROMPT_VALUE_LENGTH = 500;

const ROW_SUMMARY_SYSTEM_PROMPT =
  "You are a concise data summarizer. " +
  "Given a single row from a query result table (column names and their values), " +
  "provide a brief 1-sentence plain-text summary capturing the most important information. " +
  "Focus on identifying entities, key metrics, timestamps, and notable values. " +
  "Do not use markdown. Do not repeat column names verbatim — paraphrase naturally.";

export interface RowSummaryEntry {
  summary: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Build the user-message context string for a single row.
 */
function buildRowContext(columns: EsqlColumn[], row: unknown[]): string {
  const lines: string[] = [];
  const limit = Math.min(columns.length, MAX_PROMPT_COLUMNS);
  for (let i = 0; i < limit; i++) {
    const col = columns[i]!;
    const value = row[i];
    const raw = value == null ? "null" : String(value);
    const formatted =
      raw.length > MAX_PROMPT_VALUE_LENGTH
        ? `${raw.slice(0, MAX_PROMPT_VALUE_LENGTH)}…[truncated]`
        : raw;
    lines.push(`${col.name} (${col.type}): ${formatted}`);
  }
  if (columns.length > MAX_PROMPT_COLUMNS) {
    lines.push(`... and ${columns.length - MAX_PROMPT_COLUMNS} more columns`);
  }
  return lines.join("\n");
}

/**
 * Produce a stable cache key for a row based on its content.
 * Uses a simple hash of column names + values.
 */
function rowCacheKey(columns: EsqlColumn[], row: unknown[]): string {
  const parts: string[] = [];
  for (let i = 0; i < columns.length; i++) {
    parts.push(`${columns[i]!.name}=${String(row[i] ?? "null")}`);
  }
  return parts.join("\u241F");
}

/**
 * Hook that manages LLM-powered row summarization for a paginated set of visible rows.
 *
 * Summaries are generated on-demand for rows that enter the viewport (tracked via
 * `IntersectionObserver`). Requests are queued and limited to `MAX_CONCURRENT`
 * in-flight calls to avoid flooding the LLM provider.
 *
 * Results are cached by row content so that re-pagination / re-renders reuse
 * previously generated summaries.
 */
export function useRowSummaries(columns: EsqlColumn[], visibleRows: unknown[][], enabled: boolean) {
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
  const isActive = enabled && hasApiKey;

  // Global cache: cacheKey → summary text
  const cacheRef = useRef<Map<string, string>>(new Map());

  // Set of row indices (in current page) that are in the viewport.
  const [visibleIndices, setVisibleIndices] = useState<Set<number>>(new Set());

  // Per-page summaries: rowIndex → RowSummaryEntry
  const [summaries, setSummaries] = useState<Map<number, RowSummaryEntry>>(new Map());

  // Track in-flight count to enforce concurrency limit.
  const inFlightRef = useRef(0);
  const generationRef = useRef(0);

  // Ref to the latest provider config so the async callback always reads fresh values.
  const configRef = useRef({ apiKey, provider, llmModel });
  useEffect(() => {
    configRef.current = { apiKey, provider, llmModel };
  }, [apiKey, provider, llmModel]);

  // Reset summaries when the visible rows change (e.g. pagination, new query).
  const rowsFingerprint = useMemo(
    () => visibleRows.map((r) => rowCacheKey(columns, r)).join("|"),
    [columns, visibleRows],
  );
  useEffect(() => {
    generationRef.current += 1;
    inFlightRef.current = 0;
    // Pre-populate from cache
    const next = new Map<number, RowSummaryEntry>();
    for (let i = 0; i < visibleRows.length; i++) {
      const key = rowCacheKey(columns, visibleRows[i]!);
      const cached = cacheRef.current.get(key);
      if (cached) {
        next.set(i, { summary: cached, loading: false, error: null });
      }
    }
    setSummaries(next);
    setVisibleIndices(new Set(visibleRows.map((_, idx) => idx)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsFingerprint]);

  // ---------------------------------------------------------------------------
  // IntersectionObserver callback registry.
  // Each row cell calls `observeRow(index, element)` when mounted and
  // `unobserveRow(index)` when unmounted.
  // ---------------------------------------------------------------------------
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementMapRef = useRef<Map<number, Element>>(new Map());

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        setVisibleIndices((prev) => {
          let changed = false;
          const next = new Set(prev);
          for (const entry of entries) {
            const idx = Number((entry.target as HTMLElement).dataset.summaryRow);
            if (Number.isNaN(idx)) continue;
            if (entry.isIntersecting && !next.has(idx)) {
              next.add(idx);
              changed = true;
            } else if (!entry.isIntersecting && next.has(idx)) {
              next.delete(idx);
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      },
      { threshold: 0.1 },
    );
    // Re-observe any elements that were registered before the observer was created.
    for (const [, el] of elementMapRef.current) {
      observerRef.current.observe(el);
    }
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  const observeRow = useCallback((index: number, element: Element | null) => {
    const prev = elementMapRef.current.get(index);
    if (prev) {
      observerRef.current?.unobserve(prev);
      elementMapRef.current.delete(index);
    }
    if (element) {
      (element as HTMLElement).dataset.summaryRow = String(index);
      elementMapRef.current.set(index, element);
      observerRef.current?.observe(element);
    }
  }, []);

  const unobserveRow = useCallback((index: number) => {
    const el = elementMapRef.current.get(index);
    if (el) {
      observerRef.current?.unobserve(el);
      elementMapRef.current.delete(index);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Process queue: whenever visible indices or summaries change, kick off
  // LLM requests for rows that are visible but don't have summaries yet.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isActive) return;

    // Find visible rows that need summaries.
    const pending: number[] = [];
    for (const idx of visibleIndices) {
      const existing = summaries.get(idx);
      if (!existing || (!existing.summary && !existing.loading && !existing.error)) {
        // Also skip if already cached
        const row = visibleRows[idx];
        if (!row) continue;
        const key = rowCacheKey(columns, row);
        if (cacheRef.current.has(key)) continue;
        pending.push(idx);
      }
    }

    if (pending.length === 0) return;

    // Sort so earlier rows get processed first.
    pending.sort((a, b) => a - b);

    const available = MAX_CONCURRENT - inFlightRef.current;
    if (available <= 0) return;

    const batch = pending.slice(0, available);
    const generation = generationRef.current;

    // Create the LLM client once per batch (same config for all rows).
    const {
      apiKey: currentApiKey,
      provider: currentProvider,
      llmModel: currentModel,
    } = configRef.current;
    const openai = createOpenAI({
      apiKey: currentApiKey,
      ...(currentProvider === "openrouter" ? { baseURL: "https://openrouter.ai/api/v1" } : {}),
    });
    const model =
      currentProvider === "openrouter" ? openai.chat(currentModel) : openai(currentModel);

    for (const idx of batch) {
      const row = visibleRows[idx];
      if (!row) continue;

      const key = rowCacheKey(columns, row);

      // Mark as loading
      setSummaries((prev) => {
        const next = new Map(prev);
        next.set(idx, { summary: null, loading: true, error: null });
        return next;
      });
      inFlightRef.current += 1;

      const context = buildRowContext(columns, row);

      void generateText({
        model,
        system: ROW_SUMMARY_SYSTEM_PROMPT,
        messages: [{ role: "user", content: context }],
      })
        .then((result) => {
          if (generation !== generationRef.current) return;
          const text = result.text.trim();
          if (text) {
            cacheRef.current.set(key, text);
          }
          setSummaries((prev) => {
            const next = new Map(prev);
            next.set(
              idx,
              text
                ? { summary: text, loading: false, error: null }
                : { summary: null, loading: false, error: "EMPTY_MODEL_OUTPUT" },
            );
            return next;
          });
        })
        .catch((err: unknown) => {
          if (generation !== generationRef.current) return;
          const message = err instanceof Error ? err.message : "Summary failed";
          setSummaries((prev) => {
            const next = new Map(prev);
            next.set(idx, { summary: null, loading: false, error: message });
            return next;
          });
        })
        .finally(() => {
          if (generation !== generationRef.current) return;
          inFlightRef.current -= 1;
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, visibleIndices, summaries, columns, visibleRows]);

  return { summaries, observeRow, unobserveRow };
}
