/**
 * Resource attribute rules from the instrumentation-score spec.
 *
 * These checks evaluate whether OpenTelemetry resource attributes
 * are present and correct, based on:
 * - RES-005: service.name is present (Critical)
 * - RES-001: service.instance.id is present (Normal)
 * - RES-002: service.instance.id is unique per logical resource (Important)
 * - RES-003: k8s.pod.uid is present for Kubernetes workloads (Important)
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
  {
    id: "RES-002",
    description: "service.instance.id is unique across logical resources",
    rationale:
      "service.instance.id provides little value if reused across multiple pods/hosts/containers. " +
      "Unique instance IDs preserve resource identity and improve correlation.",
    target: "resource",
    impact: "important",
    specUrl: `${SPEC_BASE_URL}/RES-002.md`,
    evaluate: (snapshot) => {
      if (!snapshot.hasServiceInstanceId) {
        return {
          passed: false,
          summary:
            "Cannot verify uniqueness because service.instance.id is missing. " +
            "Add service.instance.id first (RES-001).",
        };
      }
      if (snapshot.duplicateInstanceIdCount === 0) {
        return {
          passed: true,
          summary: "No service.instance.id values were reused across multiple logical resources.",
        };
      }
      return {
        passed: false,
        summary:
          `${snapshot.duplicateInstanceIdCount} service.instance.id value(s) were reused across multiple logical resources. ` +
          "Ensure each service instance reports a unique service.instance.id.",
        observed: { duplicateInstanceIdCount: snapshot.duplicateInstanceIdCount },
      };
    },
  },
  {
    id: "RES-003",
    description: "k8s.pod.uid is present for telemetry from Kubernetes workloads",
    rationale:
      "k8s.pod.uid enables robust correlation for Kubernetes resources and avoids " +
      "fragile pod identity based on mutable attributes like pod IP.",
    target: "resource",
    impact: "important",
    specUrl: `${SPEC_BASE_URL}/RES-003.md`,
    evaluate: (snapshot) => {
      if (!snapshot.hasK8sContext) {
        return {
          passed: true,
          summary: "No Kubernetes resource attributes were observed for this service.",
          observed: { hasK8sContext: false },
        };
      }
      if (snapshot.hasK8sPodUid) {
        return {
          passed: true,
          summary: "Kubernetes telemetry contains k8s.pod.uid.",
        };
      }
      return {
        passed: false,
        summary:
          "Kubernetes resource attributes were detected, but k8s.pod.uid is missing. " +
          "Configure resource detection or collector enrichment to include k8s.pod.uid.",
        observed: { hasK8sContext: true, hasK8sPodUid: false },
      };
    },
  },
];
