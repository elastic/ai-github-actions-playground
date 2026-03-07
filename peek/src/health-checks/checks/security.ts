import type { HealthCheckDefinition } from "../types";

const API_KEYS_EXPIRING_SOON_DAYS = 7;
const API_KEYS_INVALIDATED_HIGH = 100;

export const securityChecks: HealthCheckDefinition[] = [
  // #114
  {
    id: "security.api_keys.expiring_soon",
    domain: "security",
    title: "API keys expiring soon",
    description: `Warns when API keys expire within ${API_KEYS_EXPIRING_SOON_DAYS} days.`,
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["securityCore"],
    evaluate: (snapshot) => {
      const apiKeys = snapshot.data.securityCore?.apiKeys?.api_keys ?? [];
      const now = Date.now();
      const threshold = now + API_KEYS_EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;
      const expiring = apiKeys.filter((k) => {
        if (k.invalidated) return false;
        const exp = k.expiration;
        return exp != null && exp > now && exp <= threshold;
      });
      if (expiring.length > 0) {
        return {
          status: "warn",
          summary: `${expiring.length} API key${expiring.length === 1 ? "" : "s"} expiring within ${API_KEYS_EXPIRING_SOON_DAYS} days.`,
          observed: { count: expiring.length, keys: expiring.map((k) => k.name).slice(0, 10) },
          recommendation:
            "Rotate expiring API keys before they expire to avoid service disruptions.",
        };
      }
      return { status: "pass", summary: "No API keys expiring soon." };
    },
  },
  // #115
  {
    id: "security.api_keys.invalidated_high",
    domain: "security",
    title: "Invalidated API keys high",
    description: `Warns when > ${API_KEYS_INVALIDATED_HIGH} invalidated API keys exist.`,
    severityOnFail: "low",
    surfaces: ["global"],
    dependsOn: ["securityCore"],
    evaluate: (snapshot) => {
      const apiKeys = snapshot.data.securityCore?.apiKeys?.api_keys ?? [];
      const invalidated = apiKeys.filter((k) => k.invalidated);
      if (invalidated.length > API_KEYS_INVALIDATED_HIGH) {
        return {
          status: "warn",
          summary: `${invalidated.length} invalidated API keys (threshold: ${API_KEYS_INVALIDATED_HIGH}).`,
          observed: { count: invalidated.length },
          recommendation: "Clean up invalidated API keys to reduce security index size.",
        };
      }
      return {
        status: "pass",
        summary: `Invalidated API keys (${invalidated.length}) within threshold.`,
      };
    },
  },
];
