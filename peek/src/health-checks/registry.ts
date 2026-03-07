import type { HealthCheckDefinition, HealthSurface } from "./types";

export class HealthRegistry {
  private readonly checks = new Map<string, HealthCheckDefinition>();

  registerHealthChecks(definitions: HealthCheckDefinition[]) {
    for (const definition of definitions) {
      if (this.checks.has(definition.id)) {
        throw new Error(`Duplicate health check id: ${definition.id}`);
      }
      this.checks.set(definition.id, definition);
    }
  }

  getAll(): HealthCheckDefinition[] {
    return Array.from(this.checks.values());
  }

  getBySurface(surface: HealthSurface): HealthCheckDefinition[] {
    return this.getAll().filter((check) => check.surfaces.includes(surface));
  }

  getByIds(ids: string[]): HealthCheckDefinition[] {
    const requested = new Set(ids);
    return this.getAll().filter((check) => requested.has(check.id));
  }
}
