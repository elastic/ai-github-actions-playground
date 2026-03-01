// ---------------------------------------------------------------------------
// Ingest pipeline types
// ---------------------------------------------------------------------------

export interface IngestPipeline {
  description?: string;
  version?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  processors?: Array<Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on_failure?: Array<Record<string, any>>;
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
