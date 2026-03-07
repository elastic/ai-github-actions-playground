import { INITIAL_HEALTH_CHECKS } from "./checks";
import { healthRegistry } from "./index";

let initialized = false;

export function initializeHealthChecks() {
  if (initialized) return;
  healthRegistry.registerHealthChecks(INITIAL_HEALTH_CHECKS);
  initialized = true;
}
