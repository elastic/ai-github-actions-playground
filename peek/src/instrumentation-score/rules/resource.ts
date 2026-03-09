/**
 * Resource attribute rules from the instrumentation-score spec.
 *
 * These checks evaluate whether OpenTelemetry resource attributes
 * are present and correct, based on:
 * - RES-005: service.name is present (Critical)
 * - RES-001: service.instance.id is present (Normal)
 */
import type { InstrumentationScoreRule } from "../types";

const SPEC_BASE_URL = "https://github.com/instrumentation-score/spec/blob/main/rules";

export const resourceRules: InstrumentationScoreRule[] = [
  {
    id: "RES-005",
    description: "service.name is present",
    rationale:
      "service.name is the logical name of the service and is critical for service identification. " +
      "It is required by OpenTelemetry Semantic Conventions for Resources.",
    target: "resource",
    impact: "critical",
    specUrl: `${SPEC_BASE_URL}/RES-005.md`,
    evaluate: (snapshot) => {
      if (snapshot.hasServiceName) {
        return {
          passed: true,
          summary: "Resource attributes contain a non-empty service.name.",
        };
      }
      return {
        passed: false,
        summary:
          "Resource attributes are missing service.name or it has an empty value. " +
          "Add service.name to your OTel SDK resource configuration.",
        observed: { hasServiceName: false },
      };
    },
  },
  {
    id: "RES-001",
    description: "service.instance.id is present",
    rationale:
      "service.instance.id uniquely identifies a resource and can be used as the process " +
      "identifier without taking other resource attributes into account.",
    target: "resource",
    impact: "normal",
    specUrl: `${SPEC_BASE_URL}/RES-001.md`,
    evaluate: (snapshot) => {
      if (snapshot.hasServiceInstanceId) {
        return {
          passed: true,
          summary: "Resource attributes contain service.instance.id.",
        };
      }
      return {
        passed: false,
        summary:
          "Resource attributes are missing service.instance.id. " +
          "Configure the OTel SDK to include a unique instance identifier.",
        observed: { hasServiceInstanceId: false },
      };
    },
  },
];
