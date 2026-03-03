import { useState, useCallback, useEffect, useMemo } from "react";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

import SignalSearchPanel from "../SignalSearchPanel";

import type { LogsFilterChip } from "./logsQueryBuilder";

interface LogsSearchPanelProps {
  searchText: string;
  onSearchTextChange: (text: string) => void;
  filters: LogsFilterChip[];
  onRemoveFilter: (index: number) => void;
  onClearFilters: () => void;
  effectiveQuery: string;
  onRawQueryChange: (value: string) => void;
  onCreateEditor: (view: EditorView) => void;
  queryEditorExtensions: Extension[];
  themeMode: "light" | "dark";
  searchLoading: boolean;
  onSearch: () => void;
  searchResultCount: number | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export default function LogsSearchPanel({
  searchText,
  onSearchTextChange,
  filters,
  onRemoveFilter,
  onClearFilters,
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
}: LogsSearchPanelProps) {
  const [searchInput, setSearchInput] = useState(searchText);

  useEffect(() => {
    setSearchInput(searchText);
  }, [searchText]);

  const activeFilterCount = useMemo(
    () => filters.length + (searchText.trim() ? 1 : 0),
    [filters.length, searchText],
  );

  const handleResetFilters = useCallback(() => {
    onClearFilters();
    onSearchTextChange("");
  }, [onClearFilters, onSearchTextChange]);

  const renderFilterControls = useCallback(
    () => (
      <>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mt: 0.5, mb: 1 }}>
          <TextField
            size="small"
            fullWidth
            label="Search logs"
            placeholder='Use quotes for phrase match, e.g. "connection reset by peer"'
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onSearchTextChange(searchInput);
              }
            }}
          />
          <Button
            size="small"
            variant="outlined"
            onClick={() => onSearchTextChange(searchInput)}
            sx={{ minWidth: 112 }}
          >
            Apply Search
          </Button>
        </Stack>

        {filters.length > 0 && (
          <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap", mb: 1 }}>
            {filters.map((filter, index) => (
              <Chip
                key={`${filter.field}-${filter.value}-${String(filter.exclude)}-${index}`}
                size="small"
                color={filter.exclude ? "warning" : "default"}
                label={`${filter.exclude ? "NOT " : ""}${filter.field}: ${filter.value}`}
                onDelete={() => onRemoveFilter(index)}
              />
            ))}
          </Stack>
        )}
      </>
    ),
    [searchInput, filters, onSearchTextChange, onRemoveFilter],
  );

  return (
    <SignalSearchPanel
      title="Logs Explorer"
      resultNoun="rows"
      effectiveQuery={effectiveQuery}
      onRawQueryChange={onRawQueryChange}
      onCreateEditor={onCreateEditor}
      queryEditorExtensions={queryEditorExtensions}
      themeMode={themeMode}
      searchLoading={searchLoading}
      onSearch={onSearch}
      searchResultCount={searchResultCount}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      activeFilterCount={activeFilterCount}
      onResetFilters={handleResetFilters}
      renderFilterControls={renderFilterControls}
    />
  );
}
