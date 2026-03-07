import Handlebars from "handlebars";
import YAML from "yaml";
import type { PackageVariable } from "../../types/packageBuilder";

export interface RenderResult {
  rendered: string;
  yamlValid: boolean;
  yamlError: string | null;
  templateError: string | null;
}

/**
 * After Handlebars renders, find multi-line string values in the output
 * and re-indent their continuation lines to match the YAML column where
 * the value starts. This is what Fleet/Agent does under the hood.
 */
function autoIndentMultilineValues(
  rendered: string,
  templateSource: string,
  context: Record<string, unknown>,
): string {
  // Find variables whose values contain newlines
  const multilineVars = Object.entries(context).filter(
    ([, v]) => typeof v === "string" && v.includes("\n"),
  );
  if (multilineVars.length === 0) return rendered;

  // Re-render with unique markers to identify exact substitution sites,
  // then indent multiline values at those marker locations.
  const markerContext: Record<string, unknown> = { ...context };
  const markerToValue = new Map<string, string>();
  for (const [name, value] of multilineVars) {
    const marker = `__PKG_BUILDER_MULTILINE_${name}__`;
    markerContext[name] = marker;
    markerToValue.set(marker, value as string);
  }

  const compiled = Handlebars.compile(templateSource, { noEscape: true });
  let result = compiled(markerContext);
  for (const [marker, rawVal] of markerToValue) {
    let searchFrom = 0;
    while (searchFrom < result.length) {
      const markerIdx = result.indexOf(marker, searchFrom);
      if (markerIdx === -1) break;
      const lineStart = result.lastIndexOf("\n", markerIdx) + 1;
      const indent = " ".repeat(markerIdx - lineStart);
      const indentedVal = rawVal.split("\n").join("\n" + indent);
      result = `${result.slice(0, markerIdx)}${indentedVal}${result.slice(markerIdx + marker.length)}`;
      searchFrom = markerIdx + indentedVal.length;
    }
  }
  return result;
}

export function renderTemplate(
  templateSource: string,
  variables: PackageVariable[],
  mockOverrides: Record<string, string>,
): RenderResult {
  // Build context from variable defaults + overrides
  const context: Record<string, unknown> = {};
  for (const v of variables) {
    const raw = mockOverrides[v.name] ?? v.default;
    if (v.type === "bool") {
      context[v.name] = raw === "true";
    } else if (v.type === "integer") {
      const parsed = Number(raw);
      context[v.name] = Number.isFinite(parsed) ? parsed : 0;
    } else {
      context[v.name] = raw;
    }
  }

  let rendered: string;
  try {
    const compiled = Handlebars.compile(templateSource, { noEscape: true });
    rendered = compiled(context);
  } catch (err) {
    return {
      rendered: "",
      yamlValid: false,
      yamlError: null,
      templateError: err instanceof Error ? err.message : String(err),
    };
  }

  // Auto-indent multi-line variable values: for each line that was produced
  // by substituting a multi-line value, indent continuation lines to match
  // the column position of the value start on the first line.
  rendered = autoIndentMultilineValues(rendered, templateSource, context);

  // Clean up excessive blank lines left by false {{#if}} blocks
  rendered = rendered.replace(/\n{3,}/g, "\n\n");

  let yamlValid = true;
  let yamlError: string | null = null;
  try {
    YAML.parse(rendered);
  } catch (err) {
    yamlValid = false;
    yamlError = err instanceof Error ? err.message : String(err);
  }

  return { rendered, yamlValid, yamlError, templateError: null };
}

/** Find template variables referenced as {{name}} but not defined in the variable list. */
export function findUndefinedVars(templateSource: string, variables: PackageVariable[]): string[] {
  const defined = new Set(variables.map((v) => v.name));
  const referenced = extractReferencedVars(templateSource);
  return [...referenced].filter((name) => !defined.has(name));
}

/** Find variables defined but never referenced in the template. */
export function findUnusedVars(templateSource: string, variables: PackageVariable[]): string[] {
  const referenced = extractReferencedVars(templateSource);
  return variables.map((v) => v.name).filter((name) => !referenced.has(name));
}

function extractReferencedVars(templateSource: string): Set<string> {
  const referenced = new Set<string>();
  // Match block helpers like {{#if name}} / {{#each items}}
  const reBlock = /\{\{#\s*(?:if|each|unless|with)\s+([a-zA-Z_][a-zA-Z0-9_]*)\b[^}]*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = reBlock.exec(templateSource)) !== null) {
    if (m[1]) referenced.add(m[1]);
  }
  // Also match plain {{name}}
  const rePlain = /\{\{\s*(?!#|\/|!|>)([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
  while ((m = rePlain.exec(templateSource)) !== null) {
    if (m[1]) referenced.add(m[1]);
  }
  return referenced;
}
