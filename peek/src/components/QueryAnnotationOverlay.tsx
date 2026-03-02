import { useState, useEffect, useCallback, useRef } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { useShallow } from "zustand/react/shallow";

import { useLLMStore } from "../store/useLLMStore";

const EXPLAIN_SYSTEM_PROMPT =
  "You are an ES|QL expert. Given an ES|QL query, provide a brief plain-language " +
  "explanation of what the query does. Be concise — one to three sentences. " +
  "Do not include any code. Do not wrap the response in quotes or markdown.";

const MAX_CACHE_SIZE = 50;

/** LRU-bounded cache of query → explanation. */
const explanationCache = new Map<string, string>();

function cacheSet(key: string, value: string) {
  explanationCache.delete(key);
  explanationCache.set(key, value);
  if (explanationCache.size > MAX_CACHE_SIZE) {
    const oldest = explanationCache.keys().next().value;
    if (oldest !== undefined) explanationCache.delete(oldest);
  }
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
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const lastQueryRef = useRef(query);

  // Reset dismissed state when the query changes
  useEffect(() => {
    if (query !== lastQueryRef.current) {
      lastQueryRef.current = query;
      setDismissed(false);
      setExplanation(null);
    }
  }, [query]);

  // Fetch explanation when unfocused, not dismissed, and query is non-trivial
  useEffect(() => {
    if (editorFocused || dismissed || !query.trim() || !apiKey.trim()) {
      return;
    }

    const cached = explanationCache.get(query);
    if (cached) {
      setExplanation(cached);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    void (async () => {
      try {
        const openai = createOpenAI({
          apiKey,
          ...(provider === "openrouter" ? { baseURL: "https://openrouter.ai/api/v1" } : {}),
        });
        const model = provider === "openrouter" ? openai.chat(llmModel) : openai(llmModel);

        const result = await generateText({
          model,
          system: EXPLAIN_SYSTEM_PROMPT,
          messages: [{ role: "user", content: query }],
          abortSignal: controller.signal,
        });

        const text = result.text.trim();
        if (text) {
          cacheSet(query, text);
          setExplanation(text);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Query annotation failed:", err);
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [editorFocused, dismissed, query, apiKey, provider, llmModel]);

  const handleClick = useCallback(() => {
    setDismissed(true);
  }, []);

  // Don't render when focused, dismissed, or no content
  if (editorFocused || dismissed || (!explanation && !loading)) {
    return null;
  }

  return (
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
        bgcolor: "background.default",
        opacity: 0.94,
        transition: "opacity 0.2s",
        "&:hover": { opacity: 0.85 },
        backdropFilter: "blur(2px)",
        inset: 0,
      }}
    >
      {loading ? (
        <Box sx={{ width: "60%" }}>
          <LinearProgress />
        </Box>
      ) : (
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
      )}
    </ButtonBase>
  );
}
