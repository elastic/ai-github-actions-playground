import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import SendIcon from "@mui/icons-material/Send";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SettingsIcon from "@mui/icons-material/Settings";
import { useShallow } from "zustand/react/shallow";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

import { useLLMStore, type ChatMessage } from "../store/useLLMStore";
import { PAGE_MANIFEST } from "../routes/manifest";
import { useConnectionStore } from "../store/useConnectionStore";
import { buildChatRuntime, getChatRequestTimeoutMs } from "../services/chatRuntime";
import { useChatScreenContextSummary } from "../hooks/useChatScreenContextSummary";

export default function ChatPage({ hideHeader = false }: { hideHeader?: boolean }) {
  const {
    config,
    messages,
    addMessage,
    updateMessage,
    removeMessage,
    clearMessages,
    isConfigured,
    pendingPrompt,
    setPendingPrompt,
  } = useLLMStore(
    useShallow((s) => ({
      config: s.config,
      messages: s.messages,
      addMessage: s.addMessage,
      updateMessage: s.updateMessage,
      removeMessage: s.removeMessage,
      clearMessages: s.clearMessages,
      isConfigured: s.isConfigured,
      pendingPrompt: s.pendingPrompt,
      setPendingPrompt: s.setPendingPrompt,
    })),
  );

  const navigate = useNavigate();
  const location = useLocation();
  const connection = useConnectionStore((s) => s.connection);
  const screenContextSummary = useChatScreenContextSummary(location.pathname);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const configured = isConfigured();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages]);

  // Consume pending prompts (e.g. from click-to-explain)
  const handleSendRef = useRef<(prompt: string) => void>();

  useEffect(() => {
    if (pendingPrompt && !loading && configured) {
      const prompt = pendingPrompt;
      setPendingPrompt(null);
      handleSendRef.current?.(prompt);
    }
  }, [pendingPrompt, loading, configured, setPendingPrompt]);

  const handleSend = useCallback(
    async (promptOverride?: string) => {
      const trimmed = promptOverride?.trim() ?? input.trim();
      if (!trimmed || loading || !configured) return;

      setError(null);
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
      };
      addMessage(userMessage);
      if (!promptOverride) setInput("");

      const assistantId = crypto.randomUUID();
      addMessage({ id: assistantId, role: "assistant", content: "" });
      setLoading(true);

      const controller = new AbortController();
      const timeoutMs = getChatRequestTimeoutMs(config);
      const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

      try {
        const { systemPrompt, tools, stopWhen } = await buildChatRuntime({
          config,
          connection,
          pathname: location.pathname,
          screenContextSummary,
          signal: controller.signal,
          navigate,
        });

        const openai = createOpenAI({
          apiKey: config.apiKey,
          ...(config.provider === "openrouter" ? { baseURL: "https://openrouter.ai/api/v1" } : {}),
        });
        const model =
          config.provider === "openrouter" ? openai.chat(config.model) : openai(config.model);
        const result = await generateText({
          model,
          system: systemPrompt,
          messages: [
            ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
            { role: "user" as const, content: trimmed },
          ],
          tools,
          ...(stopWhen ? { stopWhen } : {}),
          abortSignal: controller.signal,
        });

        updateMessage(assistantId, result.text);
      } catch (e) {
        const errorMessage =
          e instanceof DOMException && e.name === "AbortError"
            ? "Request timed out. Please try again."
            : e instanceof Error
              ? e.message
              : String(e);
        removeMessage(assistantId);
        setError(errorMessage);
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    },
    [
      input,
      loading,
      configured,
      config,
      messages,
      addMessage,
      updateMessage,
      removeMessage,
      connection,
      location.pathname,
      screenContextSummary,
      navigate,
    ],
  );

  handleSendRef.current = handleSend;

  if (!configured) {
    return (
      <Box
        sx={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          gap: 2,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Typography variant="subtitle1" color="text.secondary">
          LLM provider not configured
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Configure an API key in Settings to enable the chat assistant.
        </Typography>
        <Button
          variant="contained"
          startIcon={<SettingsIcon />}
          onClick={() => navigate(PAGE_MANIFEST.settings.path)}
        >
          Go to Settings
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0 }}>
      {!hideHeader && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1 }}>
          <Typography variant="subtitle1" component="h1" sx={{ flex: 1, fontWeight: 600 }}>
            Chat
          </Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={<DeleteOutlineIcon />}
            onClick={clearMessages}
            disabled={messages.length === 0}
          >
            Clear
          </Button>
        </Box>
      )}

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1 }}>
          {error}
        </Alert>
      )}

      <Paper
        variant="outlined"
        sx={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          gap: 1.5,
          minHeight: 0,
          overflowY: "auto",
          mb: 1,
          p: 2,
        }}
      >
        {messages.length === 0 && (
          <Box
            sx={{
              display: "flex",
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Start a conversation by typing a message below.
            </Typography>
          </Box>
        )}
        {messages.map((msg) => (
          <Box
            key={msg.id}
            sx={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <Paper
              elevation={0}
              sx={{
                maxWidth: "75%",
                py: 1,
                px: 2,
                borderRadius: 2,
                bgcolor: msg.role === "user" ? "primary.main" : "action.hover",
                color: msg.role === "user" ? "primary.contrastText" : "text.primary",
              }}
            >
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {msg.content || (loading && msg.role === "assistant" ? "Thinking…" : "")}
              </Typography>
            </Paper>
          </Box>
        ))}
        <div ref={messagesEndRef} />
      </Paper>

      <Box sx={{ display: "flex", gap: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Type a message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={loading}
          multiline
          maxRows={4}
        />
        <IconButton
          color="primary"
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
          aria-label="Send message"
        >
          {loading ? <CircularProgress size={16} /> : <SendIcon />}
        </IconButton>
      </Box>
    </Box>
  );
}
