import { useState, useCallback, useRef, useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

import { useConnectionStore } from "../store/useConnectionStore";
import { useUIStore } from "../store/useUIStore";
import { useApiConsoleStore } from "../store/useApiConsoleStore";
import { ElasticsearchClient, isElasticsearchError } from "../services/es";

import PageHeader from "./PageHeader";
import RequestCard from "./api-console/RequestCard";
import type { HttpMethod, RequestEntry } from "./api-console/apiConsoleTypes";
import { METHODS_WITH_BODY, makeEntry } from "./api-console/apiConsoleTypes";

export default function ApiConsolePage() {
  const connection = useConnectionStore((s) => s.connection);
  const themeMode = useUIStore((s) => s.themeMode);

  const persistedEntries = useApiConsoleStore((s) => s.entries);
  const setPersistedEntries = useApiConsoleStore((s) => s.setEntries);
  const consoleDraft = useApiConsoleStore((s) => s.consoleDraft);
  const setConsoleDraft = useApiConsoleStore((s) => s.setConsoleDraft);

  const [entries, setEntries] = useState<RequestEntry[]>(() => {
    const base =
      persistedEntries.length > 0
        ? persistedEntries.map((p) => ({ ...p, method: p.method as HttpMethod, response: null }))
        : [makeEntry()];
    if (consoleDraft) {
      return [
        makeEntry({ method: consoleDraft.method as HttpMethod, path: consoleDraft.path }),
        ...base,
      ];
    }
    return base;
  });
  const entriesRef = useRef(entries);
  const abortRefs = useRef<Map<string, AbortController>>(new Map());

  const [overflowMenuAnchor, setOverflowMenuAnchor] = useState<null | HTMLElement>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  // Clear the draft after it has been consumed during initialization
  useEffect(() => {
    if (consoleDraft) {
      setConsoleDraft(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const cancelRequest = useCallback(
    (id: string) => {
      abortRefs.current.get(id)?.abort();
      abortRefs.current.delete(id);
      updateEntry(id, { response: null });
    },
    [updateEntry],
  );

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
      <PageHeader
        title="API Console"
        description="Send arbitrary HTTP requests to your Elasticsearch cluster"
        actions={
          <>
            <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={addEntry}>
              Add Request
            </Button>
            <Button variant="outlined" size="small" startIcon={<PlayArrowIcon />} onClick={sendAll}>
              Run All
            </Button>
            <IconButton
              size="small"
              aria-label="More actions"
              aria-controls={overflowMenuAnchor ? "console-overflow-menu" : undefined}
              aria-haspopup="true"
              aria-expanded={overflowMenuAnchor ? "true" : undefined}
              onClick={(e) => setOverflowMenuAnchor(e.currentTarget)}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
            <Menu
              id="console-overflow-menu"
              anchorEl={overflowMenuAnchor}
              open={Boolean(overflowMenuAnchor)}
              onClose={() => setOverflowMenuAnchor(null)}
            >
              <MenuItem
                aria-label="Clear session"
                onClick={() => {
                  setOverflowMenuAnchor(null);
                  setConfirmClearOpen(true);
                }}
                sx={{ color: "error.main" }}
              >
                <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
                Clear Session
              </MenuItem>
            </Menu>
          </>
        }
      />
      <Box>
        <Dialog
          open={confirmClearOpen}
          onClose={() => setConfirmClearOpen(false)}
          aria-labelledby="clear-session-dialog-title"
        >
          <DialogTitle id="clear-session-dialog-title">Clear Session?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              This will cancel all in-flight requests and remove all requests from the session. This
              action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmClearOpen(false)}>Cancel</Button>
            <Button
              color="error"
              variant="contained"
              startIcon={<DeleteIcon />}
              onClick={() => {
                setConfirmClearOpen(false);
                clearSession();
              }}
            >
              Clear Session
            </Button>
          </DialogActions>
        </Dialog>
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
          onCancel={cancelRequest}
          removable={entries.length > 1}
        />
      ))}

      {entries.length === 1 && entries[0] && !entries[0].response && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: "center" }}>
          Try <code>GET _cluster/health</code> or <code>GET _cat/indices?v</code> to get started.
        </Typography>
      )}
    </Box>
  );
}
