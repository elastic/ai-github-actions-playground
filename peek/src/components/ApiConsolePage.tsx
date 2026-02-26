import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";

import { useConnectionStore } from "../store/useConnectionStore";
import { useUIStore } from "../store/useUIStore";
import { useApiConsoleStore } from "../store/useApiConsoleStore";
import { ElasticsearchClient, isElasticsearchError } from "../services/es";
import type { ElasticsearchConnection } from "../services/es";
import { buildCurlCommand } from "../utils/buildCurlCommand";
import { copyToClipboard } from "../utils/copyToClipboard";

import { makeLLMCompletionExtension } from "./llmCompletionExtension";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD";

interface RequestEntry {
  id: string;
  method: HttpMethod;
  path: string;
  body: string;
  response: ResponseState | null;
}

type ResponseState =
  | { status: "loading" }
  | { status: "success"; httpStatus: number; body: unknown; executionTimeMs: number }
  | { status: "error"; message: string };

const METHOD_COLORS: Record<
  HttpMethod,
  "success" | "primary" | "warning" | "error" | "secondary" | "default"
> = {
  GET: "success",
  POST: "primary",
  PUT: "warning",
  DELETE: "error",
  PATCH: "secondary",
  HEAD: "default",
};

const METHODS_WITH_BODY: HttpMethod[] = ["POST", "PUT", "PATCH"];

function httpStatusColor(status: number): "success" | "warning" | "error" | "default" {
  if (status >= 200 && status < 300) return "success";
  if (status >= 400 && status < 500) return "warning";
  if (status >= 500) return "error";
  return "default";
}

function makeEntry(overrides: Partial<RequestEntry> = {}): RequestEntry {
  return {
    id: crypto.randomUUID(),
    method: "GET",
    path: "/",
    body: "",
    response: null,
    ...overrides,
  };
}

interface RequestCardProps {
  entry: RequestEntry;
  themeMode: "light" | "dark";
  connection: ElasticsearchConnection | null;
  onUpdate: (id: string, updates: Partial<RequestEntry>) => void;
  onRemove: (id: string) => void;
  onSend: (id: string) => void;
  removable: boolean;
}

function RequestCard({
  entry,
  themeMode,
  connection,
  onUpdate,
  onRemove,
  onSend,
  removable,
}: RequestCardProps) {
  const showBody = METHODS_WITH_BODY.includes(entry.method);
  const [copied, setCopied] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const bodyEditorExtensions = useMemo(
    () => [
      json(),
      makeLLMCompletionExtension({
        prompt:
          "You are an Elasticsearch API expert. Complete the JSON request body at the cursor. Return only the completion text.",
      }),
    ],
    [],
  );
  const serializedResponse = useCallback((body: unknown): string => {
    try {
      return JSON.stringify(
        body,
        (_key, value) => (typeof value === "bigint" ? value.toString() : value),
        2,
      );
    } catch {
      return String(body);
    }
  }, []);

  const handleCopy = useCallback(async () => {
    if (!entry.response || entry.response.status !== "success") return;
    const text = serializedResponse(entry.response.body);
    const copied = await copyToClipboard(text);
    if (!copied) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [entry.response, serializedResponse]);

  const handleCopyCurl = useCallback(async () => {
    if (!connection) return;
    const cmd = buildCurlCommand(connection, entry.method, entry.path, entry.body);
    const copied = await copyToClipboard(cmd);
    if (!copied) return;
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  }, [connection, entry.method, entry.path, entry.body]);

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      {/* Request row */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.5 }}>
        <Select
          size="small"
          value={entry.method}
          onChange={(e) =>
            onUpdate(entry.id, { method: e.target.value as HttpMethod, response: null })
          }
          sx={{ minWidth: 100 }}
          renderValue={(v) => (
            <Chip
              label={v}
              color={METHOD_COLORS[v as HttpMethod]}
              size="small"
              sx={{ fontWeight: 700, fontSize: "0.75rem" }}
            />
          )}
        >
          {(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"] as HttpMethod[]).map((m) => (
            <MenuItem key={m} value={m}>
              <Chip
                label={m}
                color={METHOD_COLORS[m]}
                size="small"
                sx={{ fontWeight: 700, fontSize: "0.75rem" }}
              />
            </MenuItem>
          ))}
        </Select>

        <TextField
          size="small"
          value={entry.path}
          onChange={(e) => onUpdate(entry.id, { path: e.target.value, response: null })}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSend(entry.id);
          }}
          placeholder="/_cat/indices?v"
          sx={{ flex: 1, fontFamily: "monospace" }}
          inputProps={{ style: { fontFamily: "monospace" } }}
        />

        <Button
          variant="contained"
          size="small"
          startIcon={
            entry.response?.status === "loading" ? (
              <CircularProgress size={14} color="inherit" />
            ) : (
              <PlayArrowIcon />
            )
          }
          onClick={() => onSend(entry.id)}
          disabled={entry.response?.status === "loading" || !entry.path.trim()}
        >
          Send
        </Button>

        <Tooltip title={copiedCurl ? "Copied!" : "Copy as cURL"}>
          <span>
            <IconButton
              size="small"
              onClick={() => void handleCopyCurl()}
              disabled={!connection || !entry.path.trim()}
              aria-label="Copy as cURL"
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        {removable && (
          <Tooltip title="Remove request">
            <IconButton size="small" onClick={() => onRemove(entry.id)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Request body editor */}
      {showBody && (
        <Box sx={{ px: 1.5, pb: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
            Request body (JSON)
          </Typography>
          <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, overflow: "hidden" }}>
            <CodeMirror
              value={entry.body}
              onChange={(v) => onUpdate(entry.id, { body: v, response: null })}
              extensions={bodyEditorExtensions}
              theme={themeMode}
              height="120px"
              basicSetup={{ lineNumbers: true, foldGutter: false }}
            />
          </Box>
        </Box>
      )}

      {/* Response */}
      {entry.response && entry.response.status !== "loading" && (
        <>
          <Divider />
          <Box sx={{ p: 1.5 }}>
            {entry.response.status === "error" ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="body2" color="error.main" sx={{ flex: 1 }}>
                  {entry.response.message}
                </Typography>
                <Tooltip title="Dismiss">
                  <IconButton size="small" onClick={() => onUpdate(entry.id, { response: null })}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ) : (
              <>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <Chip
                    label={`${entry.response.httpStatus}`}
                    color={httpStatusColor(entry.response.httpStatus)}
                    size="small"
                    sx={{ fontWeight: 700, fontSize: "0.75rem" }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {entry.response.executionTimeMs} ms
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  <Tooltip title={copied ? "Copied!" : "Copy response"}>
                    <IconButton size="small" onClick={() => void handleCopy()}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Dismiss">
                    <IconButton size="small" onClick={() => onUpdate(entry.id, { response: null })}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Box
                  sx={{
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    overflow: "hidden",
                    maxHeight: 300,
                    overflowY: "auto",
                  }}
                >
                  <CodeMirror
                    value={serializedResponse(entry.response.body)}
                    extensions={[json()]}
                    theme={themeMode}
                    editable={false}
                    basicSetup={{ lineNumbers: true, foldGutter: false }}
                  />
                </Box>
              </>
            )}
          </Box>
        </>
      )}
    </Paper>
  );
}

export default function ApiConsolePage() {
  const connection = useConnectionStore((s) => s.connection);
  const themeMode = useUIStore((s) => s.themeMode);

  const persistedEntries = useApiConsoleStore((s) => s.entries);
  const setPersistedEntries = useApiConsoleStore((s) => s.setEntries);

  const [entries, setEntries] = useState<RequestEntry[]>(() =>
    persistedEntries.length > 0
      ? persistedEntries.map((p) => ({ ...p, method: p.method as HttpMethod, response: null }))
      : [makeEntry()],
  );
  const entriesRef = useRef(entries);
  const abortRefs = useRef<Map<string, AbortController>>(new Map());

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  // Sync serializable fields to the persisted store after every entries change
  useEffect(() => {
    setPersistedEntries(entries.map(({ id, method, path, body }) => ({ id, method, path, body })));
  }, [entries, setPersistedEntries]);

  useEffect(
    () => () => {
      for (const controller of abortRefs.current.values()) {
        controller.abort();
      }
      abortRefs.current.clear();
    },
    [],
  );

  const updateEntry = useCallback((id: string, updates: Partial<RequestEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  }, []);

  const removeEntry = useCallback((id: string) => {
    abortRefs.current.get(id)?.abort();
    abortRefs.current.delete(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const addEntry = useCallback(() => {
    setEntries((prev) => [...prev, makeEntry()]);
  }, []);

  const clearSession = useCallback(() => {
    for (const controller of abortRefs.current.values()) {
      controller.abort();
    }
    abortRefs.current.clear();
    setEntries([makeEntry()]);
  }, []);

  const sendRequest = useCallback(
    async (id: string) => {
      const entry = entriesRef.current.find((e) => e.id === id);
      if (!entry || !connection) return;

      // Cancel any in-flight request for this entry
      abortRefs.current.get(id)?.abort();
      const controller = new AbortController();
      abortRefs.current.set(id, controller);

      updateEntry(id, { response: { status: "loading" } });

      const start = Date.now();
      try {
        const client = new ElasticsearchClient(connection);
        const result = await client.rawRequest(
          entry.method,
          entry.path,
          METHODS_WITH_BODY.includes(entry.method) ? entry.body : undefined,
          controller.signal,
        );
        updateEntry(id, {
          response: {
            status: "success",
            httpStatus: result.status,
            body: result.body,
            executionTimeMs: Date.now() - start,
          },
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = isElasticsearchError(err) ? err.message : String(err);
        updateEntry(id, { response: { status: "error", message } });
      }
    },
    [connection, updateEntry],
  );

  const sendAll = useCallback(() => {
    for (const entry of entriesRef.current) {
      if (entry.path.trim()) void sendRequest(entry.id);
    }
  }, [sendRequest]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, pb: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          API Console
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Send arbitrary HTTP requests to your Elasticsearch cluster
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={addEntry}>
          Add Request
        </Button>
        <Button variant="outlined" size="small" startIcon={<PlayArrowIcon />} onClick={sendAll}>
          Run All
        </Button>
        <Button
          variant="outlined"
          size="small"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={clearSession}
        >
          Clear Session
        </Button>
      </Box>

      {entries.map((entry) => (
        <RequestCard
          key={entry.id}
          entry={entry}
          themeMode={themeMode}
          connection={connection}
          onUpdate={updateEntry}
          onRemove={removeEntry}
          onSend={sendRequest}
          removable={entries.length > 1}
        />
      ))}
    </Box>
  );
}
