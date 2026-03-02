// ---------------------------------------------------------------------------
// Ingest pipeline types
// ---------------------------------------------------------------------------

export interface IngestPipeline {
  description?: string;
  version?: number;
  processors?: Array<Record<string, unknown>>;
  on_failure?: Array<Record<string, unknown>>;
}

export type GetIngestPipelinesResponse = Record<string, IngestPipeline>;

export interface SimulateIngestPipelineResponse {
  docs?: Array<{
    doc?: {
      _source?: Record<string, unknown>;
      _ingest?: { timestamp?: string };
      error?: { type?: string; reason?: string };
    };
    processor_results?: Array<{
      processor_type?: string;
      status?: string;
      doc?: { _source?: Record<string, unknown> };
    }>;
  }>;
}
