import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LlmSettings } from "../types";

function getModel(settings: LlmSettings) {
  if (settings.provider === "openai") {
    const openai = createOpenAI({ apiKey: settings.apiKey });
    return openai(settings.model);
  }
  if (settings.provider === "anthropic") {
    const anthropic = createAnthropic({ apiKey: settings.apiKey });
    return anthropic(settings.model);
  }
  const google = createGoogleGenerativeAI({ apiKey: settings.apiKey });
  return google(settings.model);
}

export async function generateChatReply(settings: LlmSettings, prompt: string): Promise<string> {
  const model = getModel(settings);
  const { text } = await generateText({
    model,
    prompt,
    system: "You are a concise assistant helping with Elasticsearch and dashboard exploration.",
  });
  return text;
}
