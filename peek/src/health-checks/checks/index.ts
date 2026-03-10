import type { HealthCheckDefinition } from "../types";

/**
 * Auto-discover all check modules in this directory.
 * New check files are picked up automatically — no manual imports needed.
 * Each module must export one or more `HealthCheckDefinition[]` arrays.
 */
const checkModules = import.meta.glob(["./*.ts", "!./index.ts"], {
  eager: true,
});

function isHealthCheckArray(value: unknown): value is HealthCheckDefinition[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every((item) => {
    const check = item as Record<string, unknown>;
    return typeof check.id === "string" && typeof check.evaluate === "function";
  });
}

/** All registered health-check definitions, sorted by `id` for deterministic ordering. */
export const INITIAL_HEALTH_CHECKS: HealthCheckDefinition[] = Object.values(checkModules)
  .flatMap((mod) => Object.values(mod as Record<string, unknown>).filter(isHealthCheckArray))
  .flat()
  .sort((a, b) => a.id.localeCompare(b.id));
