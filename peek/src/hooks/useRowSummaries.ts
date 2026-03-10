import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { useShallow } from "zustand/react/shallow";

import { useLLMStore } from "../store/useLLMStore";
import type { EsqlColumn } from "../types";
import { cellToKeyString } from "../utils/cellToKeyString";

/** Maximum non-null columns included per row in the LLM prompt. */
const MAX_PROMPT_COLUMNS = 16;
const SUMMARY_REQUEST_TIMEOUT_MS = 30000;

const ROW_SUMMARY_SYSTEM_PROMPT =
  "You are a concise data summarizer. " +
  "Given multiple rows from a query result table (column names and values), " +
  "write a TL;DR in exactly one short sentence (max 18 words). " +
  "Prioritize the main signal: entity, status, and the most important metric/value. " +
  "Do not mention timestamps or exact times unless time is the primary anomaly. " +
  "Do not use markdown. Do not repeat column names verbatim - paraphrase naturally. " +
  "Return ONLY JSON in this exact format: " +
  '{"summaries":[{"rowIndex":0,"summary":"string"}]}. ' +
  "Include exactly one entry for each provided rowIndex.";

export interface RowSummaryEntry {
  summary: string | null;
  loading: boolean;
  error: string | null;
}

function buildRowContext(columns: EsqlColumn[], row: unknown[]): string {
  const lines: string[] = [];
  let omittedNonNull = 0;

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]!;
    const value = row[i];
    if (value == null) continue;
    if (typeof value === "string" && value.trim().length === 0) continue;

    if (lines.length >= MAX_PROMPT_COLUMNS) {
      omittedNonNull += 1;
      continue;
    }

    lines.push(`${col.name} (${col.type}): ${String(value)}`);
  }

  if (omittedNonNull > 0) {
    lines.push(`... and ${omittedNonNull} more non-null columns`);
  }
  if (lines.length === 0) return "No non-null values in this row.";
  return lines.join("\n");
}

function buildPageContext(
  columns: EsqlColumn[],
  rows: Array<{ rowIndex: number; row: unknown[] }>,
): string {
  return rows
    .map(({ rowIndex, row }) => `ROW_INDEX: ${rowIndex}\n${buildRowContext(columns, row)}`)
    .join("\n\n");
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

function parseBatchSummaries(rawText: string): Map<number, string> {
  const parsed = parseJsonObjectFromText(rawText);
  if (typeof parsed !== "object" || parsed === null) {
    console.warn("parseBatchSummaries: parsed response is not an object", { parsed, rawText });
    return new Map();
  }
  const summaries = (parsed as { summaries?: unknown }).summaries;
  if (!Array.isArray(summaries)) {
    console.warn("parseBatchSummaries: missing or invalid 'summaries' array", { parsed, rawText });
    return new Map();
  }

  const rows = summaries as Array<{ rowIndex?: number; summary?: string }>;
  const result = new Map<number, string>();
  for (const entry of rows) {
    const idx = entry.rowIndex;
    const summary = entry.summary?.trim();
    if (typeof idx === "number" && Number.isFinite(idx) && summary) {
      result.set(idx, summary);
    }
  }
  return result;
}

function rowCacheKey(columns: EsqlColumn[], row: unknown[]): string {
  const parts: string[] = [];
  for (let i = 0; i < columns.length; i++) {
    parts.push(`${columns[i]!.name}=${cellToKeyString(row[i])}`);
  }
  return parts.join("\u241F");
}

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

  const cacheRef = useRef<Map<string, string>>(new Map());
  const [summaries, setSummaries] = useState<Map<number, RowSummaryEntry>>(new Map());
  const [visibleIndices, setVisibleIndices] = useState<Set<number>>(new Set());

  const generationRef = useRef(0);
  const inFlightIndicesRef = useRef<Set<number>>(new Set());
  const observerSettledRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementMapRef = useRef<Map<number, Element>>(new Map());

  const configRef = useRef({ apiKey, provider, llmModel });
  useEffect(() => {
    configRef.current = { apiKey, provider, llmModel };
  }, [apiKey, provider, llmModel]);

  const rowsFingerprint = useMemo(
    () => visibleRows.map((r) => rowCacheKey(columns, r)).join("|"),
    [columns, visibleRows],
  );

  useEffect(() => {
    generationRef.current += 1;
    inFlightIndicesRef.current = new Set();
    observerSettledRef.current = false;

    const next = new Map<number, RowSummaryEntry>();
    for (let i = 0; i < visibleRows.length; i++) {
      const key = rowCacheKey(columns, visibleRows[i]!);
      const cached = cacheRef.current.get(key);
      if (cached) {
        next.set(i, { summary: cached, loading: false, error: null });
      }
    }
    setSummaries(next);
    setVisibleIndices(new Set());
  }, [rowsFingerprint, columns, visibleRows]);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries.length > 0) observerSettledRef.current = true;
        setVisibleIndices((prev) => {
          const next = new Set(prev);
          let changed = false;
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

    for (const [, el] of elementMapRef.current) {
      observerRef.current.observe(el);
    }

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      elementMapRef.current.clear();
    };
  }, []);

  const requestBatch = useCallback(
    (indices: number[]) => {
      if (!isActive || indices.length === 0) return undefined;

      const generation = generationRef.current;
      const pending = indices.filter((idx) => {
        if (inFlightIndicesRef.current.has(idx)) return false;
        const row = visibleRows[idx];
        if (!row) return false;
        const key = rowCacheKey(columns, row);
        return !cacheRef.current.has(key);
      });
      if (pending.length === 0) return undefined;

      pending.forEach((idx) => {
        inFlightIndicesRef.current.add(idx);
      });

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

      setSummaries((prev) => {
        const next = new Map(prev);
        for (const idx of pending) {
          next.set(idx, { summary: null, loading: true, error: null });
        }
        return next;
      });

      const context = buildPageContext(
        columns,
        pending.map((idx) => ({ rowIndex: idx, row: visibleRows[idx]! })),
      );

      const controller = new AbortController();
      let timedOut = false;
      const timeoutId = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, SUMMARY_REQUEST_TIMEOUT_MS);
      void generateText({
        model,
        system: ROW_SUMMARY_SYSTEM_PROMPT,
        messages: [{ role: "user", content: context }],
        abortSignal: controller.signal,
      })
        .then((result) => {
          if (generation !== generationRef.current) return;

          const parsedSummaries = parseBatchSummaries(result.text);
          setSummaries((prev) => {
            const next = new Map(prev);
            for (const idx of pending) {
              const row = visibleRows[idx];
              if (!row) continue;
              const summary = parsedSummaries.get(idx)?.trim() ?? "";
              if (summary) {
                const key = rowCacheKey(columns, row);
                cacheRef.current.set(key, summary);
                next.set(idx, { summary, loading: false, error: null });
              } else {
                next.set(idx, { summary: null, loading: false, error: "EMPTY_MODEL_OUTPUT" });
              }
            }
            return next;
          });
        })
        .catch((err: unknown) => {
          if (generation !== generationRef.current) return;
          if (err instanceof Error && err.name === "AbortError" && !timedOut) return;
          const message =
            err instanceof Error
              ? err.name === "AbortError"
                ? "Summary request timed out"
                : err.message
              : "Summary failed";
          setSummaries((prev) => {
            const next = new Map(prev);
            for (const idx of pending) {
              next.set(idx, { summary: null, loading: false, error: message });
            }
            return next;
          });
        })
        .finally(() => {
          pending.forEach((idx) => {
            inFlightIndicesRef.current.delete(idx);
          });
          window.clearTimeout(timeoutId);
        });

      return () => {
        controller.abort();
        window.clearTimeout(timeoutId);
      };
    },
    [isActive, columns, visibleRows],
  );

  useEffect(() => {
    const indices = Array.from(visibleIndices)
      .filter((idx) => idx >= 0 && idx < visibleRows.length)
      .sort((a, b) => a - b);
    return requestBatch(indices);
  }, [requestBatch, visibleIndices, rowsFingerprint, visibleRows.length]);

  useEffect(() => {
    // Wait for IntersectionObserver entries before backfilling non-visible rows to avoid full-table first-render batches.
    if (!observerSettledRef.current && elementMapRef.current.size > 0) return;
    const nonVisible = Array.from({ length: visibleRows.length }, (_, idx) => idx).filter(
      (idx) => !visibleIndices.has(idx),
    );
    return requestBatch(nonVisible);
  }, [requestBatch, visibleIndices, rowsFingerprint, visibleRows.length]);

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

  return { summaries, observeRow, unobserveRow };
}
