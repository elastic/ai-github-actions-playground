import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Switch from "@mui/material/Switch";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import AddIcon from "@mui/icons-material/Add";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import CodeMirror from "@uiw/react-codemirror";
import type { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

import QueryPipelineSteps from "./QueryPipelineSteps";
import PageHeader from "./PageHeader";
import ResizableEditorContainer from "./ResizableEditorContainer";
import QueryAnnotationOverlay from "./QueryAnnotationOverlay";

export interface DiscoverEditorPanelProps {
  isLogsExplorer: boolean;
  editorFocused: boolean;
  discoverEditorHeight: number;
  setDiscoverEditorHeight: (height: number) => void;
  effectiveQuery: string;
  handleQueryChange: (query: string) => void;
  handleCreateEditor: (view: EditorView) => void;
  queryEditorExtensions: Extension[];
  basicSetup: { lineNumbers: boolean; foldGutter: boolean; indentOnInput: boolean };
  themeMode: "light" | "dark";
  loading: boolean;
  activeStep: number | null;
  stepDurationsMs: Record<number, number>;
  handleRunQuery: () => void;
  handleRunStep: (stepQuery: string, stepIndex: number) => void;
  profileMode: boolean;
  setProfileMode: (mode: boolean) => void;
  handleFormatQuery: () => void;
  handleCreatePanel: () => void;
  queryHistory: string[];
  historyAnchor: HTMLElement | null;
  setHistoryAnchor: (anchor: HTMLElement | null) => void;
  handleSelectHistory: (query: string) => void;
}

export default function DiscoverEditorPanel(p: DiscoverEditorPanelProps) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <PageHeader
        title={p.isLogsExplorer ? "Logs Explorer Query" : "ES|QL Query"}
        actions={
          <>
            <Button
              variant="text"
              size="small"
              onClick={(e) => p.setHistoryAnchor(e.currentTarget)}
              disabled={p.queryHistory.length === 0}
            >
              Recent queries
            </Button>
            <Menu
              anchorEl={p.historyAnchor}
              open={Boolean(p.historyAnchor)}
              onClose={() => p.setHistoryAnchor(null)}
            >
              {p.queryHistory.map((historyQuery, idx) => (
                <MenuItem
                  key={`${historyQuery}-${idx}`}
                  onClick={() => p.handleSelectHistory(historyQuery)}
                >
                  {historyQuery}
                </MenuItem>
              ))}
            </Menu>
            <Typography
              component="a"
              href="https://www.elastic.co/guide/en/elasticsearch/reference/current/esql.html"
              target="_blank"
              rel="noreferrer"
              variant="caption"
              color="primary.main"
              sx={{ textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
            >
              ES|QL documentation
            </Typography>
          </>
        }
      />
      <Box
        sx={{
          overflow: "hidden",
          mb: 1,
          boxShadow: p.editorFocused
            ? (theme) => `0 0 0 1px ${theme.palette.primary.main}`
            : "none",
          border: 1,
          borderColor: p.editorFocused ? "primary.main" : "divider",
          borderRadius: 1,
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
      >
        <ResizableEditorContainer
          height={p.discoverEditorHeight}
          onHeightChange={p.setDiscoverEditorHeight}
        >
          <Box sx={{ position: "relative", height: "100%" }}>
            <CodeMirror
              value={p.effectiveQuery}
              onChange={p.handleQueryChange}
              onCreateEditor={p.handleCreateEditor}
              extensions={p.queryEditorExtensions}
              theme={p.themeMode}
              height={`${p.discoverEditorHeight}px`}
              basicSetup={p.basicSetup}
              aria-label="ES|QL query editor"
            />
            <QueryAnnotationOverlay
              query={p.effectiveQuery}
              editorFocused={p.editorFocused}
              height={p.discoverEditorHeight}
            />
          </Box>
        </ResizableEditorContainer>
      </Box>
      <QueryPipelineSteps
        query={p.effectiveQuery}
        loading={p.loading}
        activeStep={p.activeStep}
        stepDurationsMs={p.stepDurationsMs}
        onRunStep={p.handleRunStep}
      />
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1 }}>
        <Button
          variant="contained"
          size="small"
          startIcon={p.loading ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />}
          onClick={p.handleRunQuery}
          disabled={p.loading || !p.effectiveQuery.trim()}
        >
          Run Query (Ctrl/Cmd+Enter)
        </Button>
        <Tooltip title="Send profile: true with the query to see operator-level execution timings">
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={p.profileMode}
                onChange={(e) => p.setProfileMode(e.target.checked)}
              />
            }
            label={<Typography variant="caption">Profile query</Typography>}
            sx={{ ml: 0.5 }}
          />
        </Tooltip>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Format query: uppercase keywords and normalize whitespace">
          <span>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AutoFixHighIcon />}
              onClick={p.handleFormatQuery}
              disabled={!p.effectiveQuery.trim()}
            >
              Format
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="Create a dashboard panel from this query">
          <span>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={p.handleCreatePanel}
              disabled={!p.effectiveQuery.trim()}
            >
              Convert to Visualization
            </Button>
          </span>
        </Tooltip>
      </Box>
    </Paper>
  );
}
