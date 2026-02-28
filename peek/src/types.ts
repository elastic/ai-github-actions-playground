// Barrel – re-exports from domain-specific type modules.
// New feature work should import directly from the relevant sub-module:
//   types/connection.ts   – connection profiles and health
//   types/visualization.ts – visualization options and types
//   types/dashboard.ts    – dashboard/panel definitions, parameters, query results

export * from "./types/connection";
export * from "./types/visualization";
export * from "./types/dashboard";
