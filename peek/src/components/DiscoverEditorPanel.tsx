import { useId, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Collapse from "@mui/material/Collapse";
import { alpha } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import SpeedIcon from "@mui/icons-material/Speed";
import BarChartIcon from "@mui/icons-material/BarChart";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CodeMirror from "@uiw/react-codemirror";
import type { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

import QueryPipelineSteps from "./QueryPipelineSteps";
import PageHeader from "./PageHeader";
import ResizableEditorContainer from "./ResizableEditorContainer";
import QueryAnnotationOverlay, { useQueryExplanation } from "./QueryAnnotationOverlay";

export interface DiscoverEditorPanelProps {
  isLogsExplorer: boolean;
  editorFocused: boolean;
  discoverEditorHeight: number;
  setDiscoverEditorHeight: (height: number) => void;
  effectiveQuery: string;
  handleQueryChange: (query: string) => void;
  handleCreateEditor: (view: EditorView) => void;
  queryEditorExtensions: Extension[];
  basicSetup: { lineNumbers: boolean; foldGutter: boolean; indentOnInput: boolean };
  themeMode: "light" | "dark";
  loading: boolean;
  activeStep: number | null;
  stepDurationsMs: Record<number, number>;
  handleRunQuery: () => void;
  handleRunStep: (stepQuery: string, stepIndex: number) => void;
  profileMode: boolean;
  setProfileMode: (mode: boolean) => void;
  handleFormatQuery: () => void;
  handleCreatePanel: () => void;
  hasPendingRunChanges: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  queryHistory: string[];
  historyAnchor: HTMLElement | null;
  setHistoryAnchor: (anchor: HTMLElement | null) => void;
  handleSelectHistory: (query: string) => void;
}

export default function DiscoverEditorPanel(p: DiscoverEditorPanelProps) {
  const hasQueryHistory = p.queryHistory.length > 0;
  const [explainOpen, setExplainOpen] = useState(false);
  const explainPanelId = useId();
  const explanation = useQueryExplanation(p.effectiveQuery);
  const collapsedSummary = explanation ?? "AI summary unavailable.";
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <PageHeader
        title={p.isLogsExplorer ? "Logs Explorer Query" : "Query Lab"}
        leading={
          <IconButton
            size="small"
            onClick={p.onToggleCollapsed}
            aria-expanded={!p.collapsed}
            aria-label={p.collapsed ? "Expand query panel" : "Collapse query panel"}
          >
            <ExpandMoreIcon
              sx={{
                transform: p.collapsed ? "rotate(-90deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
                fontSize: 20,
              }}
            />
          </IconButton>
        }
        titleAdornment={
          p.collapsed ? (
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
          ) : !p.isLogsExplorer ? (
            <Typography component="span" aria-hidden="true" sx={{ lineHeight: 1 }}>
              🔬
            </Typography>
          ) : undefined
        }
        actions={
          !p.collapsed ? (
            <>
              <Tooltip
                title={hasQueryHistory ? "View previously executed queries" : "Run a query first"}
              >
                <span>
                  <Button
                    variant="text"
                    size="small"
                    onClick={(e) => p.setHistoryAnchor(e.currentTarget)}
                    disabled={!hasQueryHistory}
                  >
                    Recent queries
                  </Button>
                </span>
              </Tooltip>
              <Menu
                anchorEl={p.historyAnchor}
                open={Boolean(p.historyAnchor)}
                onClose={() => p.setHistoryAnchor(null)}
              >
                {p.queryHistory.map((historyQuery) => (
                  <MenuItem key={historyQuery} onClick={() => p.handleSelectHistory(historyQuery)}>
                    {historyQuery}
                  </MenuItem>
                ))}
              </Menu>
              <Typography
                component="a"
                href="https://www.elastic.co/guide/en/elasticsearch/reference/current/esql.html"
                target="_blank"
                rel="noreferrer"
                variant="caption"
                color="primary.main"
                sx={{ textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
              >
                ES|QL documentation
              </Typography>
            </>
          ) : null
        }
      />
      <Collapse in={!p.collapsed} unmountOnExit>
        <Box
          sx={{
            overflow: "hidden",
            mb: 1,
            boxShadow: p.editorFocused
              ? (theme) => `0 0 0 1px ${theme.palette.primary.main}`
              : "none",
            border: 1,
            borderColor: p.editorFocused ? "primary.main" : "divider",
            borderRadius: 1,
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
        >
          <ResizableEditorContainer
            height={p.discoverEditorHeight}
            onHeightChange={p.setDiscoverEditorHeight}
          >
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
                value={p.effectiveQuery}
                onChange={p.handleQueryChange}
                onCreateEditor={p.handleCreateEditor}
                extensions={p.queryEditorExtensions}
                theme={p.themeMode}
                height={`${p.discoverEditorHeight}px`}
                basicSetup={p.basicSetup}
                aria-label="ES|QL query editor"
              />
              <QueryAnnotationOverlay
                query={p.effectiveQuery}
                editorFocused={p.editorFocused}
                height={p.discoverEditorHeight}
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
                <Tooltip title="Toggle profile mode">
                  <IconButton
                    size="small"
                    color={p.profileMode ? "primary" : "default"}
                    aria-label={
                      p.profileMode ? "Disable profile query mode" : "Enable profile query mode"
                    }
                    aria-pressed={p.profileMode}
                    onClick={() => p.setProfileMode(!p.profileMode)}
                    sx={{
                      width: 24,
                      height: 24,
                      bgcolor: "transparent",
                      color: p.profileMode ? "primary.main" : "text.secondary",
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                  >
                    <SpeedIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Format query: uppercase keywords and normalize whitespace">
                  <span>
                    <IconButton
                      size="small"
                      aria-label="Format query"
                      onClick={p.handleFormatQuery}
                      disabled={!p.effectiveQuery.trim()}
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
                <Tooltip title="Create a dashboard panel from this query">
                  <span>
                    <IconButton
                      size="small"
                      aria-label="Convert to Visualization"
                      onClick={p.handleCreatePanel}
                      disabled={!p.effectiveQuery.trim()}
                      sx={{
                        width: 24,
                        height: 24,
                        bgcolor: "transparent",
                        color: "text.secondary",
                        "&:hover": { bgcolor: "action.hover" },
                      }}
                    >
                      <BarChartIcon sx={{ fontSize: 16 }} />
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
                      disabled={!p.effectiveQuery.trim()}
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
              <Tooltip title="Run Query (Ctrl/Cmd+Enter)">
                <span>
                  <IconButton
                    size="small"
                    onClick={p.handleRunQuery}
                    disabled={p.loading || !p.effectiveQuery.trim()}
                    aria-label="Run Query (Ctrl/Cmd+Enter)"
                    sx={{
                      position: "absolute",
                      zIndex: 4,
                      right: 8,
                      bottom: 2,
                      width: 24,
                      height: 24,
                      boxShadow: p.hasPendingRunChanges ? 1 : 0,
                      bgcolor: "transparent",
                      color: p.hasPendingRunChanges ? "info.main" : "text.secondary",
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                  >
                    {p.loading ? (
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
                  Generating explanation... (requires an AI provider configured in Settings)
                </Typography>
              )}
            </Box>
          </Collapse>
        </Box>
        <QueryPipelineSteps
          query={p.effectiveQuery}
          loading={p.loading}
          activeStep={p.activeStep}
          stepDurationsMs={p.stepDurationsMs}
          onRunStep={p.handleRunStep}
        />
      </Collapse>
    </Paper>
  );
}
