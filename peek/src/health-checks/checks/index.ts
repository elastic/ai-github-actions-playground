import type { HealthCheckDefinition } from "../types";

import { clusterChecks } from "./cluster";
import { ilmChecks } from "./ilm";
import { nodesChecks } from "./nodes";
import { tasksChecks } from "./tasks";

export const INITIAL_HEALTH_CHECKS: HealthCheckDefinition[] = [
  ...clusterChecks,
  ...nodesChecks,
  ...tasksChecks,
  ...ilmChecks,
];
