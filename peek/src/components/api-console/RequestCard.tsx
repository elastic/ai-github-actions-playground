import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import CancelIcon from "@mui/icons-material/Cancel";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";

import { buildCurlCommand } from "../../utils/buildCurlCommand";
import { copyToClipboard } from "../../utils/copyToClipboard";
import { makeLLMCompletionExtension } from "../llmCompletionExtension";

import type { HttpMethod, RequestCardProps } from "./apiConsoleTypes";
import { METHOD_COLORS, METHODS_WITH_BODY, httpStatusColor } from "./apiConsoleTypes";

function serializeResponse(body: unknown): string {
  try {
    return JSON.stringify(
      body,
      (_key, value) => (typeof value === "bigint" ? value.toString() : value),
      2,
    );
  } catch {
    return String(body);
  }
}

const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"];

export default function RequestCard({
  entry,
  themeMode,
  connection,
  onUpdate,
  onRemove,
  onSend,
  onCancel,
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
  const pathEditorExtensions = useMemo(
    () => [
      makeLLMCompletionExtension({
        prompt:
          "You are an Elasticsearch REST API path expert. Complete the API path at the cursor position. Common paths include _cluster/health, _cat/indices, _search, _bulk, _mapping, _settings, _aliases, _reindex, _analyze, _nodes, _tasks, _ingest/pipeline, _security, etc. Return only the complete path text, no explanation.",
        delay: 600,
      }),
    ],
    [],
  );
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyCurlTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      if (copyCurlTimerRef.current) clearTimeout(copyCurlTimerRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    if (!entry.response || entry.response.status !== "success") return;
    const text = serializeResponse(entry.response.body);
    const ok = await copyToClipboard(text);
    if (!ok) return;
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  }, [entry.response]);

  const handleCopyCurl = useCallback(async () => {
    if (!connection) return;
    const cmd = buildCurlCommand(connection, entry.method, entry.path, entry.body);
    const ok = await copyToClipboard(cmd);
    if (!ok) return;
    setCopiedCurl(true);
    if (copyCurlTimerRef.current) clearTimeout(copyCurlTimerRef.current);
    copyCurlTimerRef.current = setTimeout(() => setCopiedCurl(false), 2000);
  }, [connection, entry.method, entry.path, entry.body]);

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      {/* Request row */}
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", p: 1.5 }}>
        <Select
          size="small"
          value={entry.method}
          onChange={(e) =>
            onUpdate(entry.id, { method: e.target.value as HttpMethod, response: null })
          }
          sx={{ minWidth: 100, height: 36 }}
          inputProps={{ "aria-label": "HTTP method" }}
          renderValue={(v) => (
            <Chip
              label={v}
              color={METHOD_COLORS[v as HttpMethod]}
              size="small"
              sx={{ fontWeight: 700, fontSize: "0.75rem" }}
            />
          )}
        >
          {HTTP_METHODS.map((m) => (
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

        <Box
          sx={{
            flex: 1,
            overflow: "hidden",
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            "& .cm-content": { padding: "6px 8px", fontFamily: "monospace" },
            "& .cm-editor": { fontSize: "0.875rem" },
            "& .cm-line": { fontFamily: "monospace" },
          }}
        >
          <CodeMirror
            value={entry.path}
            onChange={(v) => {
              const singleLine = v.replace(/\n/g, "");
              onUpdate(entry.id, { path: singleLine, response: null });
            }}
            extensions={pathEditorExtensions}
            theme={themeMode}
            height="36px"
            placeholder="/_cat/indices?v"
            basicSetup={{
              lineNumbers: false,
              foldGutter: false,
              highlightActiveLine: false,
              highlightActiveLineGutter: false,
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && entry.path.trim()) {
                e.preventDefault();
                onSend(entry.id);
              }
            }}
            aria-label="Request path"
          />
        </Box>

        {entry.response?.status === "loading" ? (
          <Button
            variant="outlined"
            size="small"
            color="warning"
            startIcon={<CancelIcon />}
            onClick={() => onCancel(entry.id)}
          >
            Cancel
          </Button>
        ) : (
          <Button
            variant="contained"
            size="small"
            startIcon={<PlayArrowIcon />}
            onClick={() => onSend(entry.id)}
            disabled={!entry.path.trim()}
          >
            Send
          </Button>
        )}

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
            <IconButton size="small" onClick={() => onRemove(entry.id)} aria-label="Remove request">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Request body editor */}
      {showBody && (
        <Box sx={{ pb: 1, px: 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
            Request body (JSON)
          </Typography>
          <Box sx={{ overflow: "hidden", border: 1, borderColor: "divider", borderRadius: 1 }}>
            <CodeMirror
              value={entry.body}
              onChange={(v) => onUpdate(entry.id, { body: v, response: null })}
              extensions={bodyEditorExtensions}
              theme={themeMode}
              height="120px"
              basicSetup={{ lineNumbers: true, foldGutter: false }}
              aria-label="Request body editor"
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
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <Typography variant="body2" color="error.main" sx={{ flex: 1 }}>
                  {entry.response.message}
                </Typography>
                <Tooltip title="Dismiss">
                  <IconButton
                    size="small"
                    onClick={() => onUpdate(entry.id, { response: null })}
                    aria-label="Dismiss"
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ) : (
              <>
                <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1 }}>
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
                    <IconButton
                      size="small"
                      onClick={() => void handleCopy()}
                      aria-label="Copy response"
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Dismiss">
                    <IconButton
                      size="small"
                      onClick={() => onUpdate(entry.id, { response: null })}
                      aria-label="Dismiss"
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Box
                  sx={{
                    maxHeight: 300,
                    overflow: "hidden",
                    overflowY: "auto",
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                  }}
                >
                  <CodeMirror
                    value={serializeResponse(entry.response.body)}
                    extensions={[json()]}
                    theme={themeMode}
                    editable={false}
                    basicSetup={{ lineNumbers: true, foldGutter: true }}
                    aria-label="Response body"
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
