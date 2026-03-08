import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { parseAsBoolean, parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";

import { useSimulatedIndexTemplate, useTemplates } from "../hooks/useTemplates";

import ComponentTemplatesTable from "./ComponentTemplatesTable";
import DocLink from "./DocLink";
import IndexTemplatesOverviewCards from "./IndexTemplatesOverviewCards";
import IndexTemplatesTable from "./IndexTemplatesTable";
import IndexTemplatesToolbar from "./IndexTemplatesToolbar";
import {
  COMP_TPL_SORT_FIELDS,
  HIGH_PRIORITY_THRESHOLD,
  INDEX_TPL_SORT_FIELDS,
  SORT_DIRECTIONS,
  TEMPLATE_TABS,
  filterAndSortComponentTemplates,
  filterAndSortIndexTemplates,
  getNextSortDirection,
} from "./indexTemplatesPageHelpers";
import PageContainer from "./PageContainer";
import PageHeaderSection from "./PageHeaderSection";
import TemplateDetailsDrawer from "./TemplateDetailsDrawer";
import {
  type CompTplSortField,
  type IndexTplSortField,
  type SortDirection,
} from "./templatesSortUtils";

// Re-export so existing consumers still work
export { compareIndexTpls, compareCompTpls } from "./templatesSortUtils";
export type { IndexTplSortField, CompTplSortField, SortDirection } from "./templatesSortUtils";

export default function IndexTemplatesPage() {
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

  const [isFilterPending, startTransition] = useTransition();

  const activeTab = urlState.tab;
  const search = urlState.q;
  const [deferredSearch, setDeferredSearch] = useState(search);

  useEffect(() => {
    startTransition(() => setDeferredSearch(search));
  }, [search]);

  const indexTplSortField = urlState.indexTplSortField;
  const indexTplSortDir = urlState.indexTplSortDir;
  const compTplSortField = urlState.compTplSortField;
  const compTplSortDir = urlState.compTplSortDir;
  const dataStreamOnly = urlState.dataStreamOnly;
  const showSystem = urlState.showSystem;
  const priorityMin = urlState.priorityMin;
  const priorityMax = urlState.priorityMax;

  const visibleIndexTemplates = useMemo(
    () => indexTemplates.filter((template) => showSystem || !template.name.startsWith(".")),
    [indexTemplates, showSystem],
  );
  const visibleComponentTemplates = useMemo(
    () => componentTemplates.filter((template) => showSystem || !template.name.startsWith(".")),
    [componentTemplates, showSystem],
  );

  const handleIndexTplSort = useCallback(
    (field: IndexTplSortField) => {
      const nextDirection = getNextSortDirection(indexTplSortField, indexTplSortDir, field);
      void setUrlState({ indexTplSortField: field, indexTplSortDir: nextDirection });
    },
    [indexTplSortField, indexTplSortDir, setUrlState],
  );

  const handleCompTplSort = useCallback(
    (field: CompTplSortField) => {
      const nextDirection = getNextSortDirection(compTplSortField, compTplSortDir, field);
      void setUrlState({ compTplSortField: field, compTplSortDir: nextDirection });
    },
    [compTplSortField, compTplSortDir, setUrlState],
  );

  const [selectedTemplateRef, setSelectedTemplateRef] = useState<{
    kind: "index" | "component";
    name: string;
  } | null>(null);
  const selectedTemplate = useMemo(
    () =>
      selectedTemplateRef?.kind === "index"
        ? (indexTemplates.find((t) => t.name === selectedTemplateRef.name) ?? null)
        : null,
    [indexTemplates, selectedTemplateRef],
  );
  const selectedComponentTemplate = useMemo(
    () =>
      selectedTemplateRef?.kind === "component"
        ? (componentTemplates.find((t) => t.name === selectedTemplateRef.name) ?? null)
        : null,
    [componentTemplates, selectedTemplateRef],
  );
  const simulatedTemplate = useSimulatedIndexTemplate(selectedTemplate?.name ?? null);

  const dsCount = useMemo(
    () => visibleIndexTemplates.filter((template) => template.dataStreamEnabled).length,
    [visibleIndexTemplates],
  );
  const highPriorityCount = useMemo(
    () =>
      visibleIndexTemplates.filter((template) => template.priority >= HIGH_PRIORITY_THRESHOLD)
        .length,
    [visibleIndexTemplates],
  );

  const filteredIndexTemplates = useMemo(
    () =>
      filterAndSortIndexTemplates({
        templates: visibleIndexTemplates,
        search: deferredSearch,
        dataStreamOnly,
        priorityMin,
        priorityMax,
        sortField: indexTplSortField,
        sortDirection: indexTplSortDir,
      }),
    [
      visibleIndexTemplates,
      deferredSearch,
      dataStreamOnly,
      priorityMin,
      priorityMax,
      indexTplSortField,
      indexTplSortDir,
    ],
  );

  const filteredComponentTemplates = useMemo(
    () =>
      filterAndSortComponentTemplates({
        templates: visibleComponentTemplates,
        search: deferredSearch,
        sortField: compTplSortField,
        sortDirection: compTplSortDir,
      }),
    [visibleComponentTemplates, deferredSearch, compTplSortField, compTplSortDir],
  );

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
        title={activeTab === "index" ? "Index Templates" : "Component Templates"}
        titleAdornment={<DocLink section="templates" tooltip="Templates docs" />}
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

      <IndexTemplatesOverviewCards
        visibleIndexTemplatesCount={visibleIndexTemplates.length}
        visibleComponentTemplatesCount={visibleComponentTemplates.length}
        dataStreamEnabledCount={dsCount}
        highPriorityCount={highPriorityCount}
      />

      <IndexTemplatesToolbar
        activeTab={activeTab}
        search={search}
        showSystem={showSystem}
        priorityMin={priorityMin}
        priorityMax={priorityMax}
        dataStreamOnly={dataStreamOnly}
        onSetTab={(value) => void setUrlState({ tab: value })}
        onSetSearch={(value) => void setUrlState({ q: value })}
        onToggleShowSystem={() => void setUrlState({ showSystem: !showSystem })}
        onSetPriorityMin={(value) => void setUrlState({ priorityMin: value })}
        onSetPriorityMax={(value) => void setUrlState({ priorityMax: value })}
        onToggleDataStreamOnly={() => void setUrlState({ dataStreamOnly: !dataStreamOnly })}
      />

      <Box sx={{ opacity: isFilterPending ? 0.6 : 1, transition: "opacity 0.2s" }}>
        {activeTab === "index" && (
          <IndexTemplatesTable
            loading={loading}
            indexTemplatesCount={indexTemplates.length}
            filteredTemplates={filteredIndexTemplates}
            sortField={indexTplSortField}
            sortDirection={indexTplSortDir}
            selectedTemplateName={
              selectedTemplateRef?.kind === "index" ? selectedTemplateRef.name : null
            }
            search={search}
            dataStreamOnly={dataStreamOnly}
            priorityMin={priorityMin}
            priorityMax={priorityMax}
            showSystem={showSystem}
            onSort={handleIndexTplSort}
            onSelectTemplate={(name) => setSelectedTemplateRef({ kind: "index", name })}
          />
        )}

        {activeTab === "component" && (
          <ComponentTemplatesTable
            loading={loading}
            componentTemplatesCount={componentTemplates.length}
            filteredTemplates={filteredComponentTemplates}
            sortField={compTplSortField}
            sortDirection={compTplSortDir}
            search={search}
            showSystem={showSystem}
            onSort={handleCompTplSort}
            onSelectTemplate={(name) => setSelectedTemplateRef({ kind: "component", name })}
          />
        )}
      </Box>

      <TemplateDetailsDrawer
        selectedTemplate={selectedTemplate}
        selectedComponentTemplate={selectedComponentTemplate}
        simulatedTemplate={simulatedTemplate}
        onClose={() => setSelectedTemplateRef(null)}
      />
    </PageContainer>
  );
}
