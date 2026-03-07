import type { HealthCheckDefinition } from "../types";

import { clusterChecks } from "./cluster";
import { ilmChecks } from "./ilm";
import { nodeChecks } from "./nodes";
import { shardChecks } from "./shards";
import { taskChecks } from "./tasks";

export const INITIAL_HEALTH_CHECKS: HealthCheckDefinition[] = [
  ...clusterChecks,
  ...shardChecks,
  ...nodeChecks,
  ...taskChecks,
  ...ilmChecks,
];
