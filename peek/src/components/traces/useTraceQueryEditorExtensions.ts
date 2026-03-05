import { useMemo, useRef, useEffect } from "react";
import { EditorView } from "@codemirror/view";
import { EditorState, Prec } from "@codemirror/state";
import { SQLDialect } from "@codemirror/lang-sql";

import { createEsqlQueryEditorExtensions } from "../queryEditorExtensions";
import { makeLLMCompletionExtension } from "../llmCompletionExtension";

/** Base ES|QL extensions (SQL dialect, line wrapping, LLM completion) shared across trace editors. */
export function useTraceQueryEditorExtensions(onRun: () => void) {
  const onRunRef = useRef(onRun);
  useEffect(() => {
    onRunRef.current = onRun;
  }, [onRun]);

  return useMemo(
    () => [
      SQLDialect.define({ slashComments: true }).language,
      Prec.highest(
        EditorState.languageData.of(() => [
          { commentTokens: { line: "//", block: { open: "/*", close: "*/" } } },
        ]),
      ),
      EditorView.lineWrapping,
      // eslint-disable-next-line react-hooks/refs -- callback invoked on keypress, ref read is deferred
      ...createEsqlQueryEditorExtensions(() => onRunRef.current()),
      makeLLMCompletionExtension({
        prompt:
          "You are an ES|QL inline completion engine for OpenTelemetry trace data. " +
          "The primary index is traces-*-* with OTEL fields: " +
          "trace.id, span.id, parent_span.id, service.name, span.name, " +
          "span.kind, span.duration.us, span.status.code, @timestamp.\n" +
          "- ES|QL is a piped language (FROM … | WHERE … | STATS …), NOT SQL.\n" +
          "- If a query error is shown, fix the error.\n" +
          "- If the user writes natural language, replace it with valid ES|QL.\n" +
          "- Return ONLY query text. No explanations, no markdown fences.",
        esqlGuide: true,
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable ref, no deps needed
    [],
  );
}
