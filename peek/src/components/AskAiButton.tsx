import { type ReactNode } from "react";
import Button from "@mui/material/Button";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

import { useLLMStore } from "../store/useLLMStore";
import { useUIStore } from "../store/useUIStore";

interface AskAiButtonProps {
  /** Pre-filled prompt describing what context to analyze */
  prompt: string;
  /** Button label (defaults to "Ask AI") */
  label?: string;
  /** Icon override */
  icon?: ReactNode;
  /** Compact variant for inline use */
  size?: "small" | "medium";
}

export default function AskAiButton({
  prompt,
  label = "Ask AI",
  icon = <AutoAwesomeIcon fontSize="small" />,
  size = "small",
}: AskAiButtonProps) {
  const hasApiKey = useLLMStore((s) => Boolean(s.config.apiKey.trim()));
  const setPendingPrompt = useLLMStore((s) => s.setPendingPrompt);
  const setAiPanelOpen = useUIStore((s) => s.setAiPanelOpen);

  if (!hasApiKey) return null;

  return (
    <Button
      size={size}
      variant="text"
      startIcon={icon}
      onClick={() => {
        setPendingPrompt(prompt);
        setAiPanelOpen(true);
      }}
    >
      {label}
    </Button>
  );
}
