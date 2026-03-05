import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CodeMirror from "@uiw/react-codemirror";

import QueryAnnotationOverlay from "../QueryAnnotationOverlay";

interface LogsQueryEditorProps {
  effectiveQuery: string;
  onRawQueryChange: (query: string | null) => void;
  onCreateEditor: (view: EditorView | null) => void;
  editorExtensions: Extension[];
  themeMode: "light" | "dark";
  collapsed: boolean;
  onToggleCollapsed: () => void;
  editorFocused: boolean;
  explainOpen: boolean;
  onToggleExplain: () => void;
  explainPanelId: string;
  queryExplanation: string | null;
}

export default function LogsQueryEditor({
  effectiveQuery,
  onRawQueryChange,
  onCreateEditor,
  editorExtensions,
  themeMode,
  collapsed,
  onToggleCollapsed,
  editorFocused,
  explainOpen,
  onToggleExplain,
  explainPanelId,
  queryExplanation,
}: LogsQueryEditorProps) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Box
        sx={{
          display: "flex",
          gap: 0.5,
          alignItems: "center",
          mb: collapsed ? 0 : 1,
        }}
      >
        <IconButton
          size="small"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand ES|QL query section" : "Collapse ES|QL query section"}
        >
          <ExpandMoreIcon
            sx={{
              transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
              fontSize: 20,
            }}
          />
        </IconButton>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          ES|QL Query
        </Typography>
      </Box>

      {collapsed && (
        <Typography
          variant="caption"
          color="text.secondary"
          noWrap
          sx={{ display: "block", fontStyle: "italic" }}
        >
          {queryExplanation ?? effectiveQuery}
        </Typography>
      )}

      <Collapse in={!collapsed} unmountOnExit>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
          Generated from the query builder. Edit before running if needed.
        </Typography>
        <Box sx={{ overflow: "hidden", border: 1, borderColor: "divider", borderRadius: 1 }}>
          <Box sx={{ position: "relative" }}>
            <CodeMirror
              value={effectiveQuery}
              onChange={onRawQueryChange}
              onCreateEditor={onCreateEditor}
              extensions={editorExtensions}
              theme={themeMode}
              height="120px"
              basicSetup={{ lineNumbers: true, foldGutter: false, indentOnInput: false }}
            />
            <QueryAnnotationOverlay
              query={effectiveQuery}
              editorFocused={editorFocused}
              height={120}
            />
            <Box sx={{ position: "absolute", zIndex: 3, right: 8, bottom: 6 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AutoAwesomeIcon sx={{ fontSize: "14px !important" }} />}
                onClick={onToggleExplain}
                aria-expanded={explainOpen}
                aria-controls={explainPanelId}
                sx={{
                  minHeight: "unset",
                  py: 0.5,
                  px: 1,
                  opacity: 0.75,
                  lineHeight: 1.4,
                  fontSize: "0.7rem",
                  "&:hover": { opacity: 1 },
                }}
              >
                Explain Query
              </Button>
            </Box>
          </Box>
          <Collapse in={explainOpen}>
            <Box
              id={explainPanelId}
              sx={{
                py: 1,
                px: 1.5,
                borderTop: 1,
                borderColor: "divider",
                bgcolor: "action.hover",
              }}
            >
              {queryExplanation ? (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                  {queryExplanation}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.disabled" sx={{ fontStyle: "italic" }}>
                  Generating explanation… (requires an AI provider configured in Settings)
                </Typography>
              )}
            </Box>
          </Collapse>
        </Box>
      </Collapse>
    </Paper>
  );
}
