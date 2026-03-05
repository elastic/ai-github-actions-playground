import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import type { SimulateIngestPipelineResponse } from "../../services/es";

interface SimulateResultsProps {
  simulateResult: SimulateIngestPipelineResponse;
}

export default function SimulateResults({ simulateResult }: SimulateResultsProps) {
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [prevResult, setPrevResult] = useState(simulateResult);
  if (simulateResult !== prevResult) {
    setPrevResult(simulateResult);
    setExpandedDocs(new Set());
  }
  const seenDocKeys = new Map<string, number>();

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" gutterBottom display="block">
        Results — {simulateResult.docs?.length ?? 0} document
        {(simulateResult.docs?.length ?? 0) !== 1 ? "s" : ""}
      </Typography>
      <Box data-testid="simulate-result" sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {(simulateResult.docs ?? []).map((docResult, docIdx) => {
          const docBaseKey = JSON.stringify(docResult.doc ?? {});
          const docOccurrence = seenDocKeys.get(docBaseKey) ?? 0;
          seenDocKeys.set(docBaseKey, docOccurrence + 1);
          const docKey = `${docBaseKey}-${docOccurrence}`;
          const isError = !!docResult.doc?.error;
          const isExpanded = expandedDocs.has(docKey);
          const hasTrace = (docResult.processor_results?.length ?? 0) > 0;
          const seenProcessorKeys = new Map<string, number>();
          return (
            <Paper key={docKey} variant="outlined" sx={{ p: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  size="small"
                  label={isError ? "Error" : "OK"}
                  color={isError ? "error" : "success"}
                  data-testid={`doc-result-status-${docIdx}`}
                />
                <Typography variant="body2" sx={{ flex: 1 }}>
                  Doc {docIdx + 1}
                  {isError &&
                    docResult.doc?.error &&
                    ` — ${docResult.doc.error.type}: ${docResult.doc.error.reason}`}
                </Typography>
                <Button
                  size="small"
                  onClick={() => {
                    setExpandedDocs((prev) => {
                      const next = new Set(prev);
                      if (next.has(docKey)) next.delete(docKey);
                      else next.add(docKey);
                      return next;
                    });
                  }}
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? "Collapse" : "Expand"} Doc ${docIdx + 1}`}
                >
                  {isExpanded ? "Collapse" : "Expand"}
                </Button>
              </Stack>
              <Collapse in={isExpanded}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1 }}>
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                      gutterBottom
                    >
                      Output
                    </Typography>
                    <Typography
                      component="pre"
                      variant="body2"
                      sx={{
                        maxHeight: 200,
                        overflow: "auto",
                        m: 0,
                        p: 1,
                        borderRadius: 1,
                        bgcolor: "action.hover",
                        fontSize: "0.75rem",
                      }}
                    >
                      {JSON.stringify(docResult.doc?._source ?? {}, null, 2)}
                    </Typography>
                  </Box>
                  {hasTrace && (
                    <Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        gutterBottom
                      >
                        Processor trace
                      </Typography>
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                        {(docResult.processor_results ?? []).map((pr, prIdx) => {
                          const processorBaseKey = `${docKey}-${JSON.stringify(pr)}`;
                          const processorOccurrence = seenProcessorKeys.get(processorBaseKey) ?? 0;
                          seenProcessorKeys.set(processorBaseKey, processorOccurrence + 1);
                          return (
                            <Stack
                              key={`${processorBaseKey}-${processorOccurrence}`}
                              direction="row"
                              spacing={1}
                              alignItems="center"
                            >
                              <Chip
                                size="small"
                                data-testid={`processor-trace-status-${docIdx}-${prIdx}`}
                                label={
                                  pr.status === "success"
                                    ? "OK"
                                    : pr.status === "error"
                                      ? "Error"
                                      : "Unknown"
                                }
                                color={
                                  pr.status === "success"
                                    ? "success"
                                    : pr.status === "error"
                                      ? "error"
                                      : "default"
                                }
                              />
                              <Typography variant="body2">
                                {pr.processor_type ?? "processor"}
                              </Typography>
                            </Stack>
                          );
                        })}
                      </Box>
                    </Box>
                  )}
                </Box>
              </Collapse>
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
}
