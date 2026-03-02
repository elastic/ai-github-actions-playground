import { useEffect, useCallback, useId } from "react";
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import GpsFixedIcon from "@mui/icons-material/GpsFixed";

import { useUIStore } from "../store/useUIStore";
import { useLLMStore } from "../store/useLLMStore";
import { serializeClickedElement } from "../services/clickToExplain";

import ChatPage from "./ChatPage";

const AI_DRAWER_WIDTH = 440;

interface AiAssistantDrawerProps {
  isMobile?: boolean;
}

export default function AiAssistantDrawer({ isMobile = false }: AiAssistantDrawerProps) {
  const open = useUIStore((s) => s.aiPanelOpen);
  const setOpen = useUIStore((s) => s.setAiPanelOpen);
  const explainModeActive = useUIStore((s) => s.explainModeActive);
  const setExplainModeActive = useUIStore((s) => s.setExplainModeActive);
  const clearMessages = useLLMStore((s) => s.clearMessages);
  const hasMessages = useLLMStore((s) => s.messages.length > 0);
  const setPendingPrompt = useLLMStore((s) => s.setPendingPrompt);
  const titleId = useId();

  const handleExplainClick = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Ignore clicks inside the drawer itself
      if (target.closest("[data-ai-drawer]")) return;

      e.preventDefault();
      e.stopPropagation();

      const context = serializeClickedElement(target);
      setPendingPrompt(`Explain this element: ${context}`);

      // Single-shot: deactivate after one click
      setExplainModeActive(false);
    },
    [setPendingPrompt, setExplainModeActive],
  );

  useEffect(() => {
    if (!explainModeActive) return;
    document.addEventListener("click", handleExplainClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleExplainClick, { capture: true });
    };
  }, [explainModeActive, handleExplainClick]);

  // Deactivate explain mode when drawer closes
  useEffect(() => {
    if (!open && explainModeActive) {
      setExplainModeActive(false);
    }
  }, [open, explainModeActive, setExplainModeActive]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={() => setOpen(false)}
      variant={isMobile ? "temporary" : "persistent"}
      PaperProps={{
        role: "complementary",
        "aria-labelledby": titleId,
        "data-ai-drawer": true,
      }}
      sx={{
        "& .MuiDrawer-paper": {
          top: "auto",
          boxSizing: "border-box",
          width: isMobile ? "min(100vw, 440px)" : AI_DRAWER_WIDTH,
          maxWidth: "100vw",
          height: "100%",
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          p: 2,
        }}
      >
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1 }}>
          <Typography id={titleId} variant="subtitle1" sx={{ flex: 1, fontWeight: 600 }}>
            AI Assistant
          </Typography>
          <Tooltip
            title={explainModeActive ? "Cancel explain mode" : "Click an element to explain"}
          >
            <IconButton
              size="small"
              onClick={() => setExplainModeActive(!explainModeActive)}
              aria-label="Toggle explain mode"
              color={explainModeActive ? "primary" : "default"}
            >
              <GpsFixedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button
            size="small"
            variant="text"
            startIcon={<DeleteOutlineIcon />}
            onClick={clearMessages}
            disabled={!hasMessages}
            sx={{ color: "text.secondary" }}
          >
            Clear
          </Button>
          <IconButton
            size="small"
            onClick={() => setOpen(false)}
            aria-label="Close AI assistant panel"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <ChatPage hideHeader />
      </Box>
    </Drawer>
  );
}
