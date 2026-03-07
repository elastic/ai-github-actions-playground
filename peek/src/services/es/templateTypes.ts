// ---------------------------------------------------------------------------
// Index & Component Template API types
// ---------------------------------------------------------------------------

/** A single index template. */
export interface IndexTemplateRecord {
  name: string;
  index_template: {
    index_patterns?: string[];
    template?: {
      settings?: Record<string, unknown>;
      mappings?: Record<string, unknown>;
      aliases?: Record<string, unknown>;
    };
    composed_of?: string[];
    priority?: number;
    version?: number;
    data_stream?: Record<string, unknown>;
    _meta?: Record<string, unknown>;
    allow_auto_create?: boolean;
  };
}

/** Response from GET /_index_template */
export interface GetIndexTemplatesResponse {
  index_templates?: IndexTemplateRecord[];
}

/** A single component template. */
export interface ComponentTemplateRecord {
  name: string;
  component_template: {
    template?: {
      settings?: Record<string, unknown>;
      mappings?: Record<string, unknown>;
      aliases?: Record<string, unknown>;
    };
    version?: number;
    _meta?: Record<string, unknown>;
  };
}

/** Response from GET /_component_template */
export interface GetComponentTemplatesResponse {
  component_templates?: ComponentTemplateRecord[];
}

/** Flattened index template row. */
export interface IndexTemplateRow {
  name: string;
  indexPatterns: string[];
  priority: number;
  composedOfCount: number;
  composedOf: string[];
  dataStreamEnabled: boolean;
  version: number | string;
  raw?: IndexTemplateRecord;
}

/** Flattened component template row. */
export interface ComponentTemplateRow {
  name: string;
  hasMappings: boolean;
  hasSettings: boolean;
  hasAliases: boolean;
  version: number | string;
  usedByCount: number;
}
