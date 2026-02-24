import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";

import { ElasticsearchClient, isElasticsearchError } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";
import { useUIStore } from "../store/useUIStore";

interface SearchHit {
  _id: string;
  _score: number | null;
  _source: Record<string, unknown> | null;
}

interface ComparisonMetrics {
  sharedCount: number;
  lexicalOnlyCount: number;
  vectorOnlyCount: number;
  topKIntersectionRate: number;
}

const DEFAULT_LEXICAL_QUERY = `{
  "query": {
    "multi_match": {
      "query": "waterproof hiking backpack",
      "fields": ["name^3", "description", "category"]
    }
  }
}`;

const DEFAULT_VECTOR_QUERY = `{
  "query": {
    "semantic": {
      "field": "description_semantic",
      "query": "waterproof hiking backpack"
    }
  }
}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseHits(responseBody: unknown): SearchHit[] {
  if (!isRecord(responseBody)) return [];
  const hitsContainer = responseBody.hits;
  if (!isRecord(hitsContainer)) return [];
  const hits = hitsContainer.hits;
  if (!Array.isArray(hits)) return [];
  return hits
    .map((hit) => {
      if (!isRecord(hit) || typeof hit._id !== "string") return null;
      const source = isRecord(hit._source) ? hit._source : null;
      const score = typeof hit._score === "number" ? hit._score : null;
      return { _id: hit._id, _score: score, _source: source } satisfies SearchHit;
    })
    .filter((hit): hit is SearchHit => hit !== null);
}

function extractError(responseBody: unknown): string | null {
  if (!isRecord(responseBody)) return null;
  const error = responseBody.error;
  if (!isRecord(error)) return null;
  if (typeof error.reason === "string") return error.reason;
  const causedBy = error.caused_by;
  if (isRecord(causedBy) && typeof causedBy.reason === "string") return causedBy.reason;
  return null;
}

function sourcePreview(source: Record<string, unknown> | null): string {
  if (!source) return "—";
  try {
    const raw = JSON.stringify(source);
    return raw.length > 160 ? `${raw.slice(0, 160)}…` : raw;
  } catch {
    return "—";
  }
}

function compareHits(
  lexicalHits: SearchHit[],
  vectorHits: SearchHit[],
  requestedTopK: number,
): ComparisonMetrics {
  const lexicalIds = new Set(lexicalHits.map((hit) => hit._id));
  const vectorIds = new Set(vectorHits.map((hit) => hit._id));
  const sharedCount = [...lexicalIds].filter((id) => vectorIds.has(id)).length;
  const lexicalOnlyCount = lexicalIds.size - sharedCount;
  const vectorOnlyCount = vectorIds.size - sharedCount;
  const topK = Math.max(0, requestedTopK);
  if (topK === 0) {
    return { sharedCount, lexicalOnlyCount, vectorOnlyCount, topKIntersectionRate: 0 };
  }
  const lexicalTopK = new Set(lexicalHits.slice(0, topK).map((hit) => hit._id));
  const vectorTopK = new Set(vectorHits.slice(0, topK).map((hit) => hit._id));
  const overlapTopK = [...lexicalTopK].filter((id) => vectorTopK.has(id)).length;
  return {
    sharedCount,
    lexicalOnlyCount,
    vectorOnlyCount,
    topKIntersectionRate: overlapTopK / topK,
  };
}

export default function RelevanceLabPage() {
  const connection = useConnectionStore((s) => s.connection);
  const themeMode = useUIStore((s) => s.themeMode);
  const [indexName, setIndexName] = useState("products-*");
  const [size, setSize] = useState(20);
  const [lexicalQuery, setLexicalQuery] = useState(DEFAULT_LEXICAL_QUERY);
  const [vectorQuery, setVectorQuery] = useState(DEFAULT_VECTOR_QUERY);
  const [lexicalHits, setLexicalHits] = useState<SearchHit[]>([]);
  const [vectorHits, setVectorHits] = useState<SearchHit[]>([]);
  const [metrics, setMetrics] = useState<ComparisonMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const editorExtensions = useMemo(() => [json()], []);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const runComparison = useCallback(async () => {
    if (!connection || !indexName.trim()) return;
    let lexicalBody: Record<string, unknown>;
    let vectorBody: Record<string, unknown>;
    try {
      const parsedLexical = JSON.parse(lexicalQuery);
      const parsedVector = JSON.parse(vectorQuery);
      if (!isRecord(parsedLexical) || !isRecord(parsedVector)) {
        setError("Retriever query bodies must be valid JSON objects.");
        setLexicalHits([]);
        setVectorHits([]);
        setMetrics(null);
        return;
      }
      lexicalBody = { ...parsedLexical, size };
      vectorBody = { ...parsedVector, size };
    } catch {
      setError("Retriever query bodies must be valid JSON.");
      setLexicalHits([]);
      setVectorHits([]);
      setMetrics(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const client = new ElasticsearchClient(connection);
      const path = `/${encodeURIComponent(indexName.trim())}/_search`;
      const [lexicalResponse, vectorResponse] = await Promise.all([
        client.rawRequest("POST", path, JSON.stringify(lexicalBody), controller.signal),
        client.rawRequest("POST", path, JSON.stringify(vectorBody), controller.signal),
      ]);
      if (lexicalResponse.status >= 400) {
        throw new Error(
          extractError(lexicalResponse.body) ??
            `Lexical retrieval failed with HTTP ${lexicalResponse.status}.`,
        );
      }
      if (vectorResponse.status >= 400) {
        throw new Error(
          extractError(vectorResponse.body) ??
            `Vector retrieval failed with HTTP ${vectorResponse.status}.`,
        );
      }
      const nextLexicalHits = parseHits(lexicalResponse.body);
      const nextVectorHits = parseHits(vectorResponse.body);
      setLexicalHits(nextLexicalHits);
      setVectorHits(nextVectorHits);
      setMetrics(compareHits(nextLexicalHits, nextVectorHits, size));
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = isElasticsearchError(err)
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
      setError(message);
      setLexicalHits([]);
      setVectorHits([]);
      setMetrics(null);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [connection, indexName, lexicalQuery, vectorQuery, size]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Relevance Lab
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Compare lexical and vector retrieval side-by-side.
        </Typography>
        <Box sx={{ flex: 1 }} />
        <TextField
          size="small"
          label="Index"
          value={indexName}
          onChange={(e) => setIndexName(e.target.value)}
          sx={{ minWidth: 220 }}
        />
        <TextField
          size="small"
          label="Top K"
          type="number"
          value={size}
          onChange={(e) => setSize(Math.max(1, Number(e.target.value) || 1))}
          inputProps={{ min: 1, max: 200 }}
          sx={{ width: 90 }}
        />
        <Button
          variant="contained"
          size="small"
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />}
          onClick={runComparison}
          disabled={loading || !indexName.trim()}
        >
          Run comparison
        </Button>
      </Box>

      <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
        <Paper variant="outlined" sx={{ p: 1 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
            Lexical retriever (_search body)
          </Typography>
          <CodeMirror
            value={lexicalQuery}
            onChange={setLexicalQuery}
            extensions={editorExtensions}
            theme={themeMode}
            height="180px"
            basicSetup={{ lineNumbers: true, foldGutter: false }}
          />
        </Paper>
        <Paper variant="outlined" sx={{ p: 1 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
            Vector retriever (_search body)
          </Typography>
          <CodeMirror
            value={vectorQuery}
            onChange={setVectorQuery}
            extensions={editorExtensions}
            theme={themeMode}
            height="180px"
            basicSetup={{ lineNumbers: true, foldGutter: false }}
          />
        </Paper>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {metrics && (
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Chip size="small" label={`shared IDs: ${metrics.sharedCount}`} />
          <Chip size="small" label={`lexical only: ${metrics.lexicalOnlyCount}`} />
          <Chip size="small" label={`vector only: ${metrics.vectorOnlyCount}`} />
          <Chip
            size="small"
            label={`top-k overlap: ${(metrics.topKIntersectionRate * 100).toFixed(1)}%`}
          />
        </Box>
      )}

      <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
        {[
          { title: "Lexical results", hits: lexicalHits },
          { title: "Vector results", hits: vectorHits },
        ].map(({ title, hits }) => (
          <Paper key={title} variant="outlined" sx={{ overflow: "hidden" }}>
            <Box sx={{ p: 1, borderBottom: 1, borderColor: "divider" }}>
              <Typography variant="subtitle2">{title}</Typography>
            </Box>
            <TableContainer sx={{ maxHeight: 420 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Rank</TableCell>
                    <TableCell>ID</TableCell>
                    <TableCell>Score</TableCell>
                    <TableCell>Source preview</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {hits.map((hit, idx) => (
                    <TableRow key={`${title}-${hit._id}-${idx}`}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell sx={{ fontFamily: "monospace" }}>{hit._id}</TableCell>
                      <TableCell>{hit._score === null ? "—" : hit._score.toFixed(4)}</TableCell>
                      <TableCell sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                        {sourcePreview(hit._source)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {hits.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Typography variant="body2" color="text.secondary">
                          Run comparison to view results.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
