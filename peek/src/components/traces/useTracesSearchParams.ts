import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import type { TracesViewMode } from "../../store/useTracesStore";

const VALID_VIEW_MODES: ReadonlySet<TracesViewMode> = new Set([
  "list",
  "timeseries",
  "scatter",
  "serviceMap",
  "driftRadar",
]);

interface TracesSearchDefaults {
  services: string[];
  timeFrom: string | null;
  timeTo: string | null;
  viewMode: TracesViewMode;
  traceId: string | null;
  rawQuery: string | null;
}

interface SetOptions {
  replace?: boolean;
}

function parseServices(searchParams: URLSearchParams): string[] {
  const values = searchParams
    .getAll("service")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return Array.from(new Set(values));
}

function parseViewMode(rawValue: string | null): TracesViewMode | null {
  if (!rawValue) return null;
  if (rawValue === "waterfall") return "serviceMap";
  return VALID_VIEW_MODES.has(rawValue as TracesViewMode) ? (rawValue as TracesViewMode) : null;
}

export function useTracesSearchParams(defaults: TracesSearchDefaults) {
  const [searchParams, setSearchParams] = useSearchParams();

  const updateSearchParams = useCallback(
    (mutate: (params: URLSearchParams) => void, options?: SetOptions) => {
      setSearchParams(
        (currentParams) => {
          const nextParams = new URLSearchParams(currentParams);
          mutate(nextParams);
          return nextParams;
        },
        { replace: options?.replace ?? true },
      );
    },
    [setSearchParams],
  );

  const services = useMemo(() => {
    if (!searchParams.has("service")) return defaults.services;
    return parseServices(searchParams);
  }, [defaults.services, searchParams]);
  const timeFrom = searchParams.has("from") ? searchParams.get("from") : defaults.timeFrom;
  const timeTo = searchParams.has("to") ? searchParams.get("to") : defaults.timeTo;
  const viewMode = parseViewMode(searchParams.get("view")) ?? defaults.viewMode;
  const traceId = searchParams.has("traceId") ? searchParams.get("traceId") : defaults.traceId;
  const rawQuery = searchParams.has("rawQuery") ? searchParams.get("rawQuery") : defaults.rawQuery;

  const setServices = useCallback(
    (nextServices: string[], options?: SetOptions) => {
      const normalized = Array.from(
        new Set(
          nextServices.map((service) => service.trim()).filter((service) => service.length > 0),
        ),
      );
      updateSearchParams((params) => {
        if (normalized.length > 0) {
          params.set("service", normalized.join(","));
        } else {
          params.delete("service");
        }
      }, options);
    },
    [updateSearchParams],
  );

  const setTimeRange = useCallback(
    (from: string | null, to: string | null, options?: SetOptions) => {
      updateSearchParams((params) => {
        if (from) {
          params.set("from", from);
        } else {
          params.delete("from");
        }
        if (to) {
          params.set("to", to);
        } else {
          params.delete("to");
        }
      }, options);
    },
    [updateSearchParams],
  );

  const setViewMode = useCallback(
    (mode: TracesViewMode, options?: SetOptions) => {
      updateSearchParams((params) => {
        if (mode === "list") {
          params.delete("view");
        } else {
          params.set("view", mode);
        }
      }, options);
    },
    [updateSearchParams],
  );

  const setTraceId = useCallback(
    (nextTraceId: string | null, options?: SetOptions) => {
      updateSearchParams((params) => {
        if (nextTraceId) {
          params.set("traceId", nextTraceId);
        } else {
          params.delete("traceId");
        }
      }, options);
    },
    [updateSearchParams],
  );

  const setRawQuery = useCallback(
    (nextRawQuery: string | null, options?: SetOptions) => {
      updateSearchParams((params) => {
        if (nextRawQuery !== null) {
          params.set("rawQuery", nextRawQuery);
        } else {
          params.delete("rawQuery");
        }
      }, options);
    },
    [updateSearchParams],
  );

  return {
    services,
    timeFrom,
    timeTo,
    viewMode,
    traceId,
    rawQuery,
    setServices,
    setTimeRange,
    setViewMode,
    setTraceId,
    setRawQuery,
  };
}
