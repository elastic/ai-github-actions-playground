import { useCallback, type Dispatch, type SetStateAction } from "react";

import { escapeEsqlString } from "../../services/es/esqlUtils";

import { appendPipeClause } from "./logsQueryBuilder";
import {
  type ExtractMethod,
  type LogsViewMode,
  MESSAGE_FIELD,
  extractFieldNames,
} from "./logsUtils";

type RunQuery = (query: string) => Promise<void>;

type UseLogsQueryExperiencesArgs = {
  effectiveQuery: string;
  runQuery: RunQuery;
  setRawQuery: (query: string | null) => void;
  setViewMode: (mode: LogsViewMode) => void;
  setSearchText: (text: string) => void;
  histogramIntervalMinutes: number;
  extractMethod: ExtractMethod;
  extractPattern: string;
  result: { columns: Array<{ name: string }>; values: unknown[][] } | null;
  setExtractedSidebarFields: Dispatch<SetStateAction<string[]>>;
  setExtractDialogOpen: (open: boolean) => void;
  setExtractSource: (source: string) => void;
  setExtractMethod: (method: ExtractMethod) => void;
  setExtractPattern: (pattern: string) => void;
};

export function useLogsQueryExperiences({
  effectiveQuery,
  runQuery,
  setRawQuery,
  setViewMode,
  setSearchText,
  histogramIntervalMinutes,
  extractMethod,
  extractPattern,
  result,
  setExtractedSidebarFields,
  setExtractDialogOpen,
  setExtractSource,
  setExtractMethod,
  setExtractPattern,
}: UseLogsQueryExperiencesArgs) {
  const handleAnomalyDrillIn = useCallback(
    (start: number, end: number) => {
      if (!Number.isFinite(start) || !Number.isFinite(end)) return;
      const clause = [
        `STATS log_count = COUNT(*) BY bucket = BUCKET(@timestamp, ${histogramIntervalMinutes} minutes)`,
        "EVAL anomaly = CHANGE_POINT(log_count)",
        `WHERE anomaly IS NOT NULL AND bucket >= TO_DATETIME("${new Date(start).toISOString()}") AND bucket < TO_DATETIME("${new Date(end).toISOString()}")`,
      ].join(" | ");
      const nextQuery = appendPipeClause(effectiveQuery, clause);
      setRawQuery(nextQuery);
      void runQuery(nextQuery);
      setViewMode("chart");
    },
    [effectiveQuery, histogramIntervalMinutes, runQuery, setRawQuery, setViewMode],
  );

  const handleApplyExtraction = useCallback(() => {
    const trimmedPattern = extractPattern.trim();
    if (!trimmedPattern) return;
    const clause = `${extractMethod} ${MESSAGE_FIELD} "${escapeEsqlString(trimmedPattern)}"`;
    const nextQuery = appendPipeClause(effectiveQuery, clause);
    const extractedFields = extractFieldNames(extractMethod, trimmedPattern);
    if (extractedFields.length > 0) {
      setExtractedSidebarFields((prev) => Array.from(new Set([...prev, ...extractedFields])));
    }
    setRawQuery(nextQuery);
    void runQuery(nextQuery);
    setExtractDialogOpen(false);
  }, [
    effectiveQuery,
    extractMethod,
    extractPattern,
    runQuery,
    setExtractDialogOpen,
    setExtractedSidebarFields,
    setRawQuery,
  ]);

  const handleOpenExtractBuilder = useCallback(() => {
    const messageColumnIndex =
      result?.columns.findIndex((column) => column.name === MESSAGE_FIELD) ?? -1;
    const sampleMessage =
      messageColumnIndex >= 0 && result?.values.length
        ? String(result.values[0]?.[messageColumnIndex] ?? "")
        : "";
    setExtractSource(sampleMessage);
    setExtractMethod("DISSECT");
    setExtractPattern("%{extracted.value}");
    setExtractDialogOpen(true);
  }, [result, setExtractDialogOpen, setExtractMethod, setExtractPattern, setExtractSource]);

  const runCategorizeQuery = useCallback(() => {
    const nextQuery = appendPipeClause(
      effectiveQuery,
      `STATS pattern_count = COUNT(*) BY pattern = CATEGORIZE(${MESSAGE_FIELD}) | SORT pattern_count DESC`,
    );
    setRawQuery(nextQuery);
    void runQuery(nextQuery);
    setViewMode("patterns");
  }, [effectiveQuery, runQuery, setRawQuery, setViewMode]);

  const runChangePointExperience = useCallback(() => {
    const nextQuery = appendPipeClause(
      effectiveQuery,
      `STATS log_count = COUNT(*) BY bucket = BUCKET(@timestamp, ${histogramIntervalMinutes} minutes) | EVAL anomaly = CHANGE_POINT(log_count) | WHERE anomaly IS NOT NULL | SORT bucket DESC`,
    );
    setRawQuery(nextQuery);
    void runQuery(nextQuery);
    setViewMode("chart");
  }, [effectiveQuery, histogramIntervalMinutes, runQuery, setRawQuery, setViewMode]);

  const runErrorTriageExperience = useCallback(() => {
    setRawQuery(null);
    setSearchText('"error" OR "exception" OR "timeout" OR "failed"');
    setViewMode("lines");
  }, [setRawQuery, setSearchText, setViewMode]);

  const runGuidedGenericMatch = useCallback(
    (text: string) => {
      setRawQuery(null);
      setSearchText(text.trim());
      setViewMode("lines");
    },
    [setRawQuery, setSearchText, setViewMode],
  );

  const runServicePivotExperience = useCallback(
    (opts: { serviceName?: string; topN: number }) => {
      const topN = Number.isInteger(opts.topN) && opts.topN > 0 ? opts.topN : 20;
      const serviceFilter = opts.serviceName
        ? `WHERE service.name == "${escapeEsqlString(opts.serviceName)}"`
        : "WHERE service.name IS NOT NULL";
      const nextQuery = appendPipeClause(
        effectiveQuery,
        `${serviceFilter} | STATS log_count = COUNT(*) BY service.name | SORT log_count DESC | LIMIT ${topN}`,
      );
      setRawQuery(nextQuery);
      void runQuery(nextQuery);
      setViewMode("lines");
    },
    [effectiveQuery, runQuery, setRawQuery, setViewMode],
  );

  const runTraceCorrelationExperience = useCallback(() => {
    const nextQuery = appendPipeClause(
      effectiveQuery,
      "WHERE trace.id IS NOT NULL | KEEP @timestamp, service.name, trace.id, message | SORT @timestamp DESC | LIMIT 200",
    );
    setRawQuery(nextQuery);
    void runQuery(nextQuery);
    setViewMode("lines");
  }, [effectiveQuery, runQuery, setRawQuery, setViewMode]);

  return {
    handleAnomalyDrillIn,
    handleApplyExtraction,
    handleOpenExtractBuilder,
    runCategorizeQuery,
    runChangePointExperience,
    runErrorTriageExperience,
    runGuidedGenericMatch,
    runServicePivotExperience,
    runTraceCorrelationExperience,
  };
}
