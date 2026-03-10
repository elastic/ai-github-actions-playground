import { useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SendIcon from "@mui/icons-material/Send";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { GameMessage, GameStatus } from "../hooks/useTwentyQuestionsGame";
import { MAX_QUESTIONS } from "../hooks/useTwentyQuestionsGame";
import { formatToolLabel, type ToolActivity } from "./chatUtils";

interface GameState {
  status: GameStatus;
  messages: GameMessage[];
  secretLog: string | null;
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
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
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

function GameInput({
  status,
  loading,
  onAnswer,
}: {
  status: GameStatus;
  loading: boolean;
  onAnswer: (a: string) => void;
}) {
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
          disabled={loading}
        >
          ✅ Correct!
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={() => onAnswer("No, that's wrong.")}
          disabled={loading}
        >
          ❌ Wrong
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Box sx={{ display: "flex", gap: 1, justifyContent: "center" }}>
        <Button variant="contained" onClick={() => onAnswer("Yes")} disabled={loading}>
          Yes
        </Button>
        <Button variant="outlined" onClick={() => onAnswer("No")} disabled={loading}>
          No
        </Button>
      </Box>
      <Box sx={{ display: "flex", gap: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Or type a more detailed answer…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={loading}
        />
        <IconButton
          color="primary"
          onClick={handleSend}
          disabled={!text.trim() || loading}
          aria-label="Send answer"
        >
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
}

function SecretLogReveal({ secretLog }: { secretLog: string }) {
  return (
    <Accordion defaultExpanded={false} sx={{ flexShrink: 0 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1">🔒 Your Secret Log (click to reveal)</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box
          sx={{
            typography: "body2",
            whiteSpace: "pre-wrap",
            fontFamily: "monospace",
            fontSize: "0.8rem",
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{secretLog}</ReactMarkdown>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}

export default function TwentyQuestionsBoard({ game }: { game: GameState }) {
  const { status, messages, secretLog, loading, error, messagesEndRef, startGame, handleAnswer } =
    game;
  const gameOver = status === "won" || status === "lost";

  if (error) {
    return (
      <Paper
        variant="outlined"
        sx={{ p: 2, borderColor: "error.dark", bgcolor: "error.main", color: "error.contrastText" }}
      >
        <Typography variant="body2">{error}</Typography>
      </Paper>
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
          Click <strong>New Game</strong> to pick a random secret log from your cluster. The AI will
          query Elasticsearch and ask you yes/no questions to narrow it down. Answer based on the
          secret log shown to you. Can the AI find it in {MAX_QUESTIONS} questions?
        </Typography>
      </Box>
    );
  }

  if (status === "loading") {
    return (
      <Box
        sx={{ display: "flex", flex: 1, justifyContent: "center", alignItems: "center", gap: 2 }}
      >
        <LinearProgress sx={{ width: 120 }} />
        <Typography variant="body2" color="text.secondary">
          Starting game…
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0, gap: 1 }}>
      {secretLog && <SecretLogReveal secretLog={secretLog} />}
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
      {!gameOver && !loading && (
        <GameInput status={status} loading={loading} onAnswer={handleAnswer} />
      )}
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
