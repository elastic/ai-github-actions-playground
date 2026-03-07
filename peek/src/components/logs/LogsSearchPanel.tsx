import { useState, useCallback, useEffect, useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Step from "@mui/material/Step";
import StepButton from "@mui/material/StepButton";
import Stepper from "@mui/material/Stepper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AutoGraphIcon from "@mui/icons-material/AutoGraph";
import CategoryIcon from "@mui/icons-material/Category";
import HubIcon from "@mui/icons-material/Hub";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import ScienceIcon from "@mui/icons-material/Science";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

import { COMPONENT_HEIGHTS } from "../../types/tokens";
import SignalSearchPanel from "../SignalSearchPanel";

import type { LogsFilterChip } from "./logsQueryBuilder";

interface LogsSearchPanelProps {
  searchText: string;
  onSearchTextChange: (text: string) => void;
  filters: LogsFilterChip[];
  onAddFilter: (filter: LogsFilterChip) => void;
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
  onGuidedGenericMatch: (text: string) => void;
  onUseCaseChangePoint: () => void;
  onUseCaseCategorize: () => void;
  onUseCaseErrorTriage: () => void;
  onUseCaseServicePivot: (opts: { serviceName?: string; topN: number }) => void;
  onUseCaseTraceCorrelation: () => void;
  onUseCaseExtractFields: () => void;
}

export default function LogsSearchPanel({
  searchText,
  onSearchTextChange,
  filters,
  onAddFilter,
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
  onGuidedGenericMatch,
  onUseCaseChangePoint,
  onUseCaseCategorize,
  onUseCaseErrorTriage,
  onUseCaseServicePivot,
  onUseCaseTraceCorrelation,
  onUseCaseExtractFields,
}: LogsSearchPanelProps) {
  const [guidedInput, setGuidedInput] = useState(searchText);
  const [activeStep, setActiveStep] = useState(0);
  const [pivotService, setPivotService] = useState("");
  const [pivotTopN, setPivotTopN] = useState("25");
  const [serviceFilterInput, setServiceFilterInput] = useState("");
  const [hostFilterInput, setHostFilterInput] = useState("");
  const [levelFilterInput, setLevelFilterInput] = useState("");

  useEffect(() => {
    setGuidedInput(searchText);
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
        <Stepper nonLinear activeStep={activeStep} sx={{ mb: 1 }}>
          {["Intent", "Refine", "Review & run"].map((label, index) => (
            <Step key={label}>
              <StepButton color="inherit" onClick={() => setActiveStep(index)}>
                {label}
              </StepButton>
            </Step>
          ))}
        </Stepper>

        {activeStep === 0 && (
          <>
            <Box sx={{ mb: 1 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 0.5 }}
              >
                Search logs
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={0.75}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder='e.g. "timeout in checkout"'
                  value={guidedInput}
                  onChange={(e) => setGuidedInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onGuidedGenericMatch(guidedInput);
                      setActiveStep(1);
                    }
                  }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    onGuidedGenericMatch(guidedInput);
                    setActiveStep(1);
                  }}
                  disabled={!guidedInput.trim()}
                  sx={{ minHeight: COMPONENT_HEIGHTS.input }}
                >
                  Apply
                </Button>
              </Stack>
            </Box>

            <Box sx={{ mb: 1 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 0.5 }}
              >
                Service pivot
              </Typography>
              <Stack direction={{ xs: "column", md: "row" }} spacing={0.75}>
                <TextField
                  size="small"
                  fullWidth
                  label="Service name (optional)"
                  placeholder="checkout-service"
                  value={pivotService}
                  onChange={(e) => setPivotService(e.target.value)}
                />
                <TextField
                  size="small"
                  type="number"
                  label="Top N"
                  value={pivotTopN}
                  onChange={(e) => setPivotTopN(e.target.value)}
                  inputProps={{ min: 5, max: 200, step: 1 }}
                  sx={{ width: { md: 120, xs: "100%" } }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<QueryStatsIcon />}
                  onClick={() => {
                    const parsed = Number(pivotTopN);
                    const topN = Number.isFinite(parsed)
                      ? Math.max(5, Math.min(200, Math.floor(parsed)))
                      : 25;
                    onUseCaseServicePivot({ serviceName: pivotService.trim() || undefined, topN });
                    setActiveStep(2);
                  }}
                  sx={{ minHeight: COMPONENT_HEIGHTS.input, whiteSpace: "nowrap" }}
                >
                  Run pivot
                </Button>
              </Stack>
            </Box>

            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 0.5 }}
              >
                Fast experiences
              </Typography>
              <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AutoGraphIcon />}
                  onClick={onUseCaseChangePoint}
                >
                  Change point
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<CategoryIcon />}
                  onClick={onUseCaseCategorize}
                >
                  Top patterns
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<WarningAmberIcon />}
                  onClick={onUseCaseErrorTriage}
                >
                  Error triage
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<HubIcon />}
                  onClick={onUseCaseTraceCorrelation}
                >
                  Trace correlation
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ScienceIcon />}
                  onClick={onUseCaseExtractFields}
                >
                  Extract fields
                </Button>
              </Stack>
            </Box>
          </>
        )}

        {activeStep === 1 && (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
              Add optional filters to tighten your query.
            </Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={0.75} sx={{ mb: 1 }}>
              <TextField
                size="small"
                label="Service"
                placeholder="checkout-service"
                value={serviceFilterInput}
                onChange={(e) => setServiceFilterInput(e.target.value)}
              />
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  const value = serviceFilterInput.trim();
                  if (!value) return;
                  onAddFilter({ field: "service.name", value });
                  setServiceFilterInput("");
                }}
                sx={{ minHeight: COMPONENT_HEIGHTS.input }}
              >
                Add service filter
              </Button>
              <TextField
                size="small"
                label="Host"
                placeholder="ip-10-0-1-10"
                value={hostFilterInput}
                onChange={(e) => setHostFilterInput(e.target.value)}
              />
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  const value = hostFilterInput.trim();
                  if (!value) return;
                  onAddFilter({ field: "host.name", value });
                  setHostFilterInput("");
                }}
                sx={{ minHeight: COMPONENT_HEIGHTS.input }}
              >
                Add host filter
              </Button>
              <TextField
                select
                size="small"
                label="Log level"
                value={levelFilterInput}
                onChange={(e) => setLevelFilterInput(e.target.value)}
                sx={{ minWidth: 140 }}
              >
                <MenuItem value="">Select level</MenuItem>
                <MenuItem value="trace">trace</MenuItem>
                <MenuItem value="debug">debug</MenuItem>
                <MenuItem value="info">info</MenuItem>
                <MenuItem value="warn">warn</MenuItem>
                <MenuItem value="error">error</MenuItem>
                <MenuItem value="fatal">fatal</MenuItem>
              </TextField>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  const value = levelFilterInput.trim();
                  if (!value) return;
                  onAddFilter({ field: "log.level", value });
                  setLevelFilterInput("");
                }}
                sx={{ minHeight: COMPONENT_HEIGHTS.input }}
              >
                Add level filter
              </Button>
            </Stack>
          </>
        )}

        {activeStep === 2 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            Review the generated ES|QL in the dedicated row below, tweak if needed, then run.
          </Typography>
        )}

        {filters.length > 0 && (
          <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap", mb: 1 }}>
            {filters.map((filter, index) => (
              <Chip
                key={`${filter.field}-${filter.value}-${String(filter.exclude)}`}
                size="small"
                color={filter.exclude ? "warning" : "default"}
                label={`${filter.exclude ? "NOT " : ""}${filter.field}: ${filter.value}`}
                onDelete={() => onRemoveFilter(index)}
              />
            ))}
          </Stack>
        )}

        <Stack direction="row" spacing={0.75} sx={{ mb: 0.5 }}>
          <Button
            size="small"
            variant="text"
            onClick={() => setActiveStep((prev) => Math.max(0, prev - 1))}
            disabled={activeStep === 0}
          >
            Back
          </Button>
          <Button
            size="small"
            variant="text"
            onClick={() => setActiveStep((prev) => Math.min(2, prev + 1))}
            disabled={activeStep === 2}
          >
            Next
          </Button>
        </Stack>
      </>
    ),
    [
      activeStep,
      filters,
      guidedInput,
      hostFilterInput,
      levelFilterInput,
      onRemoveFilter,
      onAddFilter,
      onGuidedGenericMatch,
      onUseCaseCategorize,
      onUseCaseChangePoint,
      onUseCaseErrorTriage,
      onUseCaseExtractFields,
      onUseCaseServicePivot,
      onUseCaseTraceCorrelation,
      pivotService,
      pivotTopN,
      serviceFilterInput,
      setActiveStep,
    ],
  );

  return (
    <SignalSearchPanel
      title="Logs Explorer"
      resultNoun="logs"
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
      filterControlsLabel="Query builder"
      showQueryEditor={false}
    />
  );
}
