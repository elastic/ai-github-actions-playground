import { useState, useMemo, useId, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";

import { COMPONENT_HEIGHTS } from "../types/tokens";

import QueryAnnotationOverlay, { useQueryExplanation } from "./QueryAnnotationOverlay";

const TOOLBAR_CONTROL_HEIGHT = COMPONENT_HEIGHTS.input;
const DEFAULT_EDITOR_HEIGHT = 120;

export interface SignalSearchPanelProps {
  /** Display title shown in the header, e.g. "Trace Search", "Log Search" */
  title: string;
  /** Noun for result count, e.g. "traces", "rows" */
  resultNoun: string;

  /** The current effective ES|QL query (rawQuery ?? generatedQuery) */
  effectiveQuery: string;
  /** Called when user edits the query in CodeMirror */
  onRawQueryChange: (value: string) => void;
  /** Called when CodeMirror editor view is created */
  onCreateEditor: (view: EditorView) => void;
  /** CodeMirror extensions (signal-specific LLM prompts, etc.) */
  queryEditorExtensions: Extension[];

  themeMode: "light" | "dark";

  searchLoading: boolean;
  onSearch: () => void;
  searchResultCount: number | null;
  /** Whether to render Search buttons (default: true) */
  showSearchButtons?: boolean;

  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Whether to show query summary text in collapsed header */
  showCollapsedQuerySummary?: boolean;

  /** Count of active filters for the collapsed header chip */
  activeFilterCount: number;
  /** Called when user clicks "Reset Filters" in the expanded header */
  onResetFilters: () => void;

  /** Renders the signal-specific filter controls above the editor */
  renderFilterControls: () => ReactNode;
  /** Optional label shown above filter controls (e.g. step label) */
  filterControlsLabel?: string;
  /** Optional label shown above the ES|QL editor */
  queryEditorLabel?: string;
  /** Optional helper text shown below queryEditorLabel */
  queryEditorDescription?: string;
  /** Optional section title for the ES|QL editor block */
  queryEditorSectionTitle?: string;
  /** Whether ES|QL editor block starts collapsed */
  queryEditorCollapsedByDefault?: boolean;
  /** Whether to render the ES|QL editor block in this panel */
  showQueryEditor?: boolean;

  /** Editor height in px (default: 120) */
  editorHeight?: number;
}

export default function SignalSearchPanel({
  title,
  resultNoun,
  effectiveQuery,
  onRawQueryChange,
  onCreateEditor,
  queryEditorExtensions,
  themeMode,
  searchLoading,
  onSearch,
  searchResultCount,
  showSearchButtons = true,
  collapsed,
  onToggleCollapsed,
  showCollapsedQuerySummary = true,
  activeFilterCount,
  onResetFilters,
  renderFilterControls,
  filterControlsLabel,
  queryEditorLabel,
  queryEditorDescription,
  queryEditorSectionTitle,
  queryEditorCollapsedByDefault: rawQueryEditorCollapsedByDefault = false,
  showQueryEditor = true,
  editorHeight = DEFAULT_EDITOR_HEIGHT,
}: SignalSearchPanelProps) {
  // Prevent unrecoverable hidden state: only allow collapsed-by-default if there's a
  // section title that renders the toggle button.
  const queryEditorCollapsedByDefault =
    rawQueryEditorCollapsedByDefault && Boolean(queryEditorSectionTitle);
  const [editorFocused, setEditorFocused] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const [queryEditorCollapsed, setQueryEditorCollapsed] = useState(queryEditorCollapsedByDefault);
  const explainPanelId = useId();
  const resultLabel = (count: number) => (count === 1 ? resultNoun.replace(/s$/, "") : resultNoun);

  const editorExtensions = useMemo(
    () => [
      ...queryEditorExtensions,
      EditorView.contentAttributes.of({ "aria-label": "ES|QL query editor" }),
      EditorView.focusChangeEffect.of((_state, focusing) => {
        setEditorFocused(focusing);
        return null;
      }),
    ],
    // queryEditorExtensions must be referentially stable (useMemo([], []) in parent)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const explanation = useQueryExplanation(effectiveQuery);

  return (
    <Paper variant="outlined" sx={{ p: collapsed ? 1 : 1.5 }}>
      {/* Always-visible header bar */}
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <IconButton
          size="small"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand search panel" : "Collapse search panel"}
        >
          <ExpandMoreIcon
            sx={{
              transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
              fontSize: 20,
            }}
          />
        </IconButton>

        <Typography
          variant={collapsed ? "body2" : "h5"}
          component="h1"
          sx={{ whiteSpace: "nowrap", fontWeight: 600 }}
        >
          {title}
        </Typography>

        {collapsed && (
          <>
            {showCollapsedQuerySummary && (
              <Typography
                variant="body2"
                color="text.secondary"
                noWrap
                sx={{ flex: 1, minWidth: 0, fontStyle: "italic" }}
              >
                {explanation ?? effectiveQuery}
              </Typography>
            )}

            {activeFilterCount > 0 && (
              <Chip
                size="small"
                label={`${activeFilterCount} filter${activeFilterCount !== 1 ? "s" : ""}`}
              />
            )}

            {showSearchButtons && (
              <Button
                variant="contained"
                size="small"
                sx={{ flexShrink: 0, minHeight: TOOLBAR_CONTROL_HEIGHT }}
                startIcon={
                  searchLoading ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />
                }
                onClick={onSearch}
                disabled={searchLoading || !effectiveQuery.trim()}
              >
                Search
              </Button>
            )}

            {searchResultCount !== null && (
              <Typography variant="caption" color="text.secondary" noWrap sx={{ flexShrink: 0 }}>
                {searchResultCount} {resultLabel(searchResultCount)}
              </Typography>
            )}
          </>
        )}

        {!collapsed && (
          <Box sx={{ display: "flex", flex: 1, justifyContent: "flex-end" }}>
            <Button size="small" variant="text" onClick={onResetFilters}>
              Reset Filters
            </Button>
          </Box>
        )}
      </Box>

      {/* Collapsible body */}
      <Collapse in={!collapsed} unmountOnExit>
        {!collapsed && (
          <>
            {/* Signal-specific filter controls */}
            {filterControlsLabel && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 0.5 }}
              >
                {filterControlsLabel}
              </Typography>
            )}
            {renderFilterControls()}

            {/* ES|QL editor */}
            {showQueryEditor && (
              <Box
                sx={
                  queryEditorSectionTitle
                    ? {
                        overflow: "hidden",
                        mb: 1,
                        border: 1,
                        borderColor: "divider",
                        borderRadius: 1,
                      }
                    : undefined
                }
              >
                {queryEditorSectionTitle && (
                  <Box
                    sx={{
                      display: "flex",
                      gap: 0.5,
                      alignItems: "center",
                      py: 0.5,
                      px: 0.5,
                      bgcolor: "action.hover",
                    }}
                  >
                    <IconButton
                      size="small"
                      onClick={() => setQueryEditorCollapsed((v) => !v)}
                      aria-expanded={!queryEditorCollapsed}
                      aria-label={
                        queryEditorCollapsed
                          ? "Expand ES|QL query section"
                          : "Collapse ES|QL query section"
                      }
                    >
                      <ExpandMoreIcon
                        sx={{
                          transform: queryEditorCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                          transition: "transform 0.2s",
                          fontSize: 18,
                        }}
                      />
                    </IconButton>
                    <Typography variant="caption" color="text.secondary">
                      {queryEditorSectionTitle}
                    </Typography>
                  </Box>
                )}
                <Collapse in={!queryEditorCollapsed} unmountOnExit>
                  <Box sx={queryEditorSectionTitle ? { p: 1, pt: 0.5 } : undefined}>
                    {(queryEditorLabel || queryEditorDescription) && (
                      <Box sx={{ mb: 0.5 }}>
                        {queryEditorLabel && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block" }}
                          >
                            {queryEditorLabel}
                          </Typography>
                        )}
                        {queryEditorDescription && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block" }}
                          >
                            {queryEditorDescription}
                          </Typography>
                        )}
                      </Box>
                    )}
                    <Box
                      sx={{
                        overflow: "hidden",
                        mb: queryEditorSectionTitle ? 0 : 1,
                        border: 1,
                        borderColor: "divider",
                        borderRadius: 1,
                      }}
                    >
                      <Box sx={{ position: "relative" }}>
                        <CodeMirror
                          value={effectiveQuery}
                          onChange={onRawQueryChange}
                          onCreateEditor={onCreateEditor}
                          extensions={editorExtensions}
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
                        {/* Explain Query button — bottom-right of the editor box */}
                        <Box
                          sx={{
                            position: "absolute",
                            zIndex: 3,
                            right: 8,
                            bottom: 6,
                          }}
                        >
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<AutoAwesomeIcon sx={{ fontSize: "14px !important" }} />}
                            onClick={() => setExplainOpen((v) => !v)}
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
                          {explanation ? (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ fontStyle: "italic" }}
                            >
                              {explanation}
                            </Typography>
                          ) : (
                            <Typography
                              variant="body2"
                              color="text.disabled"
                              sx={{ fontStyle: "italic" }}
                            >
                              Generating explanation… (requires an AI provider configured in
                              Settings)
                            </Typography>
                          )}
                        </Box>
                      </Collapse>
                    </Box>
                  </Box>
                </Collapse>
              </Box>
            )}

            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              {showSearchButtons && (
                <Button
                  variant="contained"
                  size="small"
                  sx={{ minHeight: TOOLBAR_CONTROL_HEIGHT }}
                  startIcon={
                    searchLoading ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : (
                      <PlayArrowIcon />
                    )
                  }
                  onClick={onSearch}
                  disabled={searchLoading || !effectiveQuery.trim()}
                >
                  Search {resultNoun.charAt(0).toUpperCase() + resultNoun.slice(1)}
                </Button>
              )}
              {searchResultCount !== null && (
                <Typography variant="caption" color="text.secondary">
                  {searchResultCount} {resultLabel(searchResultCount)} found
                </Typography>
              )}
            </Stack>
          </>
        )}
      </Collapse>
    </Paper>
  );
}
