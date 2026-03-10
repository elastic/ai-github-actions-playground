import { useState, useRef, useCallback, useEffect } from "react";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, stepCountIs } from "ai";

import type { LLMConfig } from "../store/useLLMStore";
import type { ElasticsearchConnection } from "../types";
import { getLocalChatTools } from "../services/chatTools";
import { formatToolResult, type ToolActivity } from "../components/chatUtils";
import { ESQL_SYNTAX_GUIDE } from "../components/esqlSyntaxGuide";

export const MAX_QUESTIONS = 20;
const GAME_TIMEOUT_MS = 60_000;
/** Allow enough steps for the LLM to run queries between questions. */
const GAME_MAX_STEPS = 10;

export interface GameMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolActivity[];
}

export type GameStatus = "idle" | "playing" | "guessing" | "won" | "lost";

function buildSystemPrompt(questionCount: number): string {
  const remaining = MAX_QUESTIONS - questionCount;
  return (
    "You are playing **20 Questions** — a guessing game against a human who is thinking of " +
    "something inside their Elasticsearch cluster. It could be a specific log entry, an index, " +
    "a field value, an error, a service, a host — anything that lives in the cluster.\n\n" +
    "## Game Rules\n" +
    `- You have asked **${questionCount}** questions so far. You have **${remaining}** remaining.\n` +
    `- You may ask at most **${MAX_QUESTIONS}** yes/no questions total.\n` +
    "- The user will answer each question honestly (yes, no, or a short clarification).\n" +
    "- You win if you correctly identify what the user is thinking of before running out of questions.\n" +
    '- When you are confident, say **"My guess:"** followed by your specific answer.\n' +
    "- After guessing, wait for the user to confirm whether you are correct.\n\n" +
    "## Tools & Strategy\n" +
    "You have access to Elasticsearch tools. Use them to explore the cluster and narrow down your guesses:\n" +
    "- **run_esql_query** — Run ES|QL queries to explore data, count records, list distinct values, etc.\n" +
    "- **get_index_info** — Inspect index mappings, settings, and stats.\n" +
    "- **get_cluster_health** — Check cluster health and node statistics.\n\n" +
    "### Recommended approach\n" +
    "1. **Turn 1**: Run a broad discovery query to understand what data exists in the cluster " +
    "(e.g. list indices, count by data_stream.dataset, list services, etc.).\n" +
    "2. **Ask a binary-split question** that divides the remaining possibilities roughly in half.\n" +
    "3. **Run a follow-up query** based on the user's answer to see what matches.\n" +
    "4. **Repeat**: query → ask → refine. Each question should eliminate roughly half the candidates.\n" +
    "5. **Narrow progressively**: Start broad (signal type, index pattern, time range) → " +
    "medium (service name, log level, host) → specific (field values, message content, error details).\n\n" +
    "## Question Guidelines\n" +
    '- Ask exactly **one** question per turn. Number it (e.g. "**Question 3:**").\n' +
    "- Questions must be answerable with yes/no or a very short answer.\n" +
    "- ALWAYS run at least one query per turn — use real cluster data to inform your questions.\n" +
    "- Do NOT repeat a question you already asked.\n\n" +
    "## Response Format\n" +
    "- Be concise. Use markdown for structure.\n" +
    "- Show a brief summary of what you learned from your query, then ask your question.\n" +
    "- Use ES|QL syntax (piped query language, NOT SQL) in fenced ```esql code blocks.\n\n" +
    "## ES|QL Reference\n" +
    "Below is a complete ES|QL syntax guide. Use it to write correct queries.\n\n" +
    ESQL_SYNTAX_GUIDE
  );
}

const QUESTION_LINE_RE =
  /^(?:[-*]\s*)?(?:(?:question\s*\d*[:.)-]?\s*)|(?:q[:.)-]?\s*)|(?:\d+[).:-]\s*)|(?:who|what|when|where|why|how|is|are|am|was|were|can|could|do|does|did|will|would|should|has|have|had|may|might|must)\b)/i;

/** Count the number of likely game questions asked in a response. */
function countQuestions(text: string): number {
  const numbered = text.match(/\bquestion\s+\d+\s*[:\b]/gi);
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
        !line.startsWith("|") &&
        !line.startsWith("//") &&
        !line.startsWith("```") &&
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
    setMessages([]);
    setQuestionCount(0);
    questionCountRef.current = 0;
    setStatus("playing");

    await sendToLLM([]);
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
              ? `🎉 The AI guessed it in ${questionCountRef.current} questions!`
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
    questionCount,
    loading,
    error,
    messagesEndRef,
    startGame,
    handleAnswer,
  };
}
