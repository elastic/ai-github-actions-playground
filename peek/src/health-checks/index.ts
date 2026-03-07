import { evaluateHealthChecks } from "./engine";
import { HealthRegistry } from "./registry";

export type {
  EvaluatedHealthCheck,
  HealthCheckDefinition,
  HealthCheckResult,
  HealthQueryGroup,
  HealthSeverity,
  HealthSnapshot,
  HealthStatus,
  HealthSurface,
} from "./types";
export { buildHealthSnapshot, HEALTH_SNAPSHOT_TTL_MS } from "./snapshot";
export { evaluateHealthChecks };

export const healthRegistry = new HealthRegistry();
