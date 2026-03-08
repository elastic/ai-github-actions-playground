import { useState, useEffect, useCallback, useRef } from "react";
import { useShallow } from "zustand/react/shallow";

import { useConnectionStore } from "../store/useConnectionStore";
import { useDashboardEditorStore } from "../store/useDashboardEditorStore";
import { isElasticsearchError } from "../services/es";
import {
  buildPersesEsqlRequest,
  createPersesEsqlDatasource,
} from "../services/perses/esqlDatasource";
import type { PanelDefinition, EsqlResponse } from "../types";
import { toCsv } from "../components/discoverUtils";

export function usePanelData(
  panel: PanelDefinition,
  supportsQuery: boolean,
  supportsImageExport: boolean,
) {
  const connection = useConnectionStore((s) => s.connection);
  const { timeRange, timeZone, parameters } = useDashboardEditorStore(
    useShallow((s) => ({
      timeRange: s.dashboard.timeRange,
      timeZone: s.dashboard.timeZone,
      parameters: s.dashboard.parameters,
    })),
  );

  const [data, setData] = useState<EsqlResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const [exportImage, setExportImage] = useState<(() => string) | null>(null);
  const [, setTick] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const supportsCSVExport = panel.visualization === "table";

  useEffect(() => {
    if (!supportsImageExport) {
      setExportImage(null);
    }
  }, [supportsImageExport]);

  const handleExportImage = useCallback(() => {
    if (!exportImage) return;
    const dataUrl = exportImage();
    if (!dataUrl) return;
    const safeTitle =
      panel.title
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || "panel";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${safeTitle}-${timestamp}.png`;
    a.click();
  }, [exportImage, panel.title]);

  const handleExportReady = useCallback((exportFn: (() => string) | null) => {
    setExportImage(() => exportFn);
  }, []);

  const handleExportCsv = useCallback(() => {
    if (!data || data.columns.length === 0) return;
    const csv = toCsv(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const safeTitle =
      panel.title
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || "panel";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeTitle}-${timestamp}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [data, panel.title]);

  const resetResultState = useCallback(() => {
    setData(null);
    setExecutionTimeMs(null);
    setLastRefreshAt(null);
    setExportImage(null);
  }, []);

  const fetchData = useCallback(async () => {
    if (!supportsQuery || !connection || !panel.query.trim()) {
      abortRef.current?.abort();
      setLoading(false);
      resetResultState();
      setError(null);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);

    try {
      const datasource = createPersesEsqlDatasource(connection);
      const body = buildPersesEsqlRequest(panel.query, { timeRange, parameters });
      const result = await datasource.execute(body, ctrl.signal);
      if (!ctrl.signal.aborted) {
        setData(result);
        setExecutionTimeMs(result.executionTimeMs);
        setLastRefreshAt(new Date());
      }
    } catch (err: unknown) {
      if (!ctrl.signal.aborted) {
        resetResultState();
        setError(isElasticsearchError(err) ? err.message : String(err));
      }
    } finally {
      if (!ctrl.signal.aborted) {
        setLoading(false);
      }
    }
  }, [supportsQuery, connection, panel.query, timeRange, parameters, resetResultState]);

  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  // Periodically re-render so the "X ago" label stays current.
  useEffect(() => {
    if (!lastRefreshAt) return;
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(timer);
  }, [lastRefreshAt]);

  return {
    connection,
    timeRange,
    timeZone,
    parameters,
    data,
    loading,
    error,
    executionTimeMs,
    lastRefreshAt,
    exportImage,
    supportsCSVExport,
    fetchData,
    handleExportImage,
    handleExportCsv,
    handleExportReady,
  };
}
