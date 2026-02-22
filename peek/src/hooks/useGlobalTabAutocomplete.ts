import { useEffect, useRef } from "react";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

import { useLLMStore } from "../store/useLLMStore";

function isEditableTextTarget(
  target: EventTarget | null,
): target is HTMLInputElement | HTMLTextAreaElement {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
    return false;
  }
  if (target.readOnly || target.disabled) return false;
  if (target instanceof HTMLInputElement && target.type === "password") return false;
  return true;
}

export function useGlobalTabAutocomplete() {
  const config = useLLMStore((s) => s.config);
  const isConfigured = useLLMStore((s) => s.isConfigured);
  const pendingRequestsRef = useRef(new WeakMap<Element, AbortController>());
  const activeControllersRef = useRef(new Set<AbortController>());

  useEffect(() => {
    if (!config.tabAutocompleteEnabled || !isConfigured()) return;

    const activeControllers = activeControllersRef.current;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Tab" ||
        event.defaultPrevented ||
        event.shiftKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return;
      }

      if (!isEditableTextTarget(event.target)) return;
      const target = event.target;
      const cursorStart = target.selectionStart ?? target.value.length;
      const cursorEnd = target.selectionEnd ?? cursorStart;
      if (!target.value.trim()) return;
      if (pendingRequestsRef.current.has(target)) return;

      event.preventDefault();

      const controller = new AbortController();
      pendingRequestsRef.current.set(target, controller);
      activeControllers.add(controller);

      const textBefore = target.value.slice(0, cursorStart);
      const textAfter = target.value.slice(cursorEnd);

      const openai = createOpenAI({
        apiKey: config.apiKey,
        ...(config.provider === "openrouter" ? { baseURL: "https://openrouter.ai/api/v1" } : {}),
      });
      const model =
        config.provider === "openrouter" ? openai.chat(config.model) : openai(config.model);

      generateText({
        model,
        system:
          "You complete text inline. Return only the next characters to append, with no explanation.",
        messages: [
          {
            role: "user",
            content:
              `Complete the text at the cursor.\n` +
              `Text before cursor:\n${textBefore}\n` +
              `Text after cursor:\n${textAfter}\n` +
              `Output only the completion text.`,
          },
        ],
        abortSignal: controller.signal,
      })
        .then((result) => {
          const rawCompletion = result.text.trimStart();
          if (!rawCompletion) return;

          // Guard against stale application: only apply if the text around
          // the cursor hasn't changed while the request was in flight.
          const currentBefore = target.value.slice(0, cursorStart);
          const currentAfter = target.value.slice(cursorEnd);
          if (currentBefore !== textBefore || currentAfter !== textAfter) return;

          const completion =
            target instanceof HTMLInputElement ? rawCompletion.split(/\r?\n/, 1)[0] : rawCompletion;
          if (!completion) return;
          target.setRangeText(completion, cursorStart, cursorEnd, "end");
          target.dispatchEvent(new Event("input", { bubbles: true }));
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          console.error("AI tab autocomplete failed:", error);
        })
        .finally(() => {
          pendingRequestsRef.current.delete(target);
          activeControllers.delete(controller);
        });
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      for (const controller of activeControllers) {
        controller.abort();
      }
      activeControllers.clear();
    };
  }, [config, isConfigured]);
}
