import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import SettingsIcon from "@mui/icons-material/Settings";
import { useShallow } from "zustand/react/shallow";
import { useNavigate } from "react-router-dom";

import { useLLMStore } from "../store/useLLMStore";
import { useConnectionStore } from "../store/useConnectionStore";
import { PAGE_PATHS } from "../routes/paths";
import { useTwentyQuestionsGame, MAX_QUESTIONS } from "../hooks/useTwentyQuestionsGame";
import PageContainer from "./PageContainer";
import PageHeader from "./PageHeader";
import TwentyQuestionsBoard from "./TwentyQuestionsBoard";

export default function TwentyQuestionsPage() {
  const { config, isConfigured } = useLLMStore(
    useShallow((s) => ({ config: s.config, isConfigured: s.isConfigured })),
  );
  const connection = useConnectionStore((s) => s.connection);
  const navigate = useNavigate();
  const configured = isConfigured();

  const game = useTwentyQuestionsGame(config, connection, configured);
  const gameOver = game.status === "won" || game.status === "lost";

  if (!configured) {
    return (
      <PageContainer>
        <PageHeader
          title="20 Questions"
          description="Think of something in your cluster — the AI queries Elasticsearch to guess what it is"
        />
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
            Configure an API key in Settings to play 20 Questions.
          </Typography>
          <Button
            variant="contained"
            startIcon={<SettingsIcon />}
            onClick={() => navigate(PAGE_PATHS.settings.path)}
          >
            Go to Settings
          </Button>
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer gap={1.5}>
      <PageHeader
        title="20 Questions"
        description="Think of something in your cluster — the AI queries Elasticsearch to guess what it is"
        actions={
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            {(game.status === "playing" || game.status === "guessing") && (
              <Chip
                label={`${game.questionCount} / ${MAX_QUESTIONS} questions`}
                size="small"
                color={game.questionCount >= MAX_QUESTIONS - 5 ? "warning" : "default"}
              />
            )}
            <Button variant="contained" onClick={game.startGame} disabled={game.loading}>
              {game.status === "idle" ? "New Game" : gameOver ? "Play Again" : "Restart"}
            </Button>
          </Box>
        }
      />
      <TwentyQuestionsBoard game={game} />
    </PageContainer>
  );
}
