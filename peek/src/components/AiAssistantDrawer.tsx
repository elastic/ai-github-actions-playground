import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";

import { useUIStore } from "../store/useUIStore";

import ChatPage from "./ChatPage";

const AI_DRAWER_WIDTH = 440;

export default function AiAssistantDrawer() {
  const open = useUIStore((s) => s.aiPanelOpen);
  const setOpen = useUIStore((s) => s.setAiPanelOpen);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={() => setOpen(false)}
      variant="persistent"
      aria-label="AI assistant panel"
      sx={{
        "& .MuiDrawer-paper": {
          width: AI_DRAWER_WIDTH,
          boxSizing: "border-box",
          top: "auto",
          height: "100%",
          position: "relative",
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
        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: -1 }}>
          <IconButton
            size="small"
            onClick={() => setOpen(false)}
            aria-label="Close AI assistant panel"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <ChatPage />
      </Box>
    </Drawer>
  );
}
