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

  collapsed: boolean;
  onToggleCollapsed: () => void;

  /** Count of active filters for the collapsed header chip */
  activeFilterCount: number;
  /** Called when user clicks "Reset Filters" in the expanded header */
  onResetFilters: () => void;

  /** Renders the signal-specific filter controls above the editor */
  renderFilterControls: () => ReactNode;

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
  collapsed,
  onToggleCollapsed,
  activeFilterCount,
  onResetFilters,
  renderFilterControls,
  editorHeight = DEFAULT_EDITOR_HEIGHT,
}: SignalSearchPanelProps) {
  const [editorFocused, setEditorFocused] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const explainPanelId = useId();
  const resultLabel = (count: number) => (count === 1 ? resultNoun.replace(/s$/, "") : resultNoun);

  const editorExtensions = useMemo(
    () => [
      ...queryEditorExtensions,
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
            <Typography
              variant="body2"
              color="text.secondary"
              noWrap
              sx={{ flex: 1, minWidth: 0, fontStyle: "italic" }}
            >
              {explanation ?? effectiveQuery}
            </Typography>

            {activeFilterCount > 0 && (
              <Chip
                size="small"
                label={`${activeFilterCount} filter${activeFilterCount !== 1 ? "s" : ""}`}
              />
            )}

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
            {renderFilterControls()}

            {/* ES|QL editor */}
            <Box
              sx={{ overflow: "hidden", mb: 1, border: 1, borderColor: "divider", borderRadius: 1 }}
            >
              <Box sx={{ position: "relative" }}>
                <CodeMirror
                  value={effectiveQuery}
                  onChange={onRawQueryChange}
                  onCreateEditor={onCreateEditor}
                  extensions={editorExtensions}
                  theme={themeMode}
                  height={`${editorHeight}px`}
                  basicSetup={{ lineNumbers: true, foldGutter: false, indentOnInput: false }}
                  aria-label={`${title} query editor`}
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

            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Button
                variant="contained"
                size="small"
                sx={{ minHeight: TOOLBAR_CONTROL_HEIGHT }}
                startIcon={
                  searchLoading ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />
                }
                onClick={onSearch}
                disabled={searchLoading || !effectiveQuery.trim()}
              >
                Search {resultNoun.charAt(0).toUpperCase() + resultNoun.slice(1)}
              </Button>
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
