import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import { useUIStore } from "../store/useUIStore";
import { useLLMStore } from "../store/useLLMStore";

import ChatPage from "./ChatPage";

const AI_DRAWER_WIDTH = 440;

export default function AiAssistantDrawer() {
  const open = useUIStore((s) => s.aiPanelOpen);
  const setOpen = useUIStore((s) => s.setAiPanelOpen);
  const clearMessages = useLLMStore((s) => s.clearMessages);
  const hasMessages = useLLMStore((s) => s.messages.length > 0);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={() => setOpen(false)}
      variant="persistent"
      PaperProps={{
        role: "complementary",
        "aria-labelledby": "ai-drawer-title",
      }}
      sx={{
        "& .MuiDrawer-paper": {
          width: AI_DRAWER_WIDTH,
          boxSizing: "border-box",
          top: "auto",
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
        <Box sx={{ display: "flex", alignItems: "center", mb: 1, gap: 1 }}>
          <Typography id="ai-drawer-title" variant="subtitle1" sx={{ flex: 1, fontWeight: 600 }}>
            AI Assistant
          </Typography>
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
