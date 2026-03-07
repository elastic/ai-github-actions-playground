import type { HealthCheckDefinition } from "../types";

import { clusterChecks } from "./cluster";
import { ilmChecks } from "./ilm";
import { indicesChecks } from "./indices";
import { ingestChecks } from "./ingest";
import { nodesChecks } from "./nodes";
import { recoveryChecks } from "./recovery";
import { securityChecks } from "./security";
import { shardChecks } from "./shards";
import { tasksChecks } from "./tasks";

export const INITIAL_HEALTH_CHECKS: HealthCheckDefinition[] = [
  ...clusterChecks,
  ...shardChecks,
  ...nodesChecks,
  ...tasksChecks,
  ...ilmChecks,
  ...indicesChecks,
  ...ingestChecks,
  ...recoveryChecks,
  ...securityChecks,
];
