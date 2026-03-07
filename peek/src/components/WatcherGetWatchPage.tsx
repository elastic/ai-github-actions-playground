import { useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";

import { useWatcherQueryWatches } from "../hooks/useWatcherQueryWatches";
import { useWatcherWatch } from "../hooks/useWatcherWatch";

import EmptyState from "./EmptyState";
import PageHeader from "./PageHeader";

export default function WatcherGetWatchPage() {
  const [watchIdInput, setWatchIdInput] = useState("");
  const [activeWatchId, setActiveWatchId] = useState("");
  const listResult = useWatcherQueryWatches({ size: 500 });
  const watchResult = useWatcherWatch(activeWatchId);
  const loading = watchResult.status === "loading";
  const watchData = watchResult.status === "success" ? watchResult.data : null;
  const listedWatches = useMemo(() => {
    if (listResult.status !== "success") return [];
    return [...listResult.data.watches].sort((a, b) => a._id.localeCompare(b._id));
  }, [listResult]);
  const output = useMemo(() => (watchData ? JSON.stringify(watchData, null, 2) : ""), [watchData]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, height: "100%", minHeight: 0 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title="Get Watch"
          description="List watches via /_watcher/_query/watches and fetch one via /_watcher/watch/{id}."
        />
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mt: 1 }}>
          <TextField
            size="small"
            fullWidth
            label="Watch ID"
            placeholder="my_watch"
            value={watchIdInput}
            onChange={(event) => setWatchIdInput(event.target.value)}
            inputProps={{ "aria-label": "Watcher watch id" }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                setActiveWatchId(watchIdInput.trim());
              }
            }}
          />
          <Button
            size="small"
            variant="contained"
            onClick={() => setActiveWatchId(watchIdInput.trim())}
            disabled={loading || watchIdInput.trim().length === 0}
            startIcon={loading ? <CircularProgress size={14} aria-hidden="true" /> : undefined}
          >
            {loading ? "Loading..." : "Get watch"}
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={watchResult.refresh}
            disabled={loading || activeWatchId.length === 0}
          >
            Refresh
          </Button>
          <Button
            size="small"
            variant="text"
            onClick={listResult.refresh}
            disabled={listResult.status === "loading"}
          >
            Refresh list
          </Button>
        </Stack>
      </Paper>

      {watchResult.status === "error" && <Alert severity="error">{watchResult.error}</Alert>}
      {listResult.status === "error" && <Alert severity="warning">{listResult.error}</Alert>}

      {watchData && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip size="small" label={`ID ${watchData._id ?? activeWatchId}`} />
          <Chip
            size="small"
            label={`Found ${watchData.found === false ? "no" : "yes"}`}
            color={watchData.found === false ? "warning" : "success"}
            variant="outlined"
          />
          <Chip
            size="small"
            label={`Active ${watchData.status?.state?.active ? "yes" : "no"}`}
            variant="outlined"
          />
          {watchData.status?.execution_state && (
            <Chip
              size="small"
              label={`State ${watchData.status.execution_state}`}
              variant="outlined"
            />
          )}
        </Stack>
      )}

      <Box
        sx={{
          display: "grid",
          gap: 1,
          gridTemplateColumns: { xs: "1fr", md: "320px 1fr" },
          flex: 1,
        }}
      >
        <Paper
          variant="outlined"
          sx={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}
        >
          <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: "divider" }}>
            <Typography variant="subtitle1">Available watches</Typography>
            <Typography variant="caption" color="text.secondary">
              {listResult.status === "success"
                ? `${listedWatches.length.toLocaleString()} of ${listResult.data.count.toLocaleString()}`
                : "Browse watch ids and click to load details"}
            </Typography>
          </Box>
          {listResult.status === "loading" ? (
            <EmptyState
              size="small"
              heading="Loading watches"
              description="Querying registered watches..."
            />
          ) : listedWatches.length === 0 ? (
            <EmptyState
              size="small"
              heading="No watches found"
              description="No watcher definitions were returned."
            />
          ) : (
            <List dense sx={{ overflow: "auto", flex: 1, py: 0 }}>
              {listedWatches.map((watch) => (
                <ListItem key={watch._id} disablePadding>
                  <ListItemButton
                    selected={activeWatchId === watch._id}
                    onClick={() => {
                      setWatchIdInput(watch._id);
                      setActiveWatchId(watch._id);
                    }}
                  >
                    <ListItemText
                      primary={
                        <Typography
                          variant="body2"
                          noWrap
                          title={watch._id}
                          sx={{ fontFamily: "monospace" }}
                        >
                          {watch._id}
                        </Typography>
                      }
                      secondary={
                        watch.status?.execution_state ? (
                          <Typography variant="caption" color="text.secondary">
                            {watch.status.execution_state}
                          </Typography>
                        ) : null
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </Paper>

        <Paper
          variant="outlined"
          sx={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}
        >
          {watchData ? (
            <Box sx={{ p: 1.5, overflow: "auto", flex: 1 }}>
              <Typography
                component="pre"
                variant="body2"
                sx={{
                  m: 0,
                  fontFamily: "monospace",
                  fontSize: "0.78rem",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
                data-testid="watcher-get-watch-output"
              >
                {output}
              </Typography>
            </Box>
          ) : (
            <EmptyState
              size="small"
              heading="No watch loaded"
              description="Choose a watch from the list or enter an id to inspect status and definition."
            />
          )}
        </Paper>
      </Box>
    </Box>
  );
}
