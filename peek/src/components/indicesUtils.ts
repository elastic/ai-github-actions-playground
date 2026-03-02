// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IndexTab = "overview" | "mappings" | "settings" | "stats" | "disk_usage";

export interface MappingField {
  name: string;
  type: string;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function parseIntOrNull(value: string | null | undefined): number | null {
  if (value == null) return null;
  const n = parseInt(value, 10);
  return isNaN(n) ? null : n;
}

export function flattenMappingProperties(
  properties: Record<string, unknown>,
  prefix = "",
): MappingField[] {
  const rows: MappingField[] = [];
  for (const [key, value] of Object.entries(properties)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    const def = value as Record<string, unknown>;
    rows.push({ name: fieldPath, type: (def.type as string) || "object" });
    if (def.properties && typeof def.properties === "object") {
      rows.push(...flattenMappingProperties(def.properties as Record<string, unknown>, fieldPath));
    }
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export function extractMappingFields(
  mappingResponse: Record<string, unknown>,
  indexName: string,
): MappingField[] {
  const indexData = (mappingResponse[indexName] ?? Object.values(mappingResponse)[0]) as
    | Record<string, unknown>
    | undefined;
  if (!indexData) return [];
  const mappings = indexData.mappings as Record<string, unknown> | undefined;
  if (!mappings) return [];
  const properties = mappings.properties as Record<string, unknown> | undefined;
  if (!properties) return [];
  return flattenMappingProperties(properties);
}

export function flattenObject(
  obj: Record<string, unknown>,
  prefix = "",
): Array<{ key: string; value: string }> {
  const result: Array<{ key: string; value: string }> = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      result.push(...flattenObject(v as Record<string, unknown>, fullKey));
    } else {
      result.push({ key: fullKey, value: Array.isArray(v) ? v.join(", ") : String(v ?? "") });
    }
  }
  return result.sort((a, b) => a.key.localeCompare(b.key));
}

export function extractSettings(
  settingsResponse: Record<string, unknown>,
  indexName: string,
): Array<{ key: string; value: string }> {
  const indexData = (settingsResponse[indexName] ?? Object.values(settingsResponse)[0]) as
    | Record<string, unknown>
    | undefined;
  if (!indexData) return [];
  const settings = indexData.settings as Record<string, unknown> | undefined;
  if (!settings) return [];
  return flattenObject(settings);
}

export function healthColor(health: string): "success" | "warning" | "error" | "default" {
  if (health === "green") return "success";
  if (health === "yellow") return "warning";
  if (health === "red") return "error";
  return "default";
}
