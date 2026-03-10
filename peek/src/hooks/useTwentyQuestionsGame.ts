import { useState, useRef, useCallback, useEffect } from "react";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, stepCountIs } from "ai";

import type { LLMConfig } from "../store/useLLMStore";
import type { ElasticsearchConnection } from "../types";
import { ElasticsearchClient } from "../services/es";
import { getLocalChatTools } from "../services/chatTools";
import { formatToolResult, type ToolActivity } from "../components/chatUtils";

export const MAX_QUESTIONS = 20;
const SECRET_POOL_SIZE = 200;
const GAME_TIMEOUT_MS = 60_000;
/** Allow enough steps for the LLM to run queries between questions. */
const GAME_MAX_STEPS = 10;

export interface GameMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolActivity[];
}

export type GameStatus = "idle" | "loading" | "playing" | "guessing" | "won" | "lost";

/** Format a single log as a readable key-value block. */
function formatLogEntry(columns: Array<{ name: string; type: string }>, row: unknown[]): string {
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

function buildSystemPrompt(questionCount: number): string {
  const remaining = MAX_QUESTIONS - questionCount;
  return (
    "You are playing a game of 20 Questions to find a specific log entry in an Elasticsearch cluster.\n\n" +
    "## Rules\n" +
    "- The user has a secret log entry from this cluster. It could be ANY log.\n" +
    "- You can run ES|QL queries using the `run_esql_query` tool to search the cluster.\n" +
    "- You can inspect indices with `get_index_info` or check cluster health with `get_cluster_health`.\n" +
    `- You have asked ${questionCount} questions so far. You have ${remaining} questions remaining.\n` +
    `- You have a maximum of ${MAX_QUESTIONS} questions total.\n\n` +
    "## Strategy\n" +
    "1. Start by running a query to discover what data exists (e.g. `FROM logs-* | STATS count=COUNT(*) BY log.level | LIMIT 20`).\n" +
    "2. Ask the user a yes/no question about their log that divides the remaining possibilities roughly in half.\n" +
    "3. Based on their answer, run a refined query to get a sample of matching logs.\n" +
    "4. Examine the sample and ask another narrowing question.\n" +
    "5. Repeat: query → ask → refine. Each question should eliminate roughly half the remaining candidates.\n" +
    '6. When you\'re confident, say **"My guess:"** followed by the specific log details.\n\n' +
    "## Question Guidelines\n" +
    '- Ask 1–2 questions per turn. Number each question (e.g. "Question 1:").\n' +
    "- Make questions answerable with yes/no or short answers.\n" +
    "- Start broad: index pattern, log level, service name, time range.\n" +
    "- Then narrow: specific field values, message content, error types.\n" +
    "- ALWAYS run a query before or after asking a question — use the data to guide your strategy.\n\n" +
    "## Important\n" +
    "- Use ES|QL syntax (piped query language), NOT SQL.\n" +
    "- Be concise. Use markdown for structure.\n" +
    "- After guessing, wait for the user to confirm if you are correct."
  );
}

const QUESTION_LINE_RE =
  /^(?:[-*]\s*)?(?:(?:question\s*\d*[:.)-]?\s*)|(?:q[:.)-]?\s*)|(?:\d+[).:-]\s*)|(?:who|what|when|where|why|how|is|are|am|was|were|can|could|do|does|did|will|would|should|has|have|had|may|might|must)\b)/i;

/** Count the number of likely game questions asked in a response. */
function countQuestions(text: string): number {
  const numbered = text.match(/\bquestion\s+\d+/gi);
  if (numbered && numbered.length > 0) return numbered.length;

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.endsWith("?") &&
        line.length > 0 &&
        line.length <= 120 &&
        !line.startsWith("(") &&
        QUESTION_LINE_RE.test(line),
    );

  return lines.length;
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const questionCountRef = useRef(0);

  const updateAssistantMessage = useCallback(
    (id: string, updates: { content?: string; toolCalls?: ToolActivity[] }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m;
          return {
            ...m,
            ...(updates.content !== undefined ? { content: updates.content } : {}),
            ...(updates.toolCalls !== undefined ? { toolCalls: updates.toolCalls } : {}),
          };
        }),
      );
    },
    [],
  );

  const sendToLLM = useCallback(
    async (conversationMessages: GameMessage[]) => {
      if (!connection) return;
      setLoading(true);
      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", toolCalls: [] },
      ]);

      try {
        const openai = createOpenAI({
          apiKey: config.apiKey,
          ...(config.provider === "openrouter" ? { baseURL: "https://openrouter.ai/api/v1" } : {}),
        });
        const model =
          config.provider === "openrouter" ? openai.chat(config.model) : openai(config.model);

        const tools = getLocalChatTools(connection);
        const systemPrompt = buildSystemPrompt(questionCountRef.current);

        const result = streamText({
          model,
          system: systemPrompt,
          messages: conversationMessages
            .filter((m) => m.role !== "system")
            .map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          tools,
          stopWhen: stepCountIs(GAME_MAX_STEPS),
          abortSignal: AbortSignal.timeout(GAME_TIMEOUT_MS),
        });

        let text = "";
        let toolCalls: ToolActivity[] = [];
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            text += part.text;
            updateAssistantMessage(assistantId, { content: text });
          } else if (part.type === "tool-call") {
            toolCalls = [...toolCalls, { toolCallId: part.toolCallId, name: part.toolName }];
            updateAssistantMessage(assistantId, { toolCalls });
          } else if (part.type === "tool-result") {
            toolCalls = toolCalls.map((tc) =>
              tc.toolCallId === part.toolCallId
                ? { ...tc, result: formatToolResult(part.toolName, part.output) }
                : tc,
            );
            updateAssistantMessage(assistantId, { toolCalls });
          }
        }

        const newQuestions = countQuestions(text);
        if (newQuestions > 0) {
          questionCountRef.current += newQuestions;
          setQuestionCount(questionCountRef.current);
        }
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
    [config, connection, updateAssistantMessage],
  );

  const startGame = useCallback(async () => {
    if (!connection || !configured) return;

    setError(null);
    setStatus("loading");
    setMessages([]);
    setSecretLog(null);
    setQuestionCount(0);
    questionCountRef.current = 0;

    try {
      const client = new ElasticsearchClient(connection);
      const response = await client.query(
        { query: `FROM logs-* | SORT @timestamp DESC | LIMIT ${SECRET_POOL_SIZE}` },
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
      setSecretLog(formatLogEntry(columns, secretRow));
      setStatus("playing");

      await sendToLLM([]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Failed to start game: ${msg}`);
      setStatus("idle");
    }
  }, [connection, configured, sendToLLM]);

  const handleAnswer = useCallback(
    async (answer: string) => {
      const userMsg: GameMessage = { id: crypto.randomUUID(), role: "user", content: answer };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);

      if (status === "guessing") {
        const lower = answer.toLowerCase().trim();
        const isCorrect = lower === "yes" || lower === "yes, that's correct!";
        setStatus(isCorrect ? "won" : "lost");
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "system",
            content: isCorrect
              ? "🎉 The AI found the log!"
              : "The AI's guess was wrong. Better luck next time!",
          },
        ]);
        return;
      }

      if (questionCountRef.current >= MAX_QUESTIONS) {
        // Final turn — force a guess.
        const finalPrompt: GameMessage = {
          id: crypto.randomUUID(),
          role: "user",
          content: answer + "\n\n(You have used all your questions. Make your final guess now.)",
        };
        await sendToLLM([...messages, finalPrompt]);
        setStatus("guessing");
        return;
      }

      await sendToLLM(updatedMessages);
    },
    [messages, status, sendToLLM],
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
