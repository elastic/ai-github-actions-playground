import { useState, useRef, useCallback } from "react";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, stepCountIs } from "ai";

import type { LLMConfig } from "../store/useLLMStore";
import type { ElasticsearchConnection } from "../types";
import { ElasticsearchClient } from "../services/es";

export const MAX_QUESTIONS = 20;
const LOG_POOL_SIZE = 50;
const GAME_TIMEOUT_MS = 30_000;

export interface GameMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

export type GameStatus = "idle" | "loading" | "playing" | "guessing" | "won" | "lost";

/** Build a compact summary of the log pool for the LLM (field names + distinct values). */
function buildFieldSummary(
  columns: Array<{ name: string; type: string }>,
  rows: unknown[][],
): string {
  const lines: string[] = [];
  for (let c = 0; c < columns.length; c++) {
    const col = columns[c]!;
    const distinctValues = new Set<string>();
    for (const row of rows) {
      const val = row[c];
      if (val != null) distinctValues.add(String(val).slice(0, 120));
      if (distinctValues.size >= 15) break;
    }
    if (distinctValues.size > 0) {
      const vals = [...distinctValues].join(", ");
      lines.push(`- ${col.name} (${col.type}): ${vals}${distinctValues.size >= 15 ? ", …" : ""}`);
    } else {
      lines.push(`- ${col.name} (${col.type}): (all null)`);
    }
  }
  return lines.join("\n");
}

/** Format a single log as a readable key-value block. */
export function formatLogEntry(
  columns: Array<{ name: string; type: string }>,
  row: unknown[],
): string {
  return columns
    .map((col, i) => {
      const val = row[i];
      if (val == null) return null;
      const display = typeof val === "string" ? val : JSON.stringify(val);
      return `**${col.name}**: ${display.length > 200 ? `${display.slice(0, 200)}…` : display}`;
    })
    .filter(Boolean)
    .join("\n");
}

function buildSystemPrompt(fieldSummary: string, totalLogs: number): string {
  return (
    `You are playing a game of 20 Questions to find a specific log entry.\n\n` +
    `## Rules\n` +
    `- The user has a secret log entry chosen from a pool of ${totalLogs} recent logs.\n` +
    `- Ask yes/no questions to narrow down which log it is.\n` +
    `- Ask 1–2 questions per turn. Number each question (e.g. "Question 1:").\n` +
    `- You have a maximum of ${MAX_QUESTIONS} questions total.\n` +
    `- Base your questions on the available fields and their known values.\n` +
    `- Use a binary-search strategy: start broad (field existence, log level, service name) then get specific.\n` +
    `- When you are confident, make your guess by saying **"My guess:"** followed by a description of the log.\n` +
    `- After guessing, wait for the user to confirm if you are correct.\n\n` +
    `## Available fields and sample values\n` +
    `${fieldSummary}\n\n` +
    `Start by asking your first question.`
  );
}

/** Stream a single LLM response and return the full text. */
async function streamLLMResponse(
  config: LLMConfig,
  systemPrompt: string,
  conversationMessages: GameMessage[],
  onUpdate: (id: string, text: string) => void,
  assistantId: string,
): Promise<string> {
  const openai = createOpenAI({
    apiKey: config.apiKey,
    ...(config.provider === "openrouter" ? { baseURL: "https://openrouter.ai/api/v1" } : {}),
  });
  const model = config.provider === "openrouter" ? openai.chat(config.model) : openai(config.model);

  const result = streamText({
    model,
    system: systemPrompt,
    messages: conversationMessages.map((m) => ({
      role: m.role === "system" ? ("user" as const) : (m.role as "user" | "assistant"),
      content: m.content,
    })),
    stopWhen: stepCountIs(1),
    abortSignal: AbortSignal.timeout(GAME_TIMEOUT_MS),
  });

  let text = "";
  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      text += part.text;
      onUpdate(assistantId, text);
    }
  }
  return text;
}

/** Count the number of questions asked in a response. */
function countQuestions(text: string): number {
  const numbered = text.match(/\bquestion\s+\d+/gi);
  if (numbered && numbered.length > 0) return numbered.length;
  return (text.match(/\?/g) ?? []).length;
}

export function useTwentyQuestionsGame(
  config: LLMConfig,
  connection: ElasticsearchConnection | null,
  configured: boolean,
) {
  const [status, setStatus] = useState<GameStatus>("idle");
  const [messages, setMessages] = useState<GameMessage[]>([]);
  const [secretLog, setSecretLog] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const gameContextRef = useRef<{ fieldSummary: string; totalLogs: number } | null>(null);

  const updateMessage = useCallback((id: string, content: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content } : m)));
  }, []);

  const sendToLLM = useCallback(
    async (systemPrompt: string, conversationMessages: GameMessage[]) => {
      setLoading(true);
      const assistantId = crypto.randomUUID();
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

      try {
        const text = await streamLLMResponse(
          config,
          systemPrompt,
          conversationMessages,
          updateMessage,
          assistantId,
        );

        setQuestionCount((prev) => prev + countQuestions(text));
        if (/my guess[:\s]/i.test(text)) setStatus("guessing");
      } catch (e: unknown) {
        const msg =
          e instanceof DOMException && (e.name === "AbortError" || e.name === "TimeoutError")
            ? "Request timed out. Please try again."
            : e instanceof Error
              ? e.message
              : String(e);
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [config, updateMessage],
  );

  const startGame = useCallback(async () => {
    if (!connection || !configured) return;

    setError(null);
    setStatus("loading");
    setMessages([]);
    setSecretLog(null);
    setQuestionCount(0);

    try {
      const client = new ElasticsearchClient(connection);
      const response = await client.query(
        { query: `FROM logs-* | SORT @timestamp DESC | LIMIT ${LOG_POOL_SIZE}` },
        AbortSignal.timeout(GAME_TIMEOUT_MS),
      );

      const { columns, values } = response;
      if (!values || values.length === 0) {
        setError("No logs found. Make sure you have log data in your Elasticsearch cluster.");
        setStatus("idle");
        return;
      }

      const secretIndex = Math.floor(Math.random() * values.length);
      const secretRow = values[secretIndex]!;
      const fieldSummary = buildFieldSummary(columns, values);
      const formattedSecret = formatLogEntry(columns, secretRow);

      gameContextRef.current = { fieldSummary, totalLogs: values.length };
      setSecretLog(formattedSecret);
      setStatus("playing");

      const systemPrompt = buildSystemPrompt(fieldSummary, values.length);
      await sendToLLM(systemPrompt, []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Failed to start game: ${msg}`);
      setStatus("idle");
    }
  }, [connection, configured, sendToLLM]);

  const handleAnswer = useCallback(
    async (answer: string) => {
      if (!gameContextRef.current) return;

      const userMsg: GameMessage = { id: crypto.randomUUID(), role: "user", content: answer };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);

      if (status === "guessing") {
        const isCorrect =
          answer.toLowerCase().includes("correct") || answer.toLowerCase() === "yes";
        setStatus(isCorrect ? "won" : "lost");
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "system",
            content: isCorrect
              ? "🎉 The AI guessed correctly!"
              : "The AI's guess was wrong. Better luck next time!",
          },
        ]);
        return;
      }

      if (questionCount >= MAX_QUESTIONS) {
        setStatus("lost");
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "system",
            content: `The AI used all ${MAX_QUESTIONS} questions without guessing correctly. Game over!`,
          },
        ]);
        return;
      }

      const { fieldSummary, totalLogs } = gameContextRef.current;
      const systemPrompt = buildSystemPrompt(fieldSummary, totalLogs);
      await sendToLLM(systemPrompt, updatedMessages);
    },
    [messages, status, questionCount, sendToLLM],
  );

  return {
    status,
    messages,
    secretLog,
    questionCount,
    loading,
    error,
    messagesEndRef,
    startGame,
    handleAnswer,
  };
}
