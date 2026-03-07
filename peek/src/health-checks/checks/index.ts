import type { HealthCheckDefinition } from "../types";

import { clusterChecks } from "./cluster";
import { healthReportChecks } from "./healthReport";
import { ilmChecks } from "./ilm";
import { indicesChecks } from "./indices";
import { ingestChecks } from "./ingest";
import { nodeChecks } from "./nodes";
import { recoveryChecks } from "./recovery";
import { securityChecks } from "./security";
import { shardChecks } from "./shards";
import { taskChecks } from "./tasks";

export const INITIAL_HEALTH_CHECKS: HealthCheckDefinition[] = [
  ...clusterChecks,
  ...healthReportChecks,
  ...shardChecks,
  ...nodeChecks,
  ...taskChecks,
  ...ilmChecks,
  ...indicesChecks,
  ...ingestChecks,
  ...recoveryChecks,
  ...securityChecks,
];
