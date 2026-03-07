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

import { useWatcherWatch } from "../hooks/useWatcherWatch";

import EmptyState from "./EmptyState";
import PageHeader from "./PageHeader";

export default function WatcherGetWatchPage() {
  const [watchIdInput, setWatchIdInput] = useState("");
  const [activeWatchId, setActiveWatchId] = useState("");
  const result = useWatcherWatch(activeWatchId);
  const loading = result.status === "loading";
  const watchData = result.status === "success" ? result.data : null;
  const output = useMemo(() => (watchData ? JSON.stringify(watchData, null, 2) : ""), [watchData]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, height: "100%", minHeight: 0 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title="Get Watch"
          description="Fetch a watch definition and status from /_watcher/watch/{id}."
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
            onClick={result.refresh}
            disabled={loading || activeWatchId.length === 0}
          >
            Refresh
          </Button>
        </Stack>
      </Paper>

      {result.status === "error" && <Alert severity="error">{result.error}</Alert>}

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

      <Paper
        variant="outlined"
        sx={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0, overflow: "hidden" }}
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
            description="Enter a watch id and fetch it to inspect status and definition."
          />
        )}
      </Paper>
    </Box>
  );
}
