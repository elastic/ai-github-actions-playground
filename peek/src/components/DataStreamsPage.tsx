import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { INSIGHT_GUARDRAIL } from "../hooks/insightPromptUtils";

import AskAiButton from "./AskAiButton";
import DataStreamDetailPanel from "./DataStreamDetailPanel";
import DataStreamTable from "./DataStreamTable";
import { OVERVIEW_CARD_DEFS, getCardValue } from "./dataStreamsUtils";
import FieldStatsPanel from "./FieldStatsPanel";
import InsightSlot from "./InsightSlot";
import { InsightSlotProvider } from "./InsightSlotContext";
import { OverviewInfoCard } from "./OverviewInfoCard";
import PageHeader from "./PageHeader";
import PageInsightBanner from "./PageInsightBanner";
import { useDataStreamsPageState } from "./useDataStreamsPageState";

export default function DataStreamsPage() {
  const {
    connection,
    loadingStreams,
    dataStreams,
    error,
    refreshStreams,
    displayedName,
    displayedDataStream,
    search,
    setSearch,
    showSystemStreams,
    setShowSystemStreams,
    streamSortField,
    streamSortDirection,
    handleStreamSort,
    filteredStreams,
    streamMetrics,
    fieldSearch,
    setFieldSearch,
    fieldRows,
    loadingFields,
    selectedName,
    setSelectedName,
    selectedField,
    setSelectedField,
    handleOpenInDiscover,
    handleInspectInConsole,
    handleFieldStatsQuery,
    slotInsights,
  } = useDataStreamsPageState();

  return (
    <InsightSlotProvider
      summary={slotInsights.summary}
      insights={slotInsights.insights}
      loading={slotInsights.loading}
      error={slotInsights.error}
      refresh={slotInsights.refresh}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, height: "100%", minHeight: 0 }}>
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <PageHeader
            title="Data Streams"
            actions={
              <>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={refreshStreams}
                  disabled={loadingStreams}
                  startIcon={
                    loadingStreams ? <CircularProgress size={14} aria-hidden="true" /> : undefined
                  }
                  aria-label={loadingStreams ? "Refreshing data streams" : "Refresh data streams"}
                >
                  {loadingStreams ? "Refreshing..." : "Refresh"}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  disabled={!displayedName}
                  onClick={handleOpenInDiscover}
                >
                  Open in Query Lab
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={!displayedName}
                  onClick={handleInspectInConsole}
                >
                  Inspect in Console
                </Button>
                {displayedName && (
                  <AskAiButton
                    label="Summarize schema"
                    prompt={`Summarize the schema of data stream "${displayedName}" and suggest one ES|QL query to explore it.`}
                  />
                )}
              </>
            }
          />
        </Paper>

        {!loadingStreams && dataStreams.length > 0 && (
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            {OVERVIEW_CARD_DEFS.map((card) => {
              const { value, color } = getCardValue(card.key, streamMetrics);
              return (
                <Box key={card.slotId} sx={{ flex: 1, minWidth: 100 }}>
                  <InsightSlot slotId={card.slotId}>
                    <OverviewInfoCard title={card.title}>
                      <Typography
                        variant="h5"
                        component="p"
                        sx={{ color, fontVariantNumeric: "tabular-nums" }}
                      >
                        {value}
                      </Typography>
                    </OverviewInfoCard>
                  </InsightSlot>
                </Box>
              );
            })}
          </Stack>
        )}

        {error && <Alert severity="error">{error}</Alert>}
        {slotInsights.error && (
          <Alert severity="warning">AI insights unavailable: {slotInsights.error}</Alert>
        )}
        {displayedDataStream && (
          <PageInsightBanner
            context={JSON.stringify({
              name: displayedDataStream.name,
              status: displayedDataStream.status,
              generation: displayedDataStream.generation,
              backingIndexCount: displayedDataStream.indices.length,
              ilmPolicy: displayedDataStream.ilm_policy ?? null,
            })}
            systemPrompt={`You are an Elasticsearch data stream analyst. Give one concise operational insight and one action for this selected stream.${INSIGHT_GUARDRAIL}`}
            cacheKey={`data-stream::${displayedDataStream.name}::${displayedDataStream.status}::${displayedDataStream.generation}::${displayedDataStream.indices.length}::${displayedDataStream.ilm_policy ?? ""}`}
          />
        )}

        <Box sx={{ display: "flex", flex: 1, gap: 1, minHeight: 0 }}>
          <DataStreamTable
            search={search}
            setSearch={setSearch}
            showSystemStreams={showSystemStreams}
            setShowSystemStreams={setShowSystemStreams}
            filteredStreams={filteredStreams}
            loadingStreams={loadingStreams}
            streamSortField={streamSortField}
            streamSortDirection={streamSortDirection}
            handleStreamSort={handleStreamSort}
            selectedName={selectedName}
            setSelectedName={setSelectedName}
          />

          <DataStreamDetailPanel
            displayedDataStream={displayedDataStream}
            fieldSearch={fieldSearch}
            setFieldSearch={setFieldSearch}
            fieldRows={fieldRows}
            loadingFields={loadingFields}
            selectedField={selectedField}
            setSelectedField={setSelectedField}
          />

          {selectedField && connection && displayedName && (
            <FieldStatsPanel
              connection={connection}
              streamName={displayedName}
              fieldName={selectedField.name}
              fieldType={selectedField.type}
              onClose={() => setSelectedField(null)}
              onOpenInQueryLab={handleFieldStatsQuery}
            />
          )}
        </Box>
      </Box>
    </InsightSlotProvider>
  );
}
