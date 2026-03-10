import { useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import SendIcon from "@mui/icons-material/Send";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { GameMessage, GameStatus } from "../hooks/useTwentyQuestionsGame";
import { MAX_QUESTIONS } from "../hooks/useTwentyQuestionsGame";
import { formatToolLabel, type ToolActivity } from "./chatUtils";

const SAFE_MARKDOWN_ELEMENTS: string[] = [
  "p",
  "br",
  "strong",
  "em",
  "code",
  "pre",
  "ul",
  "ol",
  "li",
  "blockquote",
];

interface GameState {
  status: GameStatus;
  messages: GameMessage[];
  loading: boolean;
  error: string | null;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  startGame: () => void;
  handleAnswer: (answer: string) => void;
}

function ToolCallProgress({ toolCalls }: { toolCalls: ToolActivity[] }) {
  if (toolCalls.length === 0) return null;
  return (
    <Box sx={{ mb: 0.5 }}>
      {toolCalls.map((tc) => (
        <Typography
          key={tc.toolCallId}
          variant="caption"
          sx={{ display: "block", color: "text.secondary" }}
        >
          {tc.result
            ? `✓ ${formatToolLabel(tc.name)} — ${tc.result}`
            : `⏳ ${formatToolLabel(tc.name)}…`}
        </Typography>
      ))}
    </Box>
  );
}

function GameMessageBubble({ msg, isActive }: { msg: GameMessage; isActive: boolean }) {
  const justify =
    msg.role === "user" ? "flex-end" : msg.role === "system" ? "center" : "flex-start";
  const bgcolor =
    msg.role === "user"
      ? "primary.main"
      : msg.role === "system"
        ? "action.selected"
        : "action.hover";
  const color = msg.role === "user" ? "primary.contrastText" : "text.primary";
  const toolCalls = msg.toolCalls ?? [];
  return (
    <Box sx={{ display: "flex", justifyContent: justify }}>
      <Paper
        elevation={0}
        sx={{
          maxWidth: msg.role === "system" ? "90%" : "75%",
          py: 1,
          px: 2,
          borderRadius: 2,
          bgcolor,
          color,
        }}
      >
        <ToolCallProgress toolCalls={toolCalls} />
        {msg.role === "assistant" ? (
          msg.content ? (
            <Box sx={{ typography: "body2" }}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                allowedElements={SAFE_MARKDOWN_ELEMENTS}
                skipHtml
              >
                {msg.content}
              </ReactMarkdown>
            </Box>
          ) : isActive && toolCalls.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Thinking…
            </Typography>
          ) : null
        ) : (
          <Typography
            variant="body2"
            sx={{
              whiteSpace: "pre-wrap",
              ...(msg.role === "system" ? { fontStyle: "italic" } : {}),
            }}
          >
            {msg.content}
          </Typography>
        )}
      </Paper>
    </Box>
  );
}

function GameInput({ status, onAnswer }: { status: GameStatus; onAnswer: (a: string) => void }) {
  const [text, setText] = useState("");

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAnswer(trimmed);
    setText("");
  };

  if (status === "guessing") {
    return (
      <Box sx={{ display: "flex", gap: 1, justifyContent: "center" }}>
        <Button
          variant="contained"
          color="success"
          onClick={() => onAnswer("Yes, that's correct!")}
        >
          ✅ Correct!
        </Button>
        <Button variant="contained" color="error" onClick={() => onAnswer("No, that's wrong.")}>
          ❌ Wrong
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Box sx={{ display: "flex", gap: 1, justifyContent: "center" }}>
        <Button variant="contained" onClick={() => onAnswer("Yes")}>
          Yes
        </Button>
        <Button variant="outlined" onClick={() => onAnswer("No")}>
          No
        </Button>
      </Box>
      <Box sx={{ display: "flex", gap: 1 }}>
        <TextField
          fullWidth
          size="small"
          aria-label="Your answer"
          placeholder="Or type a more detailed answer…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <IconButton
          color="primary"
          onClick={handleSend}
          disabled={!text.trim()}
          aria-label="Send answer"
        >
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
}

export default function TwentyQuestionsBoard({ game }: { game: GameState }) {
  const { status, messages, loading, error, messagesEndRef, startGame, handleAnswer } = game;
  const gameOver = status === "won" || status === "lost";

  if (error) {
    return (
      <Box
        sx={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 2,
        }}
      >
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            maxWidth: 480,
            borderColor: "error.dark",
            bgcolor: "error.main",
            color: "error.contrastText",
          }}
        >
          <Typography variant="body2">{error}</Typography>
        </Paper>
        <Button variant="contained" onClick={startGame}>
          Try Again
        </Button>
      </Box>
    );
  }

  if (status === "idle") {
    return (
      <Box
        sx={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 2,
        }}
      >
        <Typography variant="h6" color="text.secondary">
          How to Play
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ maxWidth: 480, textAlign: "center" }}
        >
          Think of something in your Elasticsearch cluster — a specific log entry, an index, a
          service, a host, an error message, or anything else that lives in the data. Click{" "}
          <strong>New Game</strong> and the AI will query the cluster and ask you up to{" "}
          {MAX_QUESTIONS} yes/no questions to figure out what you&apos;re thinking of.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0, gap: 1 }}>
      <Paper
        variant="outlined"
        sx={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          gap: 1.5,
          minHeight: 0,
          overflowY: "auto",
          p: 2,
        }}
      >
        {messages.map((msg, i) => (
          <GameMessageBubble
            key={msg.id}
            msg={msg}
            isActive={loading && msg.role === "assistant" && i === messages.length - 1}
          />
        ))}
        <div ref={messagesEndRef} />
      </Paper>
      {!gameOver && !loading && <GameInput status={status} onAnswer={handleAnswer} />}
      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
          <LinearProgress sx={{ width: 120 }} />
        </Box>
      )}
      {gameOver && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
          <Button variant="contained" onClick={startGame}>
            Play Again
          </Button>
        </Box>
      )}
    </Box>
  );
}
