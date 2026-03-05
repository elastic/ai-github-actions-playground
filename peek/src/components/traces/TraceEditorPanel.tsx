import { useId, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Collapse from "@mui/material/Collapse";
import { alpha } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CodeMirror from "@uiw/react-codemirror";
import type { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

import { COMPONENT_HEIGHTS } from "../../types/tokens";
import PageHeader from "../PageHeader";
import ResizableEditorContainer from "../ResizableEditorContainer";
import QueryAnnotationOverlay, { useQueryExplanation } from "../QueryAnnotationOverlay";

export interface TraceEditorPanelProps {
  editorFocused: boolean;
  editorHeight: number;
  setEditorHeight: (height: number) => void;
  effectiveQuery: string;
  onQueryChange: (query: string) => void;
  onCreateEditor: (view: EditorView) => void;
  queryEditorExtensions: Extension[];
  themeMode: "light" | "dark";
  loading: boolean;
  onRun: () => void;
  onFormat: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export default function TraceEditorPanel({
  editorFocused,
  editorHeight,
  setEditorHeight,
  effectiveQuery,
  onQueryChange,
  onCreateEditor,
  queryEditorExtensions,
  themeMode,
  loading,
  onRun,
  onFormat,
  collapsed,
  onToggleCollapsed,
}: TraceEditorPanelProps) {
  const [explainOpen, setExplainOpen] = useState(false);
  const explainPanelId = useId();
  const explanation = useQueryExplanation(effectiveQuery);
  const collapsedSummary = explanation?.trim() || "ES|QL trace query";

  const searchButton = (
    <Button
      variant="contained"
      size="small"
      aria-label="Search Traces"
      startIcon={
        loading ? (
          <CircularProgress size={14} color="inherit" />
        ) : (
          <PlayArrowIcon sx={{ fontSize: 18 }} />
        )
      }
      onClick={onRun}
      disabled={loading || !effectiveQuery.trim()}
      sx={{ minHeight: COMPONENT_HEIGHTS.sidebarNavItem }}
    >
      Search
    </Button>
  );

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <PageHeader
        title="Trace Finder"
        leading={
          <IconButton
            size="small"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand query panel" : "Collapse query panel"}
          >
            <ExpandMoreIcon
              sx={{
                transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
                fontSize: 20,
              }}
            />
          </IconButton>
        }
        titleAdornment={
          collapsed ? (
            <Tooltip title={collapsedSummary}>
              <Typography
                component="span"
                variant="body2"
                color="text.secondary"
                noWrap
                sx={{ maxWidth: { sm: 520, xs: 220 }, fontStyle: "italic" }}
              >
                {collapsedSummary}
              </Typography>
            </Tooltip>
          ) : undefined
        }
        actions={
          !collapsed ? (
            <>
              <Typography
                component="a"
                href="https://www.elastic.co/guide/en/elasticsearch/reference/current/esql.html"
                target="_blank"
                rel="noreferrer"
                variant="caption"
                color="primary.main"
                sx={{ textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
              >
                ES|QL docs
              </Typography>
              {searchButton}
            </>
          ) : (
            searchButton
          )
        }
      />
      <Collapse in={!collapsed} unmountOnExit>
        <Box
          sx={{
            overflow: "hidden",
            mb: 1,
            boxShadow: editorFocused
              ? (theme) => `0 0 0 1px ${theme.palette.primary.main}`
              : "none",
            border: 1,
            borderColor: editorFocused ? "primary.main" : "divider",
            borderRadius: 1,
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
        >
          <ResizableEditorContainer height={editorHeight} onHeightChange={setEditorHeight}>
            <Box sx={{ position: "relative", height: "100%" }}>
              <Box
                aria-hidden
                sx={{
                  position: "absolute",
                  zIndex: 1,
                  bottom: 2,
                  left: "50%",
                  color: (theme) => alpha(theme.palette.text.secondary, 0.2),
                  pointerEvents: "none",
                  transform: "translateX(-50%)",
                  letterSpacing: "0.08em",
                  userSelect: "none",
                  fontWeight: 600,
                  fontSize: 18,
                }}
              >
                ES|QL
              </Box>
              <CodeMirror
                value={effectiveQuery}
                onChange={onQueryChange}
                onCreateEditor={onCreateEditor}
                extensions={queryEditorExtensions}
                theme={themeMode}
                height={`${editorHeight}px`}
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: false,
                  indentOnInput: false,
                }}
              />
              <QueryAnnotationOverlay
                query={effectiveQuery}
                editorFocused={editorFocused}
                height={editorHeight}
              />
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
                      disabled={!effectiveQuery.trim()}
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
                      onClick={() => setExplainOpen((v) => !v)}
                      disabled={!effectiveQuery.trim()}
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
                    disabled={loading || !effectiveQuery.trim()}
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
            </Box>
          </ResizableEditorContainer>
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
        </Box>
      </Collapse>
    </Paper>
  );
}
