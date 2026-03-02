import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { formatToolLabel, type ToolActivity } from "./chatUtils";

/** Markdown styles for assistant chat bubbles. */
const chatMarkdownSx = {
  "& a": { color: "primary.main" },
  "& blockquote": {
    ml: 0,
    pl: 2,
    borderLeft: 3,
    borderColor: "divider",
    color: "text.secondary",
  },
  "& code": {
    px: 0.5,
    borderRadius: 0.5,
    bgcolor: "action.selected",
    fontSize: "0.85em",
    fontFamily: "monospace",
  },
  "& h1,& h2,& h3,& h4,& h5,& h6": { mt: 1, mb: 0.5 },
  "& hr": { my: 1, borderColor: "divider" },
  "& li": { mb: 0.5 },
  "& p": { mt: 0, mb: 1 },
  "& p:last-child": { mb: 0 },
  "& pre": {
    overflow: "auto",
    p: 1,
    borderRadius: 1,
    bgcolor: "action.selected",
    "& code": { p: 0, bgcolor: "transparent" },
  },
  "& table": { width: "100%", mb: 1, borderCollapse: "collapse" },
  "& th": { bgcolor: "action.selected", fontWeight: 600 },
  "& th,& td": { py: 0.5, px: 1, border: 1, borderColor: "divider" },
  "& ul,& ol": { mb: 1, pl: 2.5 },
} as const;

interface Props {
  content: string;
  role: "user" | "assistant";
  isActiveAssistant: boolean;
  toolCalls: ToolActivity[];
}

/**
 * Renders message content inside a chat bubble.
 * Assistant messages are rendered as Markdown; user messages as plain text.
 * Active assistant messages show inline tool call progress.
 */
export default function ChatMessageContent({ content, role, isActiveAssistant, toolCalls }: Props) {
  return (
    <>
      {isActiveAssistant && toolCalls.length > 0 && (
        <Box sx={{ mb: content ? 1 : 0 }}>
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
      )}
      {role === "assistant" ? (
        content ? (
          <Box sx={{ ...chatMarkdownSx, typography: "body2" }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </Box>
        ) : isActiveAssistant && toolCalls.length === 0 ? (
          <Typography variant="body2">Thinking…</Typography>
        ) : null
      ) : (
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
          {content}
        </Typography>
      )}
    </>
  );
}
