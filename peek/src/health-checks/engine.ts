import type {
  EvaluatedHealthCheck,
  HealthCheckDefinition,
  HealthSeverity,
  HealthSnapshot,
} from "./types";

const SEVERITY_RANK: Record<HealthSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function evaluateHealthChecks(
  checks: HealthCheckDefinition[],
  snapshot: HealthSnapshot,
): EvaluatedHealthCheck[] {
  const evaluated = checks.map((check) => {
    const dependencyErrors = check.dependsOn
      .map((group) => snapshot.errors[group])
      .filter((error): error is string => Boolean(error));

    if (dependencyErrors.length > 0) {
      return {
        id: check.id,
        domain: check.domain,
        title: check.title,
        description: check.description,
        status: "unknown" as const,
        severity: null,
        summary: "Required health data is unavailable.",
        reason: dependencyErrors.join("; "),
      };
    }

    try {
      const result = check.evaluate(snapshot);
      return {
        id: check.id,
        domain: check.domain,
        title: check.title,
        description: check.description,
        severity:
          result.status === "fail" || result.status === "warn" ? check.severityOnFail : null,
        ...result,
      };
    } catch (error) {
      return {
        id: check.id,
        domain: check.domain,
        title: check.title,
        description: check.description,
        status: "unknown" as const,
        severity: null,
        summary: "Health check execution failed.",
        reason: error instanceof Error ? error.message : "Unknown check failure",
      };
    }
  });

  return evaluated.sort((a, b) => {
    // Non-passing checks first, passing last
    const aFailing = a.status === "fail" || a.status === "warn" || a.status === "unknown" ? 0 : 1;
    const bFailing = b.status === "fail" || b.status === "warn" || b.status === "unknown" ? 0 : 1;
    if (aFailing !== bFailing) return aFailing - bFailing;

    // Sort by severity (critical first)
    const aRank = a.severity ? SEVERITY_RANK[a.severity] : Number.MAX_SAFE_INTEGER;
    const bRank = b.severity ? SEVERITY_RANK[b.severity] : Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;

    // Then by domain, then title
    if (a.domain !== b.domain) return a.domain.localeCompare(b.domain);
    return a.title.localeCompare(b.title);
  });
}
