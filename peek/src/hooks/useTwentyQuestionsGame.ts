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
const STRICT_GUESS_RE = /^\s*my guess:\s*/im;

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
    "## Tools\n" +
    "You have access to Elasticsearch tools:\n" +
    "- **run_esql_query** — Run ES|QL queries to explore data, count records, list distinct values, etc.\n" +
    "- **get_index_info** — Inspect index mappings, settings, and stats.\n" +
    "- **get_cluster_health** — Check cluster health and node statistics.\n\n" +
    "## Strategy: Information-Theoretic Binary Splitting\n" +
    "Your goal is to **maximize information gain per question**. Each question should eliminate\n" +
    "roughly **half** the remaining possibility space — like a binary search.\n\n" +
    "### How to split effectively\n" +
    "Think in **dimensions**, not individual candidates. Narrow one dimension at a time:\n\n" +
    "| Phase | Dimension | Example question |\n" +
    "|-------|-----------|------------------|\n" +
    '| 1. Kind | Structural vs data | "Is it a piece of data (document/value) rather than a structural element (index/field/mapping)?" |\n' +
    '| 2. Signal type | logs / metrics / traces | "Does it come from trace data?" |\n' +
    '| 3. Recency | Time-based split | "Did it occur in the last 24 hours?" |\n' +
    '| 4. Cardinality | High vs low volume | "Does the thing you\'re thinking of appear more than 10,000 times?" |\n' +
    '| 5. Category group | Split by attribute | "Is the service name in the first half alphabetically (a–m)?" |\n' +
    '| 6. Specific attribute | Field value / content | "Does it contain an error or exception?" |\n' +
    "| 7. Identity | Final narrowing | \"Is it the 'connection timeout' error from payment-service?\" |\n\n" +
    "### Critical rules\n" +
    "- **NEVER enumerate candidates one by one.** If you have 10 services, do NOT ask about each\n" +
    '  service individually. Instead, split them: "Is the service one of [redis, postgres, api-gateway,\n' +
    '  frontend-web, auth-service]?" (the top 5 by volume). One question eliminates half the list.\n' +
    "- **Use multiple dimensions.** Don't just narrow by service name. Cross-cut with time ranges,\n" +
    "  field types, numeric thresholds, status codes, log levels, etc. Each dimension is an\n" +
    "  independent axis of information.\n" +
    "- **Run aggregation queries to find the split point.** Before asking, query to find the median\n" +
    "  or natural grouping. For example, query `STATS count = COUNT(*) BY service.name` then split\n" +
    "  services into two groups of roughly equal total count.\n" +
    "- **Ask about properties, not identities.** Early questions should be about characteristics\n" +
    '  ("Is it numeric?", "Does it relate to errors?", "Is it from an external-facing service?")\n' +
    "  rather than specific names. Properties cross-cut many candidates at once.\n" +
    "- **Only guess a specific item when you have ≤3 candidates left**, or when you are highly\n" +
    "  confident based on converging evidence.\n\n" +
    "### Turn structure\n" +
    "1. **Query** the cluster to understand the current possibility space.\n" +
    "2. **Identify the best split** — which question divides the remaining candidates closest to 50/50?\n" +
    "3. **Ask** exactly one numbered question.\n" +
    "4. After the user answers, **refine** your mental model and repeat.\n\n" +
    "## Question Guidelines\n" +
    '- Ask exactly **one** question per turn. Number it (e.g. "**Question 3:**").\n' +
    (remaining === 1
      ? '- You have only one question left: ask exactly one numbered yes/no question OR provide your final guess now using "My guess:".\n'
      : "") +
    "- Questions must be answerable with yes/no or a very short answer.\n" +
    "- ALWAYS run at least one query per turn — use real cluster data to inform your questions.\n" +
    "- Do NOT repeat a question you already asked.\n\n" +
    "## Response Format\n" +
    "- **Be extremely concise.** Your visible response should be 2-4 sentences max.\n" +
    "- Do NOT dump raw query results, cluster stats, or long lists into your response.\n" +
    '  Summarize what you learned in one short sentence (e.g. "I found 11 services with traces data."),\n' +
    "  then immediately ask your question.\n" +
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
  const messagesRef = useRef<GameMessage[]>([]);
  const inFlightRef = useRef(false);

  useEffect(() => {
    messagesRef.current = messages;
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
      if (!connection || inFlightRef.current) return false;
      inFlightRef.current = true;
      setError(null);
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
          const remainingQuestions = Math.max(0, MAX_QUESTIONS - questionCountRef.current);
          questionCountRef.current += Math.min(newQuestions, remainingQuestions);
          setQuestionCount(questionCountRef.current);
        }
        const hasGuess = STRICT_GUESS_RE.test(text);
        if (hasGuess) setStatus("guessing");
        return hasGuess;
      } catch (e: unknown) {
        const msg =
          e instanceof DOMException && (e.name === "AbortError" || e.name === "TimeoutError")
            ? "Request timed out. Please try again."
            : e instanceof Error
              ? e.message
              : String(e);
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        setError(msg);
        return false;
      } finally {
        inFlightRef.current = false;
        setLoading(false);
      }
    },
    [config, connection, updateAssistantMessage],
  );

  const startGame = useCallback(async () => {
    if (!connection || !configured || inFlightRef.current) return;

    setError(null);
    setMessages([]);
    setQuestionCount(0);
    questionCountRef.current = 0;
    setStatus("playing");

    // Send an opening user message so the LLM has something to respond to.
    // Without this, some providers ignore an empty messages array.
    const kickoff: GameMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content:
        "I'm thinking of something in my Elasticsearch cluster. Start the game — explore the cluster and ask your first question!",
    };
    await sendToLLM([kickoff]);
  }, [connection, configured, sendToLLM]);

  const handleAnswer = useCallback(
    async (answer: string) => {
      if (inFlightRef.current) return;
      const userMsg: GameMessage = { id: crypto.randomUUID(), role: "user", content: answer };
      const updatedMessages = [...messagesRef.current, userMsg];
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
        await sendToLLM([...messagesRef.current, finalPrompt]);
        return;
      }

      await sendToLLM(updatedMessages);
    },
    [status, sendToLLM],
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
