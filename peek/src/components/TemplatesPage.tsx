import { useCallback, useDeferredValue, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Drawer from "@mui/material/Drawer";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Tab from "@mui/material/Tab";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import DescriptionIcon from "@mui/icons-material/Description";
import { parseAsBoolean, parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";

import { useSimulatedIndexTemplate, useTemplates } from "../hooks/useTemplates";
import { COMPONENT_HEIGHTS } from "../types/tokens";

import EmptyState from "./EmptyState";
import PageContainer from "./PageContainer";
import PageHeaderSection from "./PageHeaderSection";
import { OverviewInfoCard } from "./OverviewInfoCard";
import {
  compareIndexTpls,
  compareCompTpls,
  type IndexTplSortField,
  type CompTplSortField,
  type SortDirection,
} from "./templatesSortUtils";

// Re-export so existing consumers still work
export { compareIndexTpls, compareCompTpls } from "./templatesSortUtils";
export type { IndexTplSortField, CompTplSortField, SortDirection } from "./templatesSortUtils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEMPLATE_TABS: Array<"index" | "component"> = ["index", "component"];
const INDEX_TPL_SORT_FIELDS: IndexTplSortField[] = [
  "name",
  "priority",
  "composedOfCount",
  "dataStream",
];
const COMP_TPL_SORT_FIELDS: CompTplSortField[] = ["name", "usedByCount", "version"];
const SORT_DIRECTIONS: SortDirection[] = ["asc", "desc"];

const HIGH_PRIORITY_THRESHOLD = 500;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TemplatesPage() {
  const result = useTemplates();
  const loading = result.status === "loading";
  const indexTemplates = result.status === "success" ? result.data.indexTemplates : [];
  const componentTemplates = result.status === "success" ? result.data.componentTemplates : [];

  const [urlState, setUrlState] = useQueryStates(
    {
      tab: parseAsStringEnum<"index" | "component">(TEMPLATE_TABS).withDefault("index"),
      q: parseAsString.withDefault(""),
      indexTplSortField:
        parseAsStringEnum<IndexTplSortField>(INDEX_TPL_SORT_FIELDS).withDefault("name"),
      indexTplSortDir: parseAsStringEnum<SortDirection>(SORT_DIRECTIONS).withDefault("asc"),
      compTplSortField:
        parseAsStringEnum<CompTplSortField>(COMP_TPL_SORT_FIELDS).withDefault("name"),
      compTplSortDir: parseAsStringEnum<SortDirection>(SORT_DIRECTIONS).withDefault("asc"),
      dataStreamOnly: parseAsBoolean.withDefault(false),
      showSystem: parseAsBoolean.withDefault(false),
      priorityMin: parseAsString.withDefault(""),
      priorityMax: parseAsString.withDefault(""),
    },
    { history: "replace" },
  );

  const activeTab = urlState.tab;
  const search = urlState.q;
  const deferredSearch = useDeferredValue(search);
  const indexTplSortField = urlState.indexTplSortField;
  const indexTplSortDir = urlState.indexTplSortDir;
  const compTplSortField = urlState.compTplSortField;
  const compTplSortDir = urlState.compTplSortDir;
  const dataStreamOnly = urlState.dataStreamOnly;
  const showSystem = urlState.showSystem;
  const priorityMin = urlState.priorityMin;
  const priorityMax = urlState.priorityMax;

  // Filter out system templates (names starting with ".") when toggle is off
  const visibleIndexTemplates = useMemo(
    () => indexTemplates.filter((t) => showSystem || !t.name.startsWith(".")),
    [indexTemplates, showSystem],
  );
  const visibleComponentTemplates = useMemo(
    () => componentTemplates.filter((t) => showSystem || !t.name.startsWith(".")),
    [componentTemplates, showSystem],
  );

  // Index templates sort
  const handleIndexTplSort = useCallback(
    (field: IndexTplSortField) => {
      const nextDir: SortDirection =
        indexTplSortField === field && indexTplSortDir === "asc" ? "desc" : "asc";
      void setUrlState({ indexTplSortField: field, indexTplSortDir: nextDir });
    },
    [indexTplSortField, indexTplSortDir, setUrlState],
  );

  // Component templates sort
  const handleCompTplSort = useCallback(
    (field: CompTplSortField) => {
      const nextDir: SortDirection =
        compTplSortField === field && compTplSortDir === "asc" ? "desc" : "asc";
      void setUrlState({ compTplSortField: field, compTplSortDir: nextDir });
    },
    [compTplSortField, compTplSortDir, setUrlState],
  );

  // Detail flyover
  const [selectedTemplateName, setSelectedTemplateName] = useState<string | null>(null);
  const selectedTemplate = useMemo(
    () => indexTemplates.find((t) => t.name === selectedTemplateName) ?? null,
    [indexTemplates, selectedTemplateName],
  );
  const selectedComponentTemplate = useMemo(
    () => componentTemplates.find((t) => t.name === selectedTemplateName) ?? null,
    [componentTemplates, selectedTemplateName],
  );
  const simulatedTemplate = useSimulatedIndexTemplate(selectedTemplate?.name ?? null);

  // Derived metrics
  const dsCount = useMemo(
    () => visibleIndexTemplates.filter((t) => t.dataStreamEnabled).length,
    [visibleIndexTemplates],
  );
  const highPriorityCount = useMemo(
    () => visibleIndexTemplates.filter((t) => t.priority >= HIGH_PRIORITY_THRESHOLD).length,
    [visibleIndexTemplates],
  );

  // Filter + sort
  const filteredIndexTemplates = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    const minPriority = Number(priorityMin);
    const maxPriority = Number(priorityMax);
    const hasMin = priorityMin.trim() !== "" && Number.isFinite(minPriority);
    const hasMax = priorityMax.trim() !== "" && Number.isFinite(maxPriority);
    const filtered = visibleIndexTemplates.filter((t) => {
      if (dataStreamOnly && !t.dataStreamEnabled) return false;
      if (hasMin && t.priority < minPriority) return false;
      if (hasMax && t.priority > maxPriority) return false;
      if (!term) return true;
      return (
        t.name.toLowerCase().includes(term) ||
        t.indexPatterns.some((p) => p.toLowerCase().includes(term)) ||
        t.composedOf.some((c) => c.toLowerCase().includes(term))
      );
    });
    return [...filtered].sort((a, b) => compareIndexTpls(a, b, indexTplSortField, indexTplSortDir));
  }, [
    visibleIndexTemplates,
    deferredSearch,
    indexTplSortField,
    indexTplSortDir,
    dataStreamOnly,
    priorityMin,
    priorityMax,
  ]);

  const filteredComponentTemplates = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    const filtered = visibleComponentTemplates.filter((t) => {
      if (!term) return true;
      return t.name.toLowerCase().includes(term);
    });
    return [...filtered].sort((a, b) => compareCompTpls(a, b, compTplSortField, compTplSortDir));
  }, [visibleComponentTemplates, deferredSearch, compTplSortField, compTplSortDir]);

  if (result.status === "error") {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{result.error}</Alert>
      </Box>
    );
  }

  return (
    <PageContainer>
      <PageHeaderSection
        title="Index Templates"
        actions={
          <Button
            size="small"
            variant="outlined"
            onClick={result.refresh}
            aria-label={loading ? "Refreshing templates" : "Refresh templates"}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        }
      />

      {/* KPI cards */}
      <Grid container spacing={2}>
        <Grid item xs={6} sm={3}>
          <OverviewInfoCard title="Index Templates">
            <Typography variant="h5" component="p">
              {visibleIndexTemplates.length}
            </Typography>
          </OverviewInfoCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <OverviewInfoCard title="Component Templates">
            <Typography variant="h5" component="p">
              {visibleComponentTemplates.length}
            </Typography>
          </OverviewInfoCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <OverviewInfoCard title="Data-Stream Enabled">
            <Typography variant="h5" component="p">
              {dsCount}
            </Typography>
          </OverviewInfoCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <OverviewInfoCard title={`High Priority (≥${HIGH_PRIORITY_THRESHOLD})`}>
            <Typography variant="h5" component="p">
              {highPriorityCount}
            </Typography>
          </OverviewInfoCard>
        </Grid>
      </Grid>

      {/* Tabs + Search */}
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => void setUrlState({ tab: v as "index" | "component" })}
          sx={{ minHeight: COMPONENT_HEIGHTS.tab }}
        >
          <Tab
            label="Index Templates"
            value="index"
            sx={{ minHeight: COMPONENT_HEIGHTS.tab, py: 0 }}
          />
          <Tab
            label="Component Templates"
            value="component"
            sx={{ minHeight: COMPONENT_HEIGHTS.tab, py: 0 }}
          />
        </Tabs>
        <TextField
          size="small"
          placeholder="Filter templates..."
          value={search}
          onChange={(e) => void setUrlState({ q: e.target.value })}
          sx={{ minWidth: 260 }}
          aria-label="Filter templates"
        />
        <Button
          size="small"
          variant={showSystem ? "contained" : "outlined"}
          onClick={() => void setUrlState({ showSystem: !showSystem })}
        >
          Show system templates
        </Button>
        {activeTab === "index" && (
          <>
            <TextField
              size="small"
              value={priorityMin}
              onChange={(e) => void setUrlState({ priorityMin: e.target.value })}
              placeholder="Min priority"
              sx={{ width: 130 }}
              inputProps={{ inputMode: "numeric" }}
              aria-label="Minimum template priority"
            />
            <TextField
              size="small"
              value={priorityMax}
              onChange={(e) => void setUrlState({ priorityMax: e.target.value })}
              placeholder="Max priority"
              sx={{ width: 130 }}
              inputProps={{ inputMode: "numeric" }}
              aria-label="Maximum template priority"
            />
            <Button
              size="small"
              variant={dataStreamOnly ? "contained" : "outlined"}
              onClick={() => void setUrlState({ dataStreamOnly: !dataStreamOnly })}
            >
              Data-stream only
            </Button>
          </>
        )}
      </Box>

      {/* Index templates table */}
      {activeTab === "index" && (
        <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          <TableContainer>
            <Table size="small" stickyHeader aria-label="Index templates">
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel
                      active={indexTplSortField === "name"}
                      direction={indexTplSortField === "name" ? indexTplSortDir : "asc"}
                      onClick={() => handleIndexTplSort("name")}
                    >
                      Name
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Index Patterns</TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={indexTplSortField === "priority"}
                      direction={indexTplSortField === "priority" ? indexTplSortDir : "asc"}
                      onClick={() => handleIndexTplSort("priority")}
                    >
                      Priority
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={indexTplSortField === "composedOfCount"}
                      direction={indexTplSortField === "composedOfCount" ? indexTplSortDir : "asc"}
                      onClick={() => handleIndexTplSort("composedOfCount")}
                    >
                      Composed Of
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={indexTplSortField === "dataStream"}
                      direction={indexTplSortField === "dataStream" ? indexTplSortDir : "asc"}
                      onClick={() => handleIndexTplSort("dataStream")}
                    >
                      Data Stream
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Version</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && indexTemplates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ py: 0, border: 0 }}>
                      <LinearProgress />
                    </TableCell>
                  </TableRow>
                )}
                {filteredIndexTemplates.map((tpl) => (
                  <TableRow
                    key={tpl.name}
                    hover
                    selected={tpl.name === selectedTemplateName}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open template details for ${tpl.name}`}
                    onClick={() => setSelectedTemplateName(tpl.name)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
                        event.preventDefault();
                        setSelectedTemplateName(tpl.name);
                      }
                    }}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                      >
                        {tpl.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                        {tpl.indexPatterns.map((p, i) => (
                          <Chip key={`${p}-${i}`} label={p} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>{tpl.priority}</TableCell>
                    <TableCell>{tpl.composedOfCount}</TableCell>
                    <TableCell>
                      {tpl.dataStreamEnabled ? (
                        <Chip label="Yes" size="small" color="info" variant="outlined" />
                      ) : (
                        "No"
                      )}
                    </TableCell>
                    <TableCell>{tpl.version}</TableCell>
                  </TableRow>
                ))}
                {!loading && filteredIndexTemplates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ border: 0 }}>
                      <EmptyState
                        size="small"
                        icon={<DescriptionIcon sx={{ fontSize: 28 }} />}
                        heading="No index templates found"
                        description={
                          search || dataStreamOnly || priorityMin || priorityMax || !showSystem
                            ? 'Try adjusting your filters or enable "Show system templates".'
                            : "No index templates configured."
                        }
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Component templates table */}
      {activeTab === "component" && (
        <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          <TableContainer>
            <Table size="small" stickyHeader aria-label="Component templates">
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel
                      active={compTplSortField === "name"}
                      direction={compTplSortField === "name" ? compTplSortDir : "asc"}
                      onClick={() => handleCompTplSort("name")}
                    >
                      Name
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Includes</TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={compTplSortField === "version"}
                      direction={compTplSortField === "version" ? compTplSortDir : "asc"}
                      onClick={() => handleCompTplSort("version")}
                    >
                      Version
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={compTplSortField === "usedByCount"}
                      direction={compTplSortField === "usedByCount" ? compTplSortDir : "asc"}
                      onClick={() => handleCompTplSort("usedByCount")}
                    >
                      Used By
                    </TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && componentTemplates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} sx={{ py: 0, border: 0 }}>
                      <LinearProgress />
                    </TableCell>
                  </TableRow>
                )}
                {filteredComponentTemplates.map((ct) => (
                  <TableRow
                    key={ct.name}
                    hover
                    tabIndex={0}
                    role="button"
                    aria-label={`View component template ${ct.name}`}
                    onClick={() => setSelectedTemplateName(ct.name)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
                        event.preventDefault();
                        setSelectedTemplateName(ct.name);
                      }
                    }}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                      >
                        {ct.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 0.5 }}>
                        {ct.hasMappings && (
                          <Chip label="Mappings" size="small" variant="outlined" />
                        )}
                        {ct.hasSettings && (
                          <Chip label="Settings" size="small" variant="outlined" />
                        )}
                        {ct.hasAliases && <Chip label="Aliases" size="small" variant="outlined" />}
                        {!ct.hasMappings && !ct.hasSettings && !ct.hasAliases && "—"}
                      </Box>
                    </TableCell>
                    <TableCell>{ct.version}</TableCell>
                    <TableCell>{ct.usedByCount}</TableCell>
                  </TableRow>
                ))}
                {!loading && filteredComponentTemplates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} sx={{ border: 0 }}>
                      <EmptyState
                        size="small"
                        icon={<DescriptionIcon sx={{ fontSize: 28 }} />}
                        heading="No component templates found"
                        description={
                          search || !showSystem
                            ? 'Try adjusting your filters or enable "Show system templates".'
                            : "No component templates configured."
                        }
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Detail flyover */}
      <Drawer
        anchor="right"
        open={Boolean(selectedTemplate || selectedComponentTemplate)}
        onClose={() => setSelectedTemplateName(null)}
        PaperProps={{
          sx: {
            width: { xs: "100%", md: 560 },
            p: 1,
            backgroundColor: "background.default",
          },
        }}
      >
        {selectedTemplate && (
          <>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                px: 1,
              }}
            >
              <Typography variant="subtitle1">Template Details</Typography>
              <IconButton
                size="small"
                aria-label="Close template details"
                onClick={() => setSelectedTemplateName(null)}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", px: 1, py: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                NAME
              </Typography>
              <Typography variant="body2" gutterBottom sx={{ fontFamily: "monospace" }}>
                {selectedTemplate.name}
              </Typography>

              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                INDEX PATTERNS
              </Typography>
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1 }}>
                {selectedTemplate.indexPatterns.map((p, i) => (
                  <Chip key={`${p}-${i}`} label={p} size="small" variant="outlined" />
                ))}
              </Box>

              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                PRIORITY
              </Typography>
              <Typography variant="body2" gutterBottom>
                {selectedTemplate.priority}
              </Typography>

              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                DATA STREAM
              </Typography>
              <Typography variant="body2" gutterBottom>
                {selectedTemplate.dataStreamEnabled ? "Enabled" : "Disabled"}
              </Typography>

              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                VERSION
              </Typography>
              <Typography variant="body2" gutterBottom>
                {selectedTemplate.version}
              </Typography>

              {selectedTemplate.composedOf.length > 0 && (
                <>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    COMPOSED OF (in order)
                  </Typography>
                  <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1 }}>
                    {selectedTemplate.composedOf.map((c, i) => (
                      <Chip
                        key={`${c}-${i}`}
                        label={`${i + 1}. ${c}`}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </>
              )}

              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  SIMULATED OUTPUT
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{ p: 1, maxHeight: 260, overflow: "auto", fontSize: "0.75rem" }}
                >
                  {simulatedTemplate.status === "loading" ? (
                    <LinearProgress />
                  ) : simulatedTemplate.status === "error" ? (
                    <Typography variant="body2" color="error">
                      {simulatedTemplate.error}
                    </Typography>
                  ) : (
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {JSON.stringify(
                        simulatedTemplate.status === "success" ? simulatedTemplate.data : {},
                        null,
                        2,
                      )}
                    </pre>
                  )}
                </Paper>
              </Box>

              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  RAW JSON
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{ p: 1, maxHeight: 300, overflow: "auto", fontSize: "0.75rem" }}
                >
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {JSON.stringify(selectedTemplate.raw ?? selectedTemplate, null, 2)}
                  </pre>
                </Paper>
              </Box>
            </Box>
          </>
        )}
        {!selectedTemplate && selectedComponentTemplate && (
          <>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                px: 1,
              }}
            >
              <Typography variant="subtitle1">Component Template Details</Typography>
              <IconButton
                size="small"
                aria-label="Close template details"
                onClick={() => setSelectedTemplateName(null)}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", px: 1, py: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                NAME
              </Typography>
              <Typography variant="body2" gutterBottom sx={{ fontFamily: "monospace" }}>
                {selectedComponentTemplate.name}
              </Typography>

              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                VERSION
              </Typography>
              <Typography variant="body2" gutterBottom>
                {selectedComponentTemplate.version}
              </Typography>

              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                INCLUDES
              </Typography>
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1 }}>
                {selectedComponentTemplate.hasMappings && (
                  <Chip label="Mappings" size="small" variant="outlined" />
                )}
                {selectedComponentTemplate.hasSettings && (
                  <Chip label="Settings" size="small" variant="outlined" />
                )}
                {selectedComponentTemplate.hasAliases && (
                  <Chip label="Aliases" size="small" variant="outlined" />
                )}
                {!selectedComponentTemplate.hasMappings &&
                  !selectedComponentTemplate.hasSettings &&
                  !selectedComponentTemplate.hasAliases && (
                    <Typography variant="body2" color="text.secondary">
                      None
                    </Typography>
                  )}
              </Box>

              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                USED BY
              </Typography>
              <Typography variant="body2" gutterBottom>
                {selectedComponentTemplate.usedByCount} index template
                {selectedComponentTemplate.usedByCount !== 1 ? "s" : ""}
              </Typography>
            </Box>
          </>
        )}
      </Drawer>
    </PageContainer>
  );
}
