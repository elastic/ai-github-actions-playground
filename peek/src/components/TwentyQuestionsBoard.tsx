import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { GameMessage, GameStatus } from "../hooks/useTwentyQuestionsGame";
import { MAX_QUESTIONS } from "../hooks/useTwentyQuestionsGame";

interface GameState {
  status: GameStatus;
  messages: GameMessage[];
  secretLog: string | null;
  questionCount: number;
  loading: boolean;
  error: string | null;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  startGame: () => void;
  handleAnswer: (answer: string) => void;
}

function GameMessageBubble({ msg }: { msg: GameMessage }) {
  const justify =
    msg.role === "user" ? "flex-end" : msg.role === "system" ? "center" : "flex-start";
  const bgcolor =
    msg.role === "user"
      ? "primary.main"
      : msg.role === "system"
        ? "action.selected"
        : "action.hover";
  const color = msg.role === "user" ? "primary.contrastText" : "text.primary";

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
        {msg.role === "assistant" ? (
          msg.content ? (
            <Box sx={{ typography: "body2" }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Thinking…
            </Typography>
          )
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

function AnswerButtons({
  status,
  loading,
  onAnswer,
}: {
  status: GameStatus;
  loading: boolean;
  onAnswer: (a: string) => void;
}) {
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
    <Box sx={{ display: "flex", gap: 1, justifyContent: "center" }}>
      <Button variant="contained" onClick={() => onAnswer("Yes")} disabled={loading}>
        Yes
      </Button>
      <Button variant="outlined" onClick={() => onAnswer("No")} disabled={loading}>
        No
      </Button>
    </Box>
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
        sx={{ p: 2, borderColor: "error.main", bgcolor: "error.main", color: "error.contrastText" }}
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
          Click <strong>New Game</strong> to fetch recent logs from your Elasticsearch cluster. A
          secret log will be chosen at random. The AI will ask yes/no questions to try to identify
          it. Answer honestly based on the secret log shown to you. Can the AI find it in{" "}
          {MAX_QUESTIONS} questions or fewer?
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
          Fetching logs and starting game…
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0, gap: 1 }}>
      {secretLog && (
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
          p: 2,
        }}
      >
        {messages.map((msg) => (
          <GameMessageBubble key={msg.id} msg={msg} />
        ))}
        <div ref={messagesEndRef} />
      </Paper>

      {!gameOver && !loading && (
        <AnswerButtons status={status} loading={loading} onAnswer={handleAnswer} />
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
