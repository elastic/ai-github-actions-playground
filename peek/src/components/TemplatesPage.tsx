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

import type { IndexTemplateRow, ComponentTemplateRow } from "../services/es";
import { useTemplates } from "../hooks/useTemplates";
import { COMPONENT_HEIGHTS } from "../types/tokens";

import EmptyState from "./EmptyState";
import PageHeader from "./PageHeader";
import { OverviewInfoCard } from "./OverviewInfoCard";

// ---------------------------------------------------------------------------
// Sorting helpers
// ---------------------------------------------------------------------------

type IndexTplSortField = "name" | "priority" | "composedOfCount" | "dataStream";
type CompTplSortField = "name" | "usedByCount" | "version";
type SortDirection = "asc" | "desc";

function compareIndexTpls(
  a: IndexTemplateRow,
  b: IndexTemplateRow,
  field: IndexTplSortField,
  dir: SortDirection,
): number {
  let cmp: number;
  switch (field) {
    case "name":
      cmp = a.name.localeCompare(b.name);
      break;
    case "priority":
      cmp = a.priority - b.priority;
      break;
    case "composedOfCount":
      cmp = a.composedOfCount - b.composedOfCount;
      break;
    case "dataStream":
      cmp = Number(a.dataStreamEnabled) - Number(b.dataStreamEnabled);
      break;
    default:
      cmp = 0;
  }
  return dir === "asc" ? cmp : -cmp;
}

function compareCompTpls(
  a: ComponentTemplateRow,
  b: ComponentTemplateRow,
  field: CompTplSortField,
  dir: SortDirection,
): number {
  let cmp: number;
  switch (field) {
    case "name":
      cmp = a.name.localeCompare(b.name);
      break;
    case "usedByCount":
      cmp = a.usedByCount - b.usedByCount;
      break;
    case "version":
      cmp = String(a.version).localeCompare(String(b.version));
      break;
    default:
      cmp = 0;
  }
  return dir === "asc" ? cmp : -cmp;
}

const HIGH_PRIORITY_THRESHOLD = 500;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TemplatesPage() {
  const result = useTemplates();
  const loading = result.status === "loading";
  const indexTemplates = result.status === "success" ? result.data.indexTemplates : [];
  const componentTemplates = result.status === "success" ? result.data.componentTemplates : [];

  // Tab state
  const [activeTab, setActiveTab] = useState<"index" | "component">("index");

  // Search
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  // Index templates sort
  const [indexTplSortField, setIndexTplSortField] = useState<IndexTplSortField>("name");
  const [indexTplSortDir, setIndexTplSortDir] = useState<SortDirection>("asc");
  const handleIndexTplSort = useCallback(
    (field: IndexTplSortField) => {
      setIndexTplSortDir((prev) =>
        indexTplSortField === field && prev === "asc" ? "desc" : "asc",
      );
      setIndexTplSortField(field);
    },
    [indexTplSortField],
  );

  // Component templates sort
  const [compTplSortField, setCompTplSortField] = useState<CompTplSortField>("name");
  const [compTplSortDir, setCompTplSortDir] = useState<SortDirection>("asc");
  const handleCompTplSort = useCallback(
    (field: CompTplSortField) => {
      setCompTplSortDir((prev) => (compTplSortField === field && prev === "asc" ? "desc" : "asc"));
      setCompTplSortField(field);
    },
    [compTplSortField],
  );

  // Detail flyover (index template)
  const [selectedTemplateName, setSelectedTemplateName] = useState<string | null>(null);
  const selectedTemplate = useMemo(
    () => indexTemplates.find((t) => t.name === selectedTemplateName) ?? null,
    [indexTemplates, selectedTemplateName],
  );

  // Derived metrics
  const dsCount = useMemo(
    () => indexTemplates.filter((t) => t.dataStreamEnabled).length,
    [indexTemplates],
  );
  const highPriorityCount = useMemo(
    () => indexTemplates.filter((t) => t.priority >= HIGH_PRIORITY_THRESHOLD).length,
    [indexTemplates],
  );

  // Filter + sort
  const filteredIndexTemplates = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    const filtered = indexTemplates.filter((t) => {
      if (!term) return true;
      return (
        t.name.toLowerCase().includes(term) ||
        t.indexPatterns.some((p) => p.toLowerCase().includes(term)) ||
        t.composedOf.some((c) => c.toLowerCase().includes(term))
      );
    });
    return [...filtered].sort((a, b) => compareIndexTpls(a, b, indexTplSortField, indexTplSortDir));
  }, [indexTemplates, deferredSearch, indexTplSortField, indexTplSortDir]);

  const filteredComponentTemplates = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    const filtered = componentTemplates.filter((t) => {
      if (!term) return true;
      return t.name.toLowerCase().includes(term);
    });
    return [...filtered].sort((a, b) => compareCompTpls(a, b, compTplSortField, compTplSortDir));
  }, [componentTemplates, deferredSearch, compTplSortField, compTplSortDir]);

  if (result.status === "error") {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{result.error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, height: "100%", minHeight: 0 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title="Templates"
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
      </Paper>

      {/* KPI cards */}
      <Grid container spacing={2}>
        <Grid item xs={6} sm={3}>
          <OverviewInfoCard title="Index Templates">
            <Typography variant="h5" component="p">
              {indexTemplates.length}
            </Typography>
          </OverviewInfoCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <OverviewInfoCard title="Component Templates">
            <Typography variant="h5" component="p">
              {componentTemplates.length}
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
          onChange={(_, v) => setActiveTab(v as "index" | "component")}
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
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 260 }}
          aria-label="Filter templates"
        />
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
                    onClick={() => setSelectedTemplateName(tpl.name)}
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
                          search
                            ? "Try adjusting your search filter."
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
                  <TableRow key={ct.name} hover>
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
                          search
                            ? "Try adjusting your search filter."
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

      {/* Detail flyover (index template) */}
      <Drawer
        anchor="right"
        open={Boolean(selectedTemplate)}
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
                {selectedTemplate.indexPatterns.map((p) => (
                  <Chip key={p} label={p} size="small" variant="outlined" />
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
                      <Chip key={c} label={`${i + 1}. ${c}`} size="small" variant="outlined" />
                    ))}
                  </Box>
                </>
              )}

              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  RAW JSON
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{ p: 1, maxHeight: 300, overflow: "auto", fontSize: "0.75rem" }}
                >
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {JSON.stringify(selectedTemplate, null, 2)}
                  </pre>
                </Paper>
              </Box>
            </Box>
          </>
        )}
      </Drawer>
    </Box>
  );
}
