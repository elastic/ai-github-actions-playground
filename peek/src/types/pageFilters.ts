export interface ServiceInventoryFilters {
  timeFrom: string;
  timeTo: string;
}

export const DEFAULT_SERVICE_INVENTORY_FILTERS: ServiceInventoryFilters = {
  timeFrom: "NOW() - 1 hour",
  timeTo: "NOW()",
};

export interface ProfilingFilters {
  executableName: string | null;
  threadName: string | null;
  serviceName: string | null;
  hostName: string | null;
  timeFrom: string;
  timeTo: string;
  limit: number;
}

export const EMPTY_PROFILING_FILTERS: ProfilingFilters = {
  executableName: null,
  threadName: null,
  serviceName: null,
  hostName: null,
  timeFrom: "NOW() - 1 hour",
  timeTo: "NOW()",
  limit: 100,
};
