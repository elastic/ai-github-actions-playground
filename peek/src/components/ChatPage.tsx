import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useDashboardStore } from "../store/useDashboardStore";
import { generateChatReply } from "../services/llm";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const llmSettings = useDashboardStore((s) => s.llmSettings);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = Boolean(llmSettings.apiKey.trim()) && Boolean(input.trim()) && !loading;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, height: "100%" }}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6">LLM Chat</Typography>
        <Typography variant="body2" color="text.secondary">
          Provider: {llmSettings.provider} | Model: {llmSettings.model}
        </Typography>
      </Paper>
      {!llmSettings.apiKey.trim() && (
        <Alert severity="warning">
          Add an API key in Settings before sending prompts to the LLM provider.
        </Alert>
      )}
      {error && <Alert severity="error">{error}</Alert>}
      <Paper variant="outlined" sx={{ p: 2, flex: 1, overflow: "auto" }}>
        {messages.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Send a prompt to start chatting.
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {messages.map((message, index) => (
              <Box key={`${message.role}-${index}`}>
                <Typography variant="caption" color="text.secondary">
                  {message.role === "user" ? "You" : "Assistant"}
                </Typography>
                <Typography sx={{ whiteSpace: "pre-wrap" }}>{message.content}</Typography>
              </Box>
            ))}
          </Box>
        )}
      </Paper>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField
            fullWidth
            placeholder="Ask about your data, ES|QL, or dashboard ideas..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            multiline
            minRows={2}
          />
          <Button
            variant="contained"
            disabled={!canSend}
            onClick={async () => {
              const prompt = input.trim();
              if (!prompt || !llmSettings.apiKey.trim()) return;
              setError(null);
              setLoading(true);
              setMessages((prev) => [...prev, { role: "user", content: prompt }]);
              setInput("");
              try {
                const reply = await generateChatReply(llmSettings, prompt);
                setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? <CircularProgress size={18} color="inherit" /> : "Send"}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
