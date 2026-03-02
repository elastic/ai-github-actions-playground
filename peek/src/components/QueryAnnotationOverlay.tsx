import { useState, useEffect, useCallback, useRef } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

import { useLLMStore } from "../store/useLLMStore";

const EXPLAIN_SYSTEM_PROMPT =
  "You are an ES|QL expert. Given an ES|QL query, provide a brief plain-language " +
  "explanation of what the query does. Be concise — one to three sentences. " +
  "Do not include any code. Do not wrap the response in quotes or markdown.";

/** Cache of query → explanation so we don't re-call the LLM for identical queries. */
const explanationCache = new Map<string, string>();

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
    if (editorFocused || dismissed || !query.trim()) {
      return;
    }

    const cached = explanationCache.get(query);
    if (cached) {
      setExplanation(cached);
      return;
    }

    const { config } = useLLMStore.getState();
    if (!config.apiKey.trim()) {
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    void (async () => {
      try {
        const openai = createOpenAI({
          apiKey: config.apiKey,
          ...(config.provider === "openrouter" ? { baseURL: "https://openrouter.ai/api/v1" } : {}),
        });
        const model =
          config.provider === "openrouter" ? openai.chat(config.model) : openai(config.model);

        const result = await generateText({
          model,
          system: EXPLAIN_SYSTEM_PROMPT,
          messages: [{ role: "user", content: query }],
          abortSignal: controller.signal,
        });

        const text = result.text.trim();
        if (text) {
          explanationCache.set(query, text);
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
  }, [editorFocused, dismissed, query]);

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
        cursor: "pointer",
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
