import { useMemo, useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { EditorView } from "@codemirror/view";

import { usePackageBuilderStore } from "../../store/usePackageBuilderStore";
import { useThemeStore } from "../../store/useThemeStore";
import { renderTemplate, findUndefinedVars, findUnusedVars } from "../../services/packageBuilder/renderTemplate";
import { STARTER_TEMPLATES } from "../../types/packageBuilder";
import type { InsightSlotDefinition } from "../../types/insightSlots";
import { usePageSlotInsights } from "../../hooks/usePageSlotInsights";
import { insightGutterExtension, setInsights } from "./insightGutterExtension";
import type { PackageVariable } from "../../types/packageBuilder";

const TEMPLATE_INSIGHT_SYSTEM_PROMPT = `You are reviewing the RENDERED output of an Elastic OTel input package template.
Each line of the rendered YAML is a slot you can annotate.

**CRITICAL CONTEXT — How Elastic OTel Input Packages Work:**
This is NOT a standalone OTel Collector config. This is an INPUT TEMPLATE for Elastic Fleet/Agent.
- Fleet/Agent AUTOMATICALLY injects the exporter (elasticsearchexporter). The template must NEVER define an "exporters:" section or reference exporters in service.pipelines.
- The template only defines: receivers, processors, and service.pipelines (without exporters).
- service.pipelines format: \`metrics: { receivers: [name], processors: [name] }\` — NO exporters array.
- If the template correctly omits exporters, that is CORRECT. Do NOT suggest adding them.

**What to look for per line:**
- If a line contains "exporters:" or references an exporter, flag as CRITICAL — it must be removed.
- Receiver config: Is the endpoint format reasonable? Are intervals like "10s", "1s" sensible?
- TLS: insecure: true means TLS is disabled (common default). insecure_skip_verify skips cert validation.
- YAML structure: Bad indentation, missing colons, invalid values.
- Pipeline wiring: Does service.pipelines correctly reference the declared receivers and processors? It should NOT reference any exporters.
- resourcedetection/system processor with detectors: ["system"] is the standard recommended processor.

**Rules:**
- Only annotate lines with genuine issues or useful tips. Most lines should have NO insight.
- NEVER suggest adding exporters. NEVER flag missing exporters as a problem.
- Use severity "info" for tips, "warning" for potential issues, "critical" for definite errors.
- Keep insight text to one short sentence.`;

const editorExtensions = [yaml(), EditorView.lineWrapping];

export default function StepTemplate() {
  const templateContent = usePackageBuilderStore((s) => s.templateContent);
  const identity = usePackageBuilderStore((s) => s.identity);
  const variables = usePackageBuilderStore((s) => s.variables);
  const mockValues = usePackageBuilderStore((s) => s.mockValues);
  const setTemplateContent = usePackageBuilderStore((s) => s.setTemplateContent);
  const loadStarterTemplate = usePackageBuilderStore((s) => s.loadStarterTemplate);
  const setMockValue = usePackageBuilderStore((s) => s.setMockValue);
  const themeMode = useThemeStore((s) => s.themeMode);

  const isEmpty = !templateContent.trim();

  const result = useMemo(
    () => renderTemplate(templateContent, variables, mockValues),
    [templateContent, variables, mockValues],
  );

  const undefinedVars = useMemo(
    () => findUndefinedVars(templateContent, variables),
    [templateContent, variables],
  );

  const unusedVars = useMemo(
    () => findUnusedVars(templateContent, variables),
    [templateContent, variables],
  );

  const hasExporters = /\bexporters\s*:/i.test(templateContent);

  const insertAtCursor = (text: string) => {
    setTemplateContent(templateContent + text);
  };

  if (isEmpty) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 3 }}>
        <DescriptionOutlinedIcon sx={{ fontSize: 64, color: "text.disabled" }} />
        <Typography variant="h6" color="text.secondary">
          No template yet
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 440, textAlign: "center" }}>
          Start from a starter template below, or paste your own OTel Collector config into the editor.
        </Typography>
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", justifyContent: "center" }}>
          {Object.keys(STARTER_TEMPLATES).map((key) => (
            <Button
              key={key}
              variant="outlined"
              size="small"
              onClick={() => loadStarterTemplate(key)}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </Button>
          ))}
        </Box>
        <Button variant="text" size="small" onClick={() => setTemplateContent("# Paste or type your template here\n")}>
          Start from scratch
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="h6">Template Editor</Typography>

      {/* Variable insertion chips */}
      {variables.length > 0 && (
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center" }}>
          <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
            Insert:
          </Typography>
          {variables
            .filter((v) => v.name)
            .map((v) => (
              <Chip
                key={v.name}
                label={`{{${v.name}}}`}
                size="small"
                variant="outlined"
                sx={{ fontFamily: "monospace", fontSize: 11, cursor: "pointer" }}
                onClick={() => insertAtCursor(`{{${v.name}}}`)}
              />
            ))}
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Tooltip title="Insert {{#if varName}}...{{/if}} block">
            <Chip
              label="{{#if ...}}"
              size="small"
              variant="outlined"
              sx={{ fontFamily: "monospace", fontSize: 11, cursor: "pointer" }}
              onClick={() => insertAtCursor("\n{{#if variable_name}}\n\n{{/if}}\n")}
            />
          </Tooltip>
        </Box>
      )}

      {/* Warnings */}
      {undefinedVars.length > 0 && (
        <Alert severity="warning" sx={{ py: 0.5 }}>
          Template references undefined variables: {undefinedVars.map((v) => `{{${v}}}`).join(", ")}
        </Alert>
      )}
      {unusedVars.length > 0 && (
        <Alert severity="info" sx={{ py: 0.5 }}>
          Defined but unused in template: {unusedVars.join(", ")}
        </Alert>
      )}
      {hasExporters && (
        <Alert severity="warning" sx={{ py: 0.5 }}>
          Templates should not define exporters - Fleet adds those automatically.
        </Alert>
      )}

      {/* Split pane: editor + preview */}
      <Box sx={{ display: "flex", gap: 2 }}>
        {/* Editor */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom display="block">
            agent/input/input.yml.hbs
          </Typography>
          <CodeMirror
            value={templateContent}
            onChange={setTemplateContent}
            extensions={editorExtensions}
            theme={themeMode}
            height="400px"
            basicSetup={{ lineNumbers: true, foldGutter: true }}
          />
        </Box>

        {/* Preview with per-line insights */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Rendered preview
              {result.yamlValid && (
                <Chip label="Valid YAML" size="small" color="success" variant="outlined" sx={{ ml: 1, height: 18, fontSize: 10 }} />
              )}
              {result.yamlError && (
                <Chip label="Invalid YAML" size="small" color="error" variant="outlined" sx={{ ml: 1, height: 18, fontSize: 10 }} />
              )}
            </Typography>
            {result.rendered && (
              <Tooltip title="Copy rendered output">
                <ContentCopyIcon
                  fontSize="small"
                  sx={{ cursor: "pointer", color: "text.secondary" }}
                  onClick={() => navigator.clipboard.writeText(result.rendered)}
                />
              </Tooltip>
            )}
          </Box>
          <RenderedPreview
            rendered={result.rendered}
            templateError={result.templateError}
            packageName={identity.name}
            variables={variables}
            templateContent={templateContent}
            themeMode={themeMode}
          />
          {result.yamlError && (
            <Alert severity="error" sx={{ mt: 1, py: 0.5 }}>
              {result.yamlError}
            </Alert>
          )}
        </Box>
      </Box>

      {/* Mock values */}
      {variables.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary" gutterBottom display="block">
            Mock values (change to see different preview outputs)
          </Typography>
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
            {variables
              .filter((v) => v.name)
              .map((v) => (
                <TextField
                  key={v.name}
                  label={v.title || v.name}
                  value={mockValues[v.name] ?? v.default}
                  onChange={(e) => setMockValue(v.name, e.target.value)}
                  size="small"
                  type={v.type === "integer" ? "number" : "text"}
                  sx={{ width: 220 }}
                  helperText={v.type === "bool" ? '"true" or "false"' : undefined}
                />
              ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}

/* ── Per-line insight preview with CodeMirror ── */

interface RenderedPreviewProps {
  rendered: string;
  templateError: string | null;
  packageName: string;
  variables: PackageVariable[];
  templateContent: string;
  themeMode: "light" | "dark";
}

const previewBaseExtensions = [yaml(), EditorView.lineWrapping];

function RenderedPreview({ rendered, templateError, packageName, variables, templateContent, themeMode }: RenderedPreviewProps) {
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const lines = useMemo(() => (rendered ? rendered.split("\n") : []), [rendered]);

  const slots = useMemo<InsightSlotDefinition[]>(
    () =>
      lines.map((line, i) => ({
        slotId: `line-${i}`,
        label: `Line ${i + 1}: ${line.trimStart().slice(0, 60)}`,
      })),
    [lines],
  );

  const context = useMemo(() => {
    if (!rendered || !templateContent.trim()) return "";
    const varList = variables
      .map((v) => `${v.name} (${v.type}, required: ${v.required}, default: "${v.default}")`)
      .join(", ");
    const numberedLines = lines.map((l, i) => `${i + 1}: ${l}`).join("\n");
    return `Package: "${packageName}"
Variables: ${varList}

Rendered YAML (line numbers for slot references):
${numberedLines}`;
  }, [rendered, templateContent, packageName, variables, lines]);

  const cacheKey = `pkg-template-lines::${packageName}::${lines.length}::${rendered.length}`;

  const { insights } = usePageSlotInsights({
    context,
    systemPrompt: TEMPLATE_INSIGHT_SYSTEM_PROMPT,
    cacheKey,
    slots,
    enabled: lines.length > 0 && variables.length > 0,
  });

  // Push insights into CodeMirror state whenever they change
  useEffect(() => {
    const view = cmRef.current?.view;
    if (!view || !insights.length) return;
    view.dispatch({ effects: setInsights.of(insights) });
  }, [insights]);

  const previewExtensions = useMemo(
    () => [...previewBaseExtensions, ...insightGutterExtension()],
    [],
  );

  if (templateError) {
    return (
      <Alert severity="error" sx={{ minHeight: 400 }}>
        Template error: {templateError}
      </Alert>
    );
  }

  if (!rendered) {
    return (
      <Box sx={{ minHeight: 400, p: 1.5, bgcolor: "action.hover", fontFamily: "monospace", fontSize: 13, border: 1, borderColor: "divider", borderRadius: 1 }}>
        (empty)
      </Box>
    );
  }

  return (
    <CodeMirror
      ref={cmRef}
      value={rendered}
      extensions={previewExtensions}
      theme={themeMode}
      height="400px"
      editable={false}
      basicSetup={{ lineNumbers: true, foldGutter: true }}
    />
  );
}
