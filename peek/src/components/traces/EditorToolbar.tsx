import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

export interface EditorToolbarProps {
  onRun: () => void;
  onFormat: () => void;
  loading: boolean;
  effectiveQuery: string;
  explainOpen: boolean;
  explainPanelId: string;
  onToggleExplain: () => void;
}

/**
 * Absolute-positioned overlay buttons inside the CodeMirror editor:
 * Format and Explain (bottom-left), Run (bottom-right).
 */
export default function EditorToolbar({
  onRun,
  onFormat,
  loading,
  effectiveQuery,
  explainOpen,
  explainPanelId,
  onToggleExplain,
}: EditorToolbarProps) {
  const disabled = !effectiveQuery.trim();

  return (
    <>
      <Box
        sx={{
          position: "absolute",
          zIndex: 4,
          bottom: 2,
          left: 36,
          display: "flex",
          gap: 0,
        }}
      >
        <Tooltip title="Format query: uppercase keywords and normalize whitespace">
          <span>
            <IconButton
              size="small"
              aria-label="Format query"
              onClick={onFormat}
              disabled={disabled}
              sx={{
                width: 24,
                height: 24,
                bgcolor: "transparent",
                color: "text.secondary",
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <AutoFixHighIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Explain this query">
          <span>
            <IconButton
              size="small"
              color={explainOpen ? "primary" : "default"}
              aria-label={explainOpen ? "Hide query explanation" : "Show query explanation"}
              aria-controls={explainPanelId}
              aria-expanded={explainOpen}
              onClick={onToggleExplain}
              disabled={disabled}
              sx={{
                width: 24,
                height: 24,
                bgcolor: "transparent",
                color: explainOpen ? "primary.main" : "text.secondary",
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <AutoAwesomeIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      <Tooltip title="Run query (Ctrl/Cmd+Enter)">
        <span>
          <IconButton
            size="small"
            onClick={onRun}
            disabled={loading || disabled}
            aria-label="Run query (Ctrl/Cmd+Enter)"
            sx={{
              position: "absolute",
              zIndex: 4,
              right: 8,
              bottom: 2,
              width: 24,
              height: 24,
              bgcolor: "transparent",
              color: "text.secondary",
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            {loading ? (
              <CircularProgress size={14} color="inherit" />
            ) : (
              <PlayArrowIcon sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        </span>
      </Tooltip>
    </>
  );
}

export interface EditorExplainPanelProps {
  id: string;
  open: boolean;
  explanation: string | null | undefined;
}

/** Collapsible panel rendered below the editor showing the AI query explanation. */
export function EditorExplainPanel({ id, open, explanation }: EditorExplainPanelProps) {
  return (
    <Collapse in={open}>
      <Box
        id={id}
        sx={{ py: 1, px: 1.5, borderTop: 1, borderColor: "divider", bgcolor: "action.hover" }}
      >
        {explanation ? (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
            {explanation}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.disabled" sx={{ fontStyle: "italic" }}>
            Generating explanation… (requires an AI provider configured in Settings)
          </Typography>
        )}
      </Box>
    </Collapse>
  );
}
